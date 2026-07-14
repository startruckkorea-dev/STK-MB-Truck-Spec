/**
 * codeIndex.js — 코드 사전 매칭 유틸
 *
 * code_dict 에는 두 유형이 섞여 있다:
 *  - 유형 A (대량 사전): code 열=영문 설명, category 열=MB 코드 (예: A0A)
 *  - 유형 B (모델 사양): code 열=MB 코드, name_en=영문 설명
 *
 * 모델 사양값(spec_value)을 번역하려면 두 위치 어디에 있든 MB 코드를 찾아야 한다.
 */

/**
 * category 열 값이 MB 코드 형태인지 판정.
 * MB 코드는 짧은 영숫자(A0A, V1W 등). 한글 카테고리명(엔진/변속기 등)은 제외.
 */
export function isShortCode(v) {
  const s = v == null ? '' : String(v).trim();
  return /^[A-Za-z0-9]{1,8}$/.test(s);
}

/** code_dict 행에서 매칭용 MB 코드를 추출 (정규화: 대문자/trim) */
export function rowMbCode(row) {
  const code = isShortCode(row.category) ? row.category : row.code;
  return String(code || '').trim().toUpperCase();
}

/** 사양값 정규화 (대문자/trim) */
export function normCode(v) {
  return String(v || '').trim().toUpperCase();
}

// ─── KR 커스텀 코드 (KR01~KR99) ─────────────────────────────────
// 견적서(.docx)에 없는 사양을 관리자가 모델에 직접 추가할 때 쓰는 사내 코드.
// code_dict 에만 등록되며 SharePoint 의 견적서 원본 파일은 변경하지 않는다.
export const KR_CODE_RE = /^KR\d{2}$/;
export const KR_CODE_MAX = 99;

export function isKrCode(v) {
  return KR_CODE_RE.test(normCode(v));
}

/** code_dict 에서 아직 쓰지 않은 가장 작은 KR 코드. 전부 소진되면 null */
export function nextKrCode(codeDict) {
  const used = new Set(
    codeDict.map(rowMbCode).filter(isKrCode)
  );
  for (let n = 1; n <= KR_CODE_MAX; n++) {
    const code = `KR${String(n).padStart(2, '0')}`;
    if (!used.has(code)) return code;
  }
  return null;
}

/**
 * 전체 code_dict → { 정규화된_MB코드: row } 인덱스.
 * code 열(모델 사양용)이 category 열보다 우선한다.
 */
export function buildCodeIndex(codeDict) {
  const index = {};
  for (const row of codeDict) {
    const code = String(row.code || '').trim().toUpperCase();
    if (isShortCode(row.category)) {
      const k = String(row.category).trim().toUpperCase();
      if (!index[k]) index[k] = row;
    }
    if (code) index[code] = row; // code 열 우선 (덮어씀)
  }
  return index;
}
