/**
 * vehicleStatus.js — 출고준비단계(생산 → 출시) 정의
 *
 * `models` 시트의 `vehicle_status` 컬럼에 아래 value(국문)를 그대로 저장한다.
 * (Excel 에서 직접 편집해도 읽기 쉽도록 코드값 대신 국문 사용)
 * 신호등 표시: 출시 = 초록, 그 외 단계 = 빨강.
 */
export const VEHICLE_STATUSES = [
  { value: '생산', en: 'Production' },
  { value: '선적·도착', en: 'Shipping' },
  { value: '인증', en: 'Homologation' },
  { value: 'PDI', en: 'PDI' },
  { value: '출시', en: 'Launch' },
];

const KNOWN = new Set(VEHICLE_STATUSES.map((s) => s.value));

/** 저장값 정규화 (가운뎃점 표기 차이 등 흡수). 알 수 없는 값은 원문 유지 */
export function normalizeStatus(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (KNOWN.has(s)) return s;
  const loose = s.replace(/[\s·.,/-]/g, '').toLowerCase();
  if (loose === '선적도착') return '선적·도착';
  if (loose === 'pdi') return 'PDI';
  return s;
}

/** 출시 단계 여부 (신호등 초록) */
export function isLaunched(v) {
  return normalizeStatus(v) === '출시';
}
