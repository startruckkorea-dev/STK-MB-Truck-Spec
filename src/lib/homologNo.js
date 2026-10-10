/**
 * homologNo.js — 제원관리번호 추출
 *
 * 제원표(자동차제원통보서) PDF 파일명은 제원관리번호로 시작한다.
 *   0365-00133-0020-3025__2851L_6X4 S5F-STK.pdf
 *   → 제원관리번호 036-5-00133-0020-3025
 *      (제작자등록번호 3자리 - 1자리 - 5자리 - 4자리 - 4자리)
 * 모델에 연동된 제원표 링크(homolog_spec_url)의 파일명에서 번호를 뽑아 별도 입력 없이 조회한다.
 */

const NO_RE = /(\d{3})(\d)-(\d{5})-(\d{4})-(\d{4})/;

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return String(s);
  }
}

/** 제원표 URL(또는 파일명) → 제원관리번호 `036-5-00133-0020-3025`, 없으면 null */
export function parseHomologNo(urlOrName) {
  if (!urlOrName) return null;
  const m = safeDecode(urlOrName).match(NO_RE);
  return m ? m.slice(1).join('-') : null;
}

/** 제원표 URL → 표시용 파일명 */
export function homologFileName(url) {
  if (!url) return '';
  const clean = safeDecode(url).split(/[?#]/)[0];
  return clean.split('/').pop() || '';
}
