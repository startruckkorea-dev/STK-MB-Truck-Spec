/**
 * mergeRows.js — 표의 "같은 값 세로 병합" 공용 유틸
 *
 * 모델 목록·색상코드·제원관리번호·모델 관리 표가 같은 규칙으로
 * 차종분류 → 시리즈 → 모델코드 → 축 → 캐빈 을 병합한다.
 * (앞 단계 값이 모두 같을 때만 다음 단계를 병합)
 */

// 차종 정렬 우선순위 (목록에 없는 차종은 뒤로, 가나다순)
export const BODY_TYPE_ORDER = ['트랙터', '카고', '덤프'];

/** [[차종, ...], ...] 엔트리 배열을 차종 우선순위로 정렬 */
export function sortBodyTypes(entries) {
  return entries.sort(([a], [b]) => {
    const ia = BODY_TYPE_ORDER.indexOf(a);
    const ib = BODY_TYPE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return String(a).localeCompare(String(b));
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// 모델 기준 병합 단계 (차종분류, 시리즈, 모델코드, 축, 캐빈)
export const MODEL_MERGE_LEVELS = [
  (m) => m.name_ko || '',
  (m) => m.series || '',
  (m) => m.code || '',
  (m) => m.axle || '',
  (m) => m.cabin || '',
];

/** 행(item) → 모델 접근자를 받아 모델 병합 단계를 행 기준 함수로 변환 */
export function modelLevels(get = (x) => x) {
  return MODEL_MERGE_LEVELS.map((f) => (item) => f(get(item)));
}

/**
 * 같은 값끼리 붙어 있도록 계층 정렬한다.
 * 차종은 BODY_TYPE_ORDER 순, 그 아래 단계는 입력 순서(sort_order 등)에서
 * 처음 나타난 순서를 유지한다.
 * @param list   정렬할 항목 배열
 * @param get    항목 → 모델 (기본: 항목 자체가 모델)
 */
export function groupForMerge(list, get = (x) => x, depth = 0) {
  if (depth >= MODEL_MERGE_LEVELS.length) return list;
  const buckets = new Map();
  list.forEach((item) => {
    const k = MODEL_MERGE_LEVELS[depth](get(item));
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(item);
  });
  let entries = [...buckets.entries()];
  if (depth === 0) entries = sortBodyTypes(entries);
  return entries.flatMap(([, arr]) => groupForMerge(arr, get, depth + 1));
}

/**
 * 행별 병합 정보: 반환 배열의 [i][k] = i행에서 시작하는 k단계 병합 셀의 rowSpan.
 * 0 이면 위 행의 병합 셀에 포함되므로 셀을 그리지 않는다.
 * 연속된 행끼리만 병합하므로 어떤 정렬 순서에도 안전하다.
 * @param rows    표의 행 배열 (표시 순서)
 * @param levels  행 → 키 함수 배열 (앞 단계부터)
 */
export function computeMergeSpans(rows, levels = MODEL_MERGE_LEVELS) {
  const prefix = rows.map((r) => {
    let acc = '';
    return levels.map((f) => (acc += '\u0001' + f(r)));
  });
  return rows.map((_, i) =>
    levels.map((__, k) => {
      if (i > 0 && prefix[i - 1][k] === prefix[i][k]) return 0;
      let n = 1;
      while (i + n < rows.length && prefix[i + n][k] === prefix[i][k]) n++;
      return n;
    })
  );
}
