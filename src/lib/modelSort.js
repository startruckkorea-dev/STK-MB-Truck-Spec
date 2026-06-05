/**
 * modelSort.js — 모델 표시 순서 비교 함수 (단일 소스)
 *
 * useModels(화면 표시)와 DataContext(순서 이동 저장)가 같은 순서를 쓰도록
 * 공유한다. `sort_order` 가 지정된 모델이 1순위, 미지정 모델은 그 뒤로
 * model_year(내림차순) → series → code 순서로 정렬한다.
 */

function hasOrder(v) {
  return v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v));
}

export function compareModels(a, b) {
  const aHas = hasOrder(a.sort_order);
  const bHas = hasOrder(b.sort_order);
  if (aHas && bHas) {
    const d = Number(a.sort_order) - Number(b.sort_order);
    if (d !== 0) return d;
  } else if (aHas !== bHas) {
    return aHas ? -1 : 1; // 순서 지정된 모델을 먼저
  }
  // 미지정(또는 동점) → 연식 내림차순, 시리즈, 코드
  const y = String(b.model_year || '').localeCompare(String(a.model_year || ''));
  if (y !== 0) return y;
  const s = String(a.series || '').localeCompare(String(b.series || ''));
  if (s !== 0) return s;
  return String(a.code || '').localeCompare(String(b.code || ''));
}
