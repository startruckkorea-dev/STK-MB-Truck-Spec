import { normalizeStatus, isLaunched } from '../lib/vehicleStatus';

/**
 * 차량 진행 상태 신호등 — 출시 = 초록, 그 외(생산·선적·도착·인증·PDI) = 빨강.
 * 상태가 비어 있으면 회색 대시.
 * size: 'sm'(타일 카드 등) | 'md'(표)
 */
export default function StatusLight({ status, size = 'md', className = '' }) {
  const s = normalizeStatus(status);
  if (!s) return <span className={`text-gray-300 text-xs ${className}`}>—</span>;

  const green = isLaunched(s);
  const dot = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';
  const text = size === 'sm' ? 'text-[11px]' : 'text-xs';

  return (
    <span
      title={`차량 상태: ${s}`}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap font-medium ${text} ${
        green ? 'text-emerald-700' : 'text-red-600'
      } ${className}`}
    >
      <span
        className={`inline-block rounded-full ${dot} ${
          green
            ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]'
            : 'bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.18)]'
        }`}
      />
      {s}
    </span>
  );
}
