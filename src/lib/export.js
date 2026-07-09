import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// ─── 디자인 토큰 (라이트 테마) ──────────────────────────────────
const MB_BLUE = { argb: 'FF00ADEF' };
const WHITE = { argb: 'FFFFFFFF' };
const BLACK = { argb: 'FF1A1A1A' };
const GRAY_50 = { argb: 'FFF9FAFB' };
const GRAY_100 = { argb: 'FFF3F4F6' };
const GRAY_200 = { argb: 'FFE5E7EB' };
const GRAY_500 = { argb: 'FF6B7280' };
const DIFF_BG = { argb: 'FFDBEAFE' }; // 연한 파란색 하이라이트

const FONT_BODY = 'Noto Sans KR';
const FONT_CODE = 'Roboto Mono';

const THIN_BORDER = { style: 'thin', color: GRAY_200 };
const CELL_BORDER = { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER };

// ─── Excel 공통 스타일 헬퍼 ─────────────────────────────────────

function applyTitleRow(ws, text, colCount) {
  const row = ws.addRow([text]);
  row.height = 32;
  ws.mergeCells(row.number, 1, row.number, colCount);
  const cell = row.getCell(1);
  cell.font = { name: FONT_BODY, size: 14, bold: true, color: BLACK };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: WHITE };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  cell.border = CELL_BORDER;
}

function applySubtitleRow(ws, text, colCount) {
  const row = ws.addRow([text]);
  row.height = 16;
  ws.mergeCells(row.number, 1, row.number, colCount);
  const cell = row.getCell(1);
  cell.font = { name: FONT_BODY, size: 8, color: GRAY_500 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: WHITE };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
}

function applyHeaderRow(ws, values) {
  const row = ws.addRow(values);
  let maxLines = 1;
  row.eachCell((cell, colNumber) => {
    cell.font = { name: FONT_BODY, size: 10, bold: true, color: WHITE };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: MB_BLUE };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = CELL_BORDER;
    const lines = estimateLines(String(cell.value || ''), ws.getColumn(colNumber).width || 20);
    if (lines > maxLines) maxLines = lines;
  });
  row.height = Math.max(26, maxLines * 18);
  return row;
}

function applyCategoryRow(ws, text, colCount) {
  const row = ws.addRow([text]);
  row.height = 24;
  ws.mergeCells(row.number, 1, row.number, colCount);
  const cell = row.getCell(1);
  cell.font = { name: FONT_BODY, size: 10, bold: true, color: BLACK };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: GRAY_100 };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  cell.border = CELL_BORDER;
}

function applyDataRow(ws, values, { highlight = false, even = false } = {}) {
  const row = ws.addRow(values);
  const bg = highlight ? DIFF_BG : even ? GRAY_50 : WHITE;
  let maxLines = 1;

  row.eachCell((cell, colNumber) => {
    cell.font = {
      name: colNumber === 1 ? FONT_BODY : FONT_CODE,
      size: 9,
      color: BLACK,
    };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: bg };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
    cell.border = CELL_BORDER;

    const lines = estimateLines(String(cell.value || ''), ws.getColumn(colNumber).width || 20);
    if (lines > maxLines) maxLines = lines;
  });

  row.height = Math.max(22, maxLines * 16);
  return row;
}

/**
 * 텍스트가 셀 안에서 몇 줄로 래핑되는지 추정
 * Excel 열 너비 단위 = 기본 폰트 기준 영문 글자 수
 * 한글/CJK는 2글자분, 영문/숫자/기호는 1글자분으로 계산
 * indent(1) + padding 등으로 실제 사용 가능 너비를 줄여서 계산
 */
function estimateLines(text, colWidth) {
  if (!text) return 1;
  // 실제 사용 가능 너비 (indent, padding 감안하여 보수적으로)
  const usableWidth = Math.max(colWidth - 4, 4);
  const segments = text.split(/\n/);
  let totalLines = 0;
  for (const seg of segments) {
    let used = 0;
    let lines = 1;
    for (const ch of seg) {
      // 한글/CJK/전각 = 2단위, 그 외 = 1단위
      const w = /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/.test(ch) ? 2 : 1;
      used += w;
      if (used > usableWidth) {
        lines++;
        used = w;
      }
    }
    totalLines += lines;
  }
  return totalLines;
}

function finalizeSheet(ws) {
  ws.eachRow((row) => {
    for (let c = 1; c <= ws.columnCount; c++) {
      const cell = row.getCell(c);
      if (!cell.fill || !cell.fill.fgColor) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: WHITE };
      }
      if (!cell.border) cell.border = CELL_BORDER;
    }
  });
}

// ─── 로고 (문서 상단 중앙) ──────────────────────────────────────
const LOGO_URL = '/star-logo.png';

// PNG 를 base64 로 1회 로드 (Excel addImage 용). 실패 시 null.
let logoBase64Promise = null;
function getLogoBase64() {
  if (!logoBase64Promise) {
    logoBase64Promise = fetch(LOGO_URL)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('logo'))))
      .then(
        (blob) =>
          new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result).split(',')[1]);
            fr.onerror = reject;
            fr.readAsDataURL(blob);
          })
      )
      .catch(() => null);
  }
  return logoBase64Promise;
}

// 목표 X(px)가 어느 열의 몇 % 지점인지 → ExcelJS tl.col 용 소수 컬럼 인덱스
function pxToColOffset(widthsPx, x) {
  let col = 0;
  let acc = 0;
  while (col < widthsPx.length && acc + widthsPx[col] <= x) {
    acc += widthsPx[col];
    col++;
  }
  const frac = col < widthsPx.length ? (x - acc) / widthsPx[col] : 0;
  return col + frac;
}

// 시트 최상단 중앙에 정사각형 로고 삽입 (columns 설정 후 호출)
async function addExcelLogo(wb, ws) {
  const base64 = await getLogoBase64();
  if (!base64) return;
  const imageId = wb.addImage({ base64, extension: 'png' });
  const sizePx = 60;
  const logoRow = ws.addRow([]);
  logoRow.height = 50; // pt — 60px 로고 수용
  const widthsPx = ws.columns.map((c) => (c.width || 10) * 7);
  const totalPx = widthsPx.reduce((a, b) => a + b, 0);
  const leftX = Math.max(0, (totalPx - sizePx) / 2);
  ws.addImage(imageId, {
    tl: { col: pxToColOffset(widthsPx, leftX), row: logoRow.number - 1 + 0.05 },
    ext: { width: sizePx, height: sizePx },
    editAs: 'oneCell',
  });
  ws.addRow([]); // 로고와 타이틀 사이 여백
}

// CONFIDENTIAL 표기 — 화면 상단에 붉은 텍스트 1행 + 인쇄 시 모든 페이지 우상단 머리글
function applyConfidential(ws, colCount) {
  // 인쇄용: 모든 페이지 우측 머리글에 붉은 굵은 글씨
  ws.headerFooter.oddHeader = '&R&KD40000&"-,Bold"CONFIDENTIAL';
  ws.headerFooter.evenHeader = '&R&KD40000&"-,Bold"CONFIDENTIAL';

  // 화면 표시용: 상단 붉은 텍스트 1행 (우측 정렬)
  const row = ws.addRow(['CONFIDENTIAL']);
  row.height = 18;
  ws.mergeCells(row.number, 1, row.number, colCount);
  const cell = row.getCell(1);
  cell.font = { name: FONT_BODY, size: 11, bold: true, color: { argb: 'FFD40000' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: WHITE };
  cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
  cell.border = {}; // finalizeSheet 의 기본 테두리 적용 제외
}

async function saveWorkbook(wb, filename) {
  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

// ═══════════════════════════════════════════════════════════════
//  사양 상세 — Excel
// ═══════════════════════════════════════════════════════════════

function modelFullName(m) {
  return `${m.series} ${m.code}${m.axle ? ` ${m.axle}` : ''}${m.cabin ? ` ${m.cabin}` : ''}`;
}

export async function exportDetailToExcel(model, specs, dict, notes = [], language = 'ko', canViewCodes = true) {
  const title = `${modelFullName(model)} (${model.model_year})`;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(title.slice(0, 31));

  const visibleSpecs = specs.filter(
    (s) => !s.is_hidden && (canViewCodes || rowVisibleForSales(s, dict, language))
  );
  const groups = groupByCategory(visibleSpecs);

  // 항목/값 2열 고정 (코드는 항목 칸에 함께 표기하므로 별도 코드 열 없음)
  const colCount = 2;
  ws.columns = [{ width: 40 }, { width: 46 }];

  // 기밀 표기 (상단 + 인쇄 머리글)
  applyConfidential(ws, colCount);

  // 로고 (상단 중앙)
  await addExcelLogo(wb, ws);

  // 타이틀
  applyTitleRow(ws, title, colCount);
  const dateStr = new Date().toLocaleDateString('ko-KR');
  applySubtitleRow(ws, `생성일: ${dateStr}`, colCount);
  ws.addRow([]); // 빈 줄

  // 보충 설명
  if (notes.length > 0) {
    applyCategoryRow(ws, '보충 설명', colCount);
    applyHeaderRow(ws, ['항목', '내용']);
    notes.forEach((note, i) => {
      applyDataRow(ws, [note.label, note.content], { even: i % 2 === 0 });
    });
    ws.addRow([]);
  }

  // 사양 데이터 (영업직원은 영문 코드만 남는 행 제외)
  applyHeaderRow(ws, ['항목', '값']);
  groups.forEach(({ category, items }) => {
    applyCategoryRow(ws, category, colCount);
    items.forEach((spec, i) => {
      const translated = resolveValue(spec, dict, language, canViewCodes);
      applyDataRow(ws, [labelWithCode(spec, canViewCodes), translated], { even: i % 2 === 0 });
    });
  });

  finalizeSheet(ws);
  const suffix = language === 'en' ? '_EN' : '';
  await saveWorkbook(wb, `${sanitizeFilename(title)}${suffix}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════
//  사양 상세 — PDF (브라우저 인쇄)
// ═══════════════════════════════════════════════════════════════

export function exportDetailToPDF(model, specs, dict, notes = [], language = 'ko', canViewCodes = true, userEmail = '') {
  const title = `${modelFullName(model)} (${model.model_year})`;
  const visibleSpecs = specs.filter(
    (s) => !s.is_hidden && (canViewCodes || rowVisibleForSales(s, dict, language))
  );
  const groups = groupByCategory(visibleSpecs);

  let notesHtml = '';
  if (notes.length > 0) {
    notesHtml = `
      <div class="category">보충 설명</div>
      <table>
        <colgroup><col style="width:35%"><col></colgroup>
        <tbody>
          ${notes.map((n, i) => `<tr class="${i % 2 === 0 ? 'even' : ''}"><td>${esc(n.label)}</td><td>${esc(n.content)}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
  }

  // 항목/값 2열 고정 (코드는 항목 칸에 함께 표기하므로 별도 코드 열 없음)
  const specsHtml = groups.map(({ category, items }) => `
    <div class="category">${esc(category)}</div>
    <table>
      <colgroup><col style="width:35%"><col></colgroup>
      <tbody>
        ${items.map((spec, i) => {
          const translated = resolveValue(spec, dict, language, canViewCodes);
          return `
          <tr class="${i % 2 === 0 ? 'even' : ''}">
            <td>${esc(labelWithCode(spec, canViewCodes))}</td>
            <td>${esc(translated)}</td>
          </tr>
        `;
        }).join('')}
      </tbody>
    </table>
  `).join('');

  openPrintWindow(title, notesHtml + specsHtml, { userEmail });
}

// ═══════════════════════════════════════════════════════════════
//  비교 — Excel
// ═══════════════════════════════════════════════════════════════

export async function exportCompareToExcel(models, specsMap, dict, notesMap = {}, showDiffOnly = false, language = 'ko', canViewCodes = true) {
  const allKeys = buildAllKeys(models, specsMap, dict);
  const diffSet = showDiffOnly ? buildDiffSet(allKeys, models, specsMap, dict, language, canViewCodes) : null;

  const wb = new ExcelJS.Workbook();
  const sheetName = `비교_${models.map((m) => m.code).join('_')}`.slice(0, 31);
  const ws = wb.addWorksheet(sheetName);

  const colCount = 1 + models.length;
  ws.columns = [
    { width: 32 },
    ...models.map(() => ({ width: 30 })),
  ];

  // 기밀 표기 (상단 + 인쇄 머리글)
  applyConfidential(ws, colCount);

  // 로고 (상단 중앙)
  await addExcelLogo(wb, ws);

  // 타이틀
  const titleText = models.map((m) => modelFullName(m)).join(' vs ');
  applyTitleRow(ws, `모델 비교: ${titleText}`, colCount);
  applySubtitleRow(ws, `생성일: ${new Date().toLocaleDateString('ko-KR')}`, colCount);
  ws.addRow([]);

  // 보충 설명
  const hasNotes = models.some((m) => (notesMap[m.id] ?? []).length > 0);
  if (hasNotes) {
    applyCategoryRow(ws, '보충 설명', colCount);
    applyHeaderRow(ws, ['항목', ...models.map((m) => modelFullName(m))]);
    const maxNotes = Math.max(...models.map((m) => (notesMap[m.id] ?? []).length));
    for (let i = 0; i < maxNotes; i++) {
      const label = models.map((m) => (notesMap[m.id] ?? [])[i]?.label).find(Boolean) || '';
      const vals = models.map((m) => {
        const note = (notesMap[m.id] ?? [])[i];
        return note ? note.content : '';
      });
      applyDataRow(ws, [label, ...vals], { even: i % 2 === 0 });
    }
    ws.addRow([]);
  }

  // 헤더
  applyHeaderRow(ws, ['항목', ...models.map((m) => `${modelFullName(m)}\n(${m.model_year})`)]);

  const renderRows = buildRenderRows(allKeys, diffSet);
  let rowIndex = 0;
  renderRows.forEach((row) => {
    if (row.type === 'category') {
      applyCategoryRow(ws, row.category, colCount);
      rowIndex = 0;
      return;
    }

    const values = models.map((m) => {
      const specs = specsMap[m.id] ?? [];
      const spec = specs.find((s) => s.spec_key === row.spec_key);
      if (!spec) return '—';
      return resolveValue(spec, dict, language, canViewCodes);
    });

    // 영업직원: 라벨도 없고 값도 전부 비면 영문 코드뿐이던 행 → 건너뜀
    if (!canViewCodes && !row.labelKo && values.every((v) => !v || v === '—')) return;

    const uniqueVals = new Set(values.filter((v) => v !== '—'));
    const hasAbsent = values.some((v) => v === '—');
    const isDiff = uniqueVals.size > 1 || (hasAbsent && uniqueVals.size > 0);

    applyDataRow(ws, [resolveLabel(row.labelKo, row.spec_key, canViewCodes), ...values], {
      highlight: isDiff,
      even: rowIndex % 2 === 0,
    });
    rowIndex++;
  });

  finalizeSheet(ws);
  const suffix = language === 'en' ? '_EN' : '';
  await saveWorkbook(wb, `${sanitizeFilename(sheetName)}${suffix}.xlsx`);
}

// ═══════════════════════════════════════════════════════════════
//  비교 — PDF (브라우저 인쇄)
// ═══════════════════════════════════════════════════════════════

export function exportCompareToPDF(models, specsMap, dict, notesMap = {}, showDiffOnly = false, language = 'ko', canViewCodes = true, userEmail = '') {
  const allKeys = buildAllKeys(models, specsMap, dict);
  const diffSet = showDiffOnly ? buildDiffSet(allKeys, models, specsMap, dict, language, canViewCodes) : null;

  const title = `모델 비교: ${models.map((m) => modelFullName(m)).join(' vs ')}`;
  const modelHeaders = models.map((m) => `<th>${esc(modelFullName(m))}<br><small>${m.model_year}</small></th>`).join('');

  // 모든 비교 테이블이 동일한 열 너비를 갖도록 고정 colgroup (항목 25% + 모델 균등)
  const modelColW = (75 / models.length).toFixed(3);
  const colgroupHtml = `<colgroup><col style="width:25%">${models.map(() => `<col style="width:${modelColW}%">`).join('')}</colgroup>`;

  // 사양 행 하나를 <tr> 문자열로 렌더 (없으면 '')
  const renderSpecRow = (row, rowIdx) => {
    const values = models.map((m) => {
      const specs = specsMap[m.id] ?? [];
      const spec = specs.find((s) => s.spec_key === row.spec_key);
      if (!spec) return '—';
      return resolveValue(spec, dict, language, canViewCodes);
    });

    // 영업직원: 라벨도 없고 값도 전부 비면 영문 코드뿐이던 행 → 건너뜀
    if (!canViewCodes && !row.labelKo && values.every((v) => !v || v === '—')) return '';

    const uniqueVals = new Set(values.filter((v) => v !== '—'));
    const hasAbsent = values.some((v) => v === '—');
    const isDiff = uniqueVals.size > 1 || (hasAbsent && uniqueVals.size > 0);

    const cells = values.map((v) => `<td>${esc(v)}</td>`).join('');
    return `<tr class="${isDiff ? 'diff' : ''} ${rowIdx % 2 === 0 ? 'even' : ''}"><td>${esc(resolveLabel(row.labelKo, row.spec_key, canViewCodes))}</td>${cells}</tr>`;
  };

  // 보충 설명
  let notesHtml = '';
  const hasNotes = models.some((m) => (notesMap[m.id] ?? []).length > 0);
  if (hasNotes) {
    const maxNotes = Math.max(...models.map((m) => (notesMap[m.id] ?? []).length));
    let noteRows = '';
    for (let i = 0; i < maxNotes; i++) {
      const label = models.map((m) => (notesMap[m.id] ?? [])[i]?.label).find(Boolean) || '';
      const cells = models.map((m) => {
        const note = (notesMap[m.id] ?? [])[i];
        return `<td>${esc(note ? note.content : '—')}</td>`;
      }).join('');
      noteRows += `<tr class="${i % 2 === 0 ? 'even' : ''}"><td>${esc(label)}</td>${cells}</tr>`;
    }
    notesHtml = `
      <div class="category">보충 설명</div>
      <table>${colgroupHtml}<thead><tr><th>항목</th>${modelHeaders}</tr></thead>
      <tbody>${noteRows}</tbody></table>
    `;
  }

  // 사양 테이블
  let specsHtml = '';
  if (showDiffOnly) {
    // 차이점만 보기: 카테고리 그룹 없이 코드(spec_key) A→Z 로 평면 정렬한 단일 표
    const diffRows = buildRenderRows(allKeys, diffSet);
    let tableRows = '';
    let rowIdx = 0;
    diffRows.forEach((row) => {
      const tr = renderSpecRow(row, rowIdx);
      if (tr) { tableRows += tr; rowIdx++; }
    });
    if (tableRows) {
      specsHtml = `
        <table>${colgroupHtml}<thead><tr><th>항목</th>${modelHeaders}</tr></thead>
        <tbody>${tableRows}</tbody></table>
      `;
    }
  } else {
    // 전체 보기: 카테고리별 표
    let currentCategory = '';
    let tableRows = '';
    let rowIdx = 0;

    const flushTable = () => {
      if (!tableRows) return;
      specsHtml += `
        <div class="category">${esc(currentCategory)}</div>
        <table>${colgroupHtml}<thead><tr><th>항목</th>${modelHeaders}</tr></thead>
        <tbody>${tableRows}</tbody></table>
      `;
      tableRows = '';
    };

    allKeys.forEach((row) => {
      if (row.type === 'category') {
        flushTable();
        currentCategory = row.category;
        rowIdx = 0;
        return;
      }
      const tr = renderSpecRow(row, rowIdx);
      if (tr) { tableRows += tr; rowIdx++; }
    });
    flushTable();
  }

  openPrintWindow(title, notesHtml + specsHtml, { landscape: models.length > 2, userEmail });
}

// ═══════════════════════════════════════════════════════════════
//  PDF 인쇄 윈도우
// ═══════════════════════════════════════════════════════════════

function openPrintWindow(title, bodyHtml, { landscape = false, userEmail = '' } = {}) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) {
    alert('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
    return;
  }

  // ── 페이지 크기/여백 (mm) ──
  const MARGIN_MM = 10;   // @page 여백
  const HEADER_MM = 20;   // 각 페이지 상단 머리글 밴드
  const FOOTER_MM = 9;    // 각 페이지 하단 바닥글 밴드
  const pageWmm = landscape ? 297 : 210;
  const pageHmm = landscape ? 210 : 297;
  const printableHmm = pageHmm - 2 * MARGIN_MM;
  const contentHmm = printableHmm - HEADER_MM - FOOTER_MM;
  const contentWmm = pageWmm - 2 * MARGIN_MM;
  const MMPX = 96 / 25.4;
  const contentWpx = Math.round(contentWmm * MMPX);
  const contentHpx = Math.floor(contentHmm * MMPX) - 16; // 안전 여유 (page-body 상단 패딩 10px + 반올림)

  const dateStr = new Date().toLocaleDateString('ko-KR');
  const dateLine = '생성일: ' + dateStr + (userEmail ? ' · 출력자: ' + esc(userEmail) : '');
  const logoSrc = window.location.origin + LOGO_URL;

  w.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&family=Roboto+Mono:wght@400&display=swap');

  @page { size: A4${landscape ? ' landscape' : ''}; margin: ${MARGIN_MM}mm; }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Noto Sans KR', sans-serif;
    color: #1a1a1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── 페이지 컨테이너 (JS 페이지네이터가 채운다) ── */
  .page {
    width: 100%;
    height: ${printableHmm}mm;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    break-before: page;
    page-break-before: always;
  }
  .page:first-child { break-before: auto; page-break-before: auto; }

  .page-header {
    flex: 0 0 ${HEADER_MM}mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-bottom: 3px solid #00ADEF;
    padding-bottom: 6px;
  }
  .ph-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .ph-logo { height: 34px; width: auto; flex: 0 0 auto; }
  .ph-title { font-size: 15px; font-weight: 700; color: #1a1a1a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ph-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: 0 0 auto; }
  .ph-conf { color: #d40000; border: 2px solid #d40000; border-radius: 4px; padding: 1px 8px; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; }
  .ph-date { font-size: 10px; color: #6b7280; white-space: nowrap; }

  .page-body { flex: 1 1 auto; overflow: hidden; padding-top: 10px; }

  .page-footer {
    flex: 0 0 ${FOOTER_MM}mm;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    border-top: 1px solid #e5e7eb;
    padding-top: 4px;
    font-size: 9px;
    color: #9ca3af;
  }
  .pf-left { justify-self: start; font-weight: 600; color: #6b7280; letter-spacing: .5px; }
  .pf-num { justify-self: center; color: #4b5563; font-variant-numeric: tabular-nums; }

  .category {
    font-family: 'Noto Sans KR', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: #1a1a1a;
    background: #f3f4f6;
    padding: 8px 14px;
    margin-top: 16px;
    border: 1px solid #e5e7eb;
    border-bottom: none;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin-bottom: 12px;
    font-size: 11px;
  }
  thead th {
    background: #00ADEF;
    color: #fff;
    font-family: 'Noto Sans KR', sans-serif;
    font-weight: 600;
    font-size: 11px;
    padding: 8px 12px;
    text-align: left;
    border: 1px solid #e5e7eb;
  }
  tbody td {
    padding: 7px 12px;
    border: 1px solid #e5e7eb;
    color: #1a1a1a;
    vertical-align: top;
    line-height: 1.5;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  tbody tr { background: #fff; }
  tbody tr.even { background: #f9fafb; }
  tbody tr.diff { background: #dbeafe; }
  tbody tr.diff td { color: #1e40af; }
  td.code, .code { font-family: 'Roboto Mono', monospace; font-size: 10px; color: #4b5563; }

  .toolbar { text-align: center; padding: 16px; }

  @media screen {
    body { background: #e5e7eb; }
    #pages { width: ${pageWmm}mm; margin: 0 auto; }
    .page { background: #fff; height: ${pageHmm}mm; padding: ${MARGIN_MM}mm; margin: 0 auto 16px; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
  }
  @media print {
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="no-print toolbar">
    <button onclick="window.print()" style="
      background:#00ADEF;color:#fff;border:none;padding:10px 32px;
      border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;
      font-family:'Noto Sans KR',sans-serif;
    ">PDF 저장 / 인쇄</button>
    <span style="color:#6b7280;font-size:12px;margin-left:12px;">
      인쇄 대화상자에서 "PDF로 저장"을 선택하세요
    </span>
  </div>
  <div id="doc">${bodyHtml}</div>
  <div id="pages"></div>
<script>
(function(){
  var LANDSCAPE = ${landscape ? 'true' : 'false'};
  var TITLE = ${JSON.stringify(esc(title))};
  var DATELINE = ${JSON.stringify(esc(dateLine))};
  var LOGO_SRC = ${JSON.stringify(logoSrc)};
  var CONTENT_W = ${contentWpx};
  var CONTENT_H = ${contentHpx};

  function run(){
    try {
      var pages = document.getElementById('pages');
      var doc = document.getElementById('doc');
      // 실제 인쇄 폭으로 측정
      doc.style.position = 'absolute';
      doc.style.left = '-99999px';
      doc.style.top = '0';
      doc.style.width = CONTENT_W + 'px';

      var blocks = Array.prototype.slice.call(doc.children);
      var cur = null, used = 0, footers = [];

      function makeHeader(){
        var h = document.createElement('div'); h.className = 'page-header';
        h.innerHTML =
          '<div class="ph-left"><img class="ph-logo" src="' + LOGO_SRC + '"><span class="ph-title">' + TITLE + '</span></div>' +
          '<div class="ph-right"><div class="ph-conf">CONFIDENTIAL</div><div class="ph-date">' + DATELINE + '</div></div>';
        return h;
      }
      function makeFooter(){
        var f = document.createElement('div'); f.className = 'page-footer';
        f.innerHTML = '<div class="pf-left">Star Truck Korea</div><div class="pf-num"></div><div class="pf-right"></div>';
        return f;
      }
      function newPage(){
        var p = document.createElement('div'); p.className = 'page';
        var b = document.createElement('div'); b.className = 'page-body';
        var f = makeFooter();
        p.appendChild(makeHeader()); p.appendChild(b); p.appendChild(f);
        pages.appendChild(p); footers.push(f); cur = b; used = 0; return b;
      }
      function makeFrag(src){
        var t = document.createElement('table'); t.className = src.className;
        var cg = src.querySelector('colgroup'); if (cg) t.appendChild(cg.cloneNode(true));
        var th = src.querySelector('thead'); if (th) t.appendChild(th.cloneNode(true));
        t.appendChild(document.createElement('tbody'));
        return t;
      }
      function outerH(el){
        var r = el.getBoundingClientRect();
        var s = window.getComputedStyle(el);
        return r.height + (parseFloat(s.marginTop) || 0) + (parseFloat(s.marginBottom) || 0);
      }

      newPage();

      for (var bi = 0; bi < blocks.length; bi++){
        var block = blocks[bi];
        if (block.tagName !== 'TABLE'){
          // 카테고리 등 일반 블록 — 뒤따르는 표의 머리글+첫 행과 함께 유지
          var bh = outerH(block);
          var need = bh;
          var nxt = blocks[bi + 1];
          if (nxt && nxt.tagName === 'TABLE'){
            var nth = nxt.querySelector('thead');
            var ntb = nxt.querySelector('tbody');
            var r0 = ntb && ntb.rows[0];
            need += (nth ? nth.getBoundingClientRect().height : 0) + (r0 ? r0.getBoundingClientRect().height : 0);
          }
          if (used > 0 && used + need > CONTENT_H) newPage();
          cur.appendChild(block.cloneNode(true));
          used += bh;
        } else {
          var thead = block.querySelector('thead');
          var headH = thead ? thead.getBoundingClientRect().height : 0;
          var tbody = block.querySelector('tbody');
          var rows = tbody ? Array.prototype.slice.call(tbody.rows) : [];
          var frag = null;
          for (var ri = 0; ri < rows.length; ri++){
            var row = rows[ri];
            var rh = row.getBoundingClientRect().height;
            if (frag === null){
              if (used > 0 && used + headH + rh > CONTENT_H) newPage();
              frag = makeFrag(block); cur.appendChild(frag); used += headH;
            } else if (used + rh > CONTENT_H){
              newPage(); frag = makeFrag(block); cur.appendChild(frag); used += headH;
            }
            frag.tBodies[0].appendChild(row.cloneNode(true));
            used += rh;
          }
          if (frag) used += 12; // 표 하단 여백
        }
      }

      var total = pages.children.length;
      for (var i = 0; i < footers.length; i++){
        footers[i].querySelector('.pf-num').textContent = (i + 1) + ' / ' + total;
      }
      doc.parentNode.removeChild(doc);
    } catch (e){
      // 폴백: 페이지네이션 실패 시 원본을 그대로 노출
      var d = document.getElementById('doc');
      var p = document.getElementById('pages');
      if (d){ d.style.position = ''; d.style.left = ''; d.style.top = ''; d.style.width = ''; }
      if (p && p.parentNode) p.parentNode.removeChild(p);
      if (window.console) console.error('pagination failed', e);
    }
  }

  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(run); }
  else { window.addEventListener('load', run); }
})();
</script>
</body>
</html>`);
  w.document.close();
}

// ═══════════════════════════════════════════════════════════════
//  공통 헬퍼
// ═══════════════════════════════════════════════════════════════

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 사양값 → 표시 문자열.
// canViewCodes=false(영업직원)는 번역이 없을 때 영문 코드로 폴백하지 않고 ''.
function resolveValue(spec, dict, language = 'ko', canViewCodes = true) {
  if (!spec.use_translate) return spec.spec_value || '';
  const entry = dict[(spec.spec_value || '').trim().toUpperCase()];
  if (language === 'en') return entry?.name_en || (canViewCodes ? spec.spec_value || '' : '');
  if (!entry) return canViewCodes ? spec.spec_value || '' : '';
  return entry.name_ko || (canViewCodes ? spec.spec_value : '') || '';
}

// 항목명: 국문 라벨 우선, 없으면 admin/staff 는 영문 코드, 영업직원은 ''.
function resolveLabel(labelKo, specKey, canViewCodes = true) {
  return labelKo || (canViewCodes ? specKey || '' : '');
}

// 사양 상세 "항목" 칸 값 (별도 코드 열 없이 항목 칸에 코드까지 담는다).
// - 국문 라벨이 없으면 라벨 = 코드(spec_key) 이므로 그대로 코드가 표시된다.
// - 국문 라벨이 있고 코드 열람 권한이 있으면 "라벨 (코드)" 로 코드를 함께 표기.
// - 코드 숨김(영업직원/코드숨김 출력)일 때는 코드를 덧붙이지 않는다.
function labelWithCode(spec, canViewCodes = true) {
  const label = resolveLabel(spec.label_ko, spec.spec_key, canViewCodes);
  if (!canViewCodes || !spec.label_ko) return label;
  const code = spec.spec_value || '';
  return code && code !== label ? `${label} (${code})` : label;
}

// 영업직원에게 보여줄 내용이 있는 행인지 (라벨도 번역값도 없으면 영문 코드뿐 → 숨김)
function rowVisibleForSales(spec, dict, language = 'ko') {
  if (dict[(spec.spec_value || '').trim().toUpperCase()]?.is_hidden) return false;
  if (spec.label_ko) return true;
  return !!resolveValue(spec, dict, language, false);
}

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

function groupByCategory(specs) {
  const map = new Map();
  for (const spec of specs) {
    const cat = spec.category || '기타';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(spec);
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
}

function buildAllKeys(models, specsMap, dict) {
  const categoryOrder = [];
  const keysByCategory = new Map();
  models.forEach((m) => {
    const specs = specsMap[m.id] ?? [];
    specs.forEach((spec) => {
      if (spec.is_hidden || dict[(spec.spec_value || '').trim().toUpperCase()]?.is_hidden) return;
      const cat = spec.category || '기타';
      if (!keysByCategory.has(cat)) {
        keysByCategory.set(cat, new Map());
        categoryOrder.push(cat);
      }
      const keyMap = keysByCategory.get(cat);
      if (!keyMap.has(spec.spec_key)) {
        keyMap.set(spec.spec_key, { spec_key: spec.spec_key, labelKo: spec.label_ko, sort_order: spec.sort_order });
      }
    });
  });
  const result = [];
  categoryOrder.forEach((cat) => {
    result.push({ type: 'category', category: cat });
    const keys = Array.from(keysByCategory.get(cat).values()).sort((a, b) => a.sort_order - b.sort_order);
    keys.forEach((k) => result.push({ type: 'spec', category: cat, ...k }));
  });
  return result;
}

// 렌더링할 행 목록.
// - 전체 보기(diffSet 없음): 카테고리 헤더 + 사양행을 원래 순서대로.
// - 차이점만 보기(diffSet 있음): 카테고리 그룹 없이, 차이 나는 사양행만
//   코드(spec_key) A→Z 오름차순 평면 정렬.
function buildRenderRows(allKeys, diffSet) {
  if (!diffSet) return allKeys;
  return allKeys
    .filter((r) => r.type === 'spec' && diffSet.specKeys.has(r.spec_key))
    .sort((a, b) => String(a.spec_key || '').localeCompare(String(b.spec_key || '')));
}

function buildDiffSet(allKeys, models, specsMap, dict, language = 'ko', canViewCodes = true) {
  const specKeys = new Set();
  const categories = new Set();
  allKeys.forEach((row) => {
    if (row.type !== 'spec') return;
    const vals = models.map((m) => {
      const specs = specsMap[m.id] ?? [];
      const spec = specs.find((s) => s.spec_key === row.spec_key);
      if (!spec) return null;
      return resolveValue(spec, dict, language, canViewCodes);
    });
    const unique = new Set(vals.filter(Boolean));
    const hasAbsent = vals.some((v) => v === null);
    if (unique.size > 1 || (hasAbsent && unique.size > 0)) {
      specKeys.add(row.spec_key);
      categories.add(row.category);
    }
  });
  return { specKeys, categories };
}
