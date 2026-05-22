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
