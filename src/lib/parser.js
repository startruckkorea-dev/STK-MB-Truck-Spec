/**
 * parser.js — MB 트럭 Internal Quotation .docx 파싱 및 코드 추출
 *
 * 실제 docx 구조:
 *   1. 상단: 경고/리포트 테이블 (Category/Report type/Description) → 스킵
 *   2. Paint 섹션: 페인트 코드 (예: MB 6888)
 *   3. Tyres 섹션: 타이어 코드
 *   4. Vehicle equipment: 코드+설명 단락 (예: "A1Z  Front axle, offset version")
 *   5. Equipment overview 테이블: 세미콜론 구분 코드 목록 (박스)
 *   6. Vehicle description: 모델 정보
 *
 * 파싱 전략:
 *   - 단락(p)을 순회하며 섹션 헤더 감지 → 코드+설명 추출
 *   - Equipment overview 테이블에서 세미콜론 구분 코드 추출 (백업)
 *   - Model Year 자동 감지
 */

import mammoth from 'mammoth';

// ─── Model Year 감지 ─────────────────────────────────────────────
const MY_RE = /\b(?:Model\s*[Yy]ear\s+(\d{4})|MY\s*(\d{2,4})|model\s+year\s+(\d+))\b/i;
// "V8X  Model year 7" → model year 코드에서 숫자 추출
const MY_CODE_RE = /\bmodel\s+year\s+(\d{1,2})\b/i;

export function parseModelYear(text) {
  if (!text) return null;
  const m = MY_RE.exec(text);
  if (!m) return null;
  if (m[1]) return `MY${String(m[1]).slice(-2)}`;
  if (m[2]) return m[2].length === 4 ? `MY${m[2].slice(-2)}` : `MY${m[2]}`;
  if (m[3]) return m[3].length <= 2 ? `MY${m[3].padStart(2, '0')}` : `MY${m[3].slice(-2)}`;
  return null;
}

// ─── 견적서 파일명에서 기본 정보 추출 ───────────────────────────
// 예: "Internal quotation hide prices_TR01-1  Actros-L 2863 LS 6x2 G5F 2026-04_(1).docx"
//      → { series:'Actros', code:'2863LS', axle:'6x2', cabin:'G5F' }
export function parseQuotationFilename(name) {
  if (!name) return {};
  const base = String(name).replace(/\.docx$/i, '');
  const out = {};

  // 시리즈 (Actros / Arocs / Atego) — "Actros-L" 등 변형 포함
  const sm = base.match(/\b(Actros|Arocs|Atego)\b/i);
  if (sm) out.series = sm[1][0].toUpperCase() + sm[1].slice(1).toLowerCase();

  // 축 구성 (6x2, 8x4 ...)
  const am = base.match(/\b([1-9])\s*[xX]\s*([1-9])\b/);
  if (am) out.axle = `${am[1]}x${am[2]}`;

  // 모델 코드 (4자리 숫자 + 1~3 영문, 예: "2863 LS" / "2851LS" / "1833L")
  // 생산연도(2026 등)는 뒤에 영문이 없어 매칭되지 않음
  const cm = base.match(/\b([1-4]\d{3})\s*([A-Za-z]{1,3})\b/);
  if (cm) out.code = (cm[1] + cm[2]).toUpperCase();

  // 캐빈 코드 (영문-숫자-영문, 예: G5F / S5F)
  const km = base.match(/\b([A-Za-z]{1,2}\d[A-Za-z]{1,2})\b/);
  if (km) out.cabin = km[1].toUpperCase();

  return out;
}

// ─── 코드 패턴 (영문+숫자 조합, 2~6자) ──────────────────────────
const CODE_RE = /^[A-Z][A-Z0-9]{1,5}$/;

// ─── 섹션 헤더 감지 ──────────────────────────────────────────────
const SECTION_HEADERS = {
  'Paint': '페인트',
  'Tyres': '타이어',
  'Standard equipment': '기본 사양',
  'Special equipment': '선택 사양',
  'Additional equipment': '추가 사양',
  'Equipment overview': '사양 요약',
  'Vehicle description': '차량 정보',
  'Vehicle equipment': '차량 장비',
};

function detectSection(text) {
  if (!text) return null;
  const clean = text.replace(/\s+/g, ' ').trim();
  for (const [en, ko] of Object.entries(SECTION_HEADERS)) {
    if (clean.toLowerCase() === en.toLowerCase()) return { en, ko };
  }
  return null;
}

// ─── Vehicle equipment 기능별 서브섹션 ───────────────────────────
const VEHICLE_EQUIP_SUBSECTIONS = {
  'national version':                       '국가 사양',
  'chassis version':                        '섀시',
  'axle load distribution':                 '축중 배분',
  'engine':                                 '엔진',
  'clutch & transmission':                  '클러치 & 변속기',
  'clutch and transmission':                '클러치 & 변속기',
  'axles & suspension':                     '차축 & 서스펜션',
  'axles and suspension':                   '차축 & 서스펜션',
  'wheels & tyres':                         '휠 & 타이어',
  'wheels and tyres':                       '휠 & 타이어',
  'frame and components attached to frame': '프레임',
  'brake system':                           '브레이크',
  'cab exterior':                           '캡 외장',
  'cab interior':                           '캡 내장',
  'electrics / electronics':                '전기 / 전자',
  'electrics/electronics':                  '전기 / 전자',
  'additional scopes':                      '추가 사항',
};

function detectVehicleSubsection(text) {
  if (!text) return null;
  const lower = text.replace(/\s+/g, ' ').trim().toLowerCase();
  for (const [en, ko] of Object.entries(VEHICLE_EQUIP_SUBSECTIONS)) {
    if (lower === en) return ko;
  }
  return null;
}

// ─── 단락에서 코드+설명 추출 ────────────────────────────────────
// 형식: "\tA1Z\tFront axle, offset version\t"
// 또는: "*\tJK0W\tSecond tank, right"
const EQUIP_LINE_RE = /^\*?\s*([A-Z][A-Z0-9]{1,5})\s{2,}(.+)$/;
const EQUIP_LINE_TAB_RE = /^\*?\s*([A-Z][A-Z0-9]{1,5})\t(.+)$/;

function parseEquipmentLine(text) {
  if (!text) return null;
  const clean = text.replace(/\t/g, '  ').trim();
  const m = clean.match(EQUIP_LINE_RE) || text.trim().match(EQUIP_LINE_TAB_RE);
  if (!m) return null;
  return { code: m[1].trim().toUpperCase(), description: m[2].trim() };
}

// ─── 페인트 코드 추출 ───────────────────────────────────────────
// 형식: "MB 6888\t\tberyll-metallic"
const PAINT_RE = /MB\s+(\d{4})\s+(.+)/;

function parsePaintLine(text) {
  if (!text) return null;
  const clean = text.replace(/\t/g, ' ').trim();
  const m = clean.match(PAINT_RE);
  if (!m) return null;
  return { code: `MB ${m[1]}`.trim(), description: m[2].trim() };
}

// ─── 타이어 코드 추출 ───────────────────────────────────────────
// 형식: "1st Axle: 2 x 315/70 R 22,5  F38LAA 80"
const TYRE_CODE_RE = /([A-Z]\d{2}[A-Z0-9]{1,3})\s+(\d{2})/;

function parseTyreLine(text) {
  if (!text) return null;
  const clean = text.replace(/\t/g, ' ').trim();
  const m = clean.match(TYRE_CODE_RE);
  if (!m) return null;
  return { code: `${m[1]} ${m[2]}`.trim().toUpperCase(), description: clean };
}

// ─── Equipment overview 테이블에서 세미콜론 구분 코드 추출 ──────
function parseEquipmentOverview(table) {
  const codes = { standard: [], special: [], additional: [] };
  let currentSection = null;

  const rows = table.querySelectorAll('tr');
  rows.forEach((row) => {
    const text = row.textContent.trim();
    const lower = text.toLowerCase();

    if (lower.includes('standard equipment')) {
      currentSection = 'standard';
      return;
    }
    if (lower.includes('special equipment')) {
      currentSection = 'special';
      return;
    }
    if (lower.includes('additional equipment')) {
      currentSection = 'additional';
      return;
    }

    if (currentSection && text.length > 2) {
      // "A1Z; A2I; A4K; ..." 형태에서 코드 추출
      const codeList = text.split(/;\s*/).map(c => c.trim()).filter(c => c.length >= 2);
      codes[currentSection].push(...codeList);
    }
  });

  return codes;
}

// ─── 메인 파서 ───────────────────────────────────────────────────
export async function parseDocx(arrayBuffer) {
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const specs = [];
  let modelYear = null;
  let sortIndex = 0;
  let vehicleEquipCount = 0; // Vehicle equipment 섹션에서 추출한 코드 수

  // ── 1단계: 단락 순회하여 섹션별 코드+설명 추출 ──
  let currentSection = null;
  let currentSubsection = null; // Vehicle equipment 내 기능별 서브섹션
  const paragraphs = doc.querySelectorAll('p');

  paragraphs.forEach((p) => {
    const text = p.textContent.trim();
    if (!text) return;

    // Model Year 감지 ("V8X  Model year 7" → MY27)
    if (!modelYear) {
      const myMatch = MY_CODE_RE.exec(text);
      if (myMatch) {
        modelYear = `MY2${myMatch[1]}`;
        if (modelYear.length > 4) modelYear = `MY${myMatch[1].padStart(2, '0')}`;
        else modelYear = `MY2${myMatch[1]}`;
      }
      const my = parseModelYear(text);
      if (my) modelYear = my;
    }

    // 섹션 헤더 감지
    const section = detectSection(text);
    if (section) {
      currentSection = section;
      currentSubsection = null; // 새 섹션 진입 시 서브섹션 초기화
      return;
    }

    // bold 텍스트로 된 섹션 헤더 (예: <p><strong>Paint</strong></p>)
    const strong = p.querySelector('strong');
    if (strong) {
      const sectionFromBold = detectSection(strong.textContent.trim());
      if (sectionFromBold) {
        currentSection = sectionFromBold;
        currentSubsection = null;
        return;
      }
    }

    // 섹션별 코드 추출
    if (!currentSection) return;

    if (currentSection.en === 'Paint') {
      const paint = parsePaintLine(text);
      if (paint) {
        specs.push({
          category: '페인트',
          spec_key: paint.code,
          spec_value: paint.code,
          label_ko: null,
          sort_order: sortIndex++,
          use_translate: true,
          is_color: true,
          is_hidden: false,
        });
      }
    } else if (currentSection.en === 'Tyres') {
      const tyre = parseTyreLine(text);
      if (tyre) {
        specs.push({
          category: '타이어',
          spec_key: tyre.code,
          spec_value: tyre.code,
          label_ko: null,
          sort_order: sortIndex++,
          use_translate: true,
          is_color: false,
          is_hidden: false,
        });
      }
    } else if (currentSection.en === 'Vehicle equipment') {
      // 기능별 서브섹션 헤더 감지 (예: "Engine", "Cab exterior" 등)
      const subsection = detectVehicleSubsection(text);
      if (subsection) {
        currentSubsection = subsection;
        return;
      }
      // bold 텍스트로 된 서브섹션 헤더
      if (strong) {
        const subFromBold = detectVehicleSubsection(strong.textContent.trim());
        if (subFromBold) {
          currentSubsection = subFromBold;
          return;
        }
      }
      // 장비 코드 라인 추출
      const equip = parseEquipmentLine(text);
      if (equip) {
        specs.push({
          category: currentSubsection || '차량 장비',
          spec_key: equip.code,
          spec_value: equip.code,
          label_ko: null,
          sort_order: sortIndex++,
          use_translate: true,
          is_color: false,
          is_hidden: false,
        });
        vehicleEquipCount++;
      }
    } else if (
      currentSection.en === 'Standard equipment' ||
      currentSection.en === 'Special equipment' ||
      currentSection.en === 'Additional equipment'
    ) {
      // Vehicle equipment 섹션에서 이미 코드를 추출했으면 스킵 (중복 방지)
      if (vehicleEquipCount > 0) return;
      const equip = parseEquipmentLine(text);
      if (equip) {
        specs.push({
          category: currentSection.ko,
          spec_key: equip.code,
          spec_value: equip.code,
          label_ko: null,
          sort_order: sortIndex++,
          use_translate: true,
          is_color: false,
          is_hidden: false,
        });
      }
    }
  });

  // ── 2단계: Equipment overview 테이블 (백업) ──
  // 단락 파싱에서 코드를 못 찾은 경우에만 사용
  if (specs.length === 0) {
    const tables = doc.querySelectorAll('table');
    for (const table of tables) {
      const text = table.textContent;
      if (text.includes('Standard equipment') || text.includes('Special equipment')) {
        const codes = parseEquipmentOverview(table);
        const allCodes = [
          ...codes.standard.map(c => ({ code: c, category: '기본 사양' })),
          ...codes.special.map(c => ({ code: c, category: '선택 사양' })),
          ...codes.additional.map(c => ({ code: c, category: '추가 사양' })),
        ];
        allCodes.forEach(({ code, category }) => {
          if (code.length >= 2) {
            specs.push({
              category,
              spec_key: code,
              spec_value: code,
              label_ko: null,
              sort_order: sortIndex++,
              use_translate: true,
              is_color: false,
              is_hidden: false,
            });
          }
        });
        break;
      }
    }
  }

  // ── 3단계: Vehicle description에서 Model Year 재시도 ──
  if (!modelYear) {
    paragraphs.forEach((p) => {
      if (modelYear) return;
      const text = p.textContent.trim();
      const my = parseModelYear(text);
      if (my) modelYear = my;
    });
  }

  // mammoth 내부 경고(예: "An unrecognised element was ignored: w:tblPrEx")는
  // 파싱 결과에 영향이 없어 사용자에게 노이즈이므로 제외한다.
  const warnings = result.messages
    .map((m) => m.message)
    .filter((msg) => !/unrecognised element was ignored/i.test(msg));

  return {
    specs,
    modelYear,
    warnings,
  };
}
