export default function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default:   'bg-gray-100 text-gray-600',
    new:             'bg-mb-blue text-white',
    updated:         'bg-amber-100 text-amber-700',
    'fleet-domestic': 'bg-emerald-100 text-emerald-700 border border-emerald-300',
    'fleet-export':   'bg-cyan-100 text-cyan-700 border border-cyan-300',
    'branch-order':   'bg-purple-100 text-purple-700 border border-purple-300',
    hidden:    'bg-gray-200 text-gray-500',
    // MY 연식별 색상 (5가지 이상)
    year28:    'bg-amber-400 text-amber-900 border border-amber-500',        // MY28+ — 골드
    year27:    'bg-violet-100 text-violet-700 border border-violet-300',     // MY27 — 바이올렛
    year26:    'bg-sky-100 text-sky-700 border border-sky-300',             // MY26 — 스카이블루
    year25:    'bg-teal-100 text-teal-700 border border-teal-300',          // MY25 — 틸
    year24:    'bg-orange-100 text-orange-700 border border-orange-300',    // MY24 — 오렌지
    yearOld:   'bg-gray-100 text-gray-500 border border-gray-300',         // MY23 이하 — 그레이
    // 시리즈별
    actros:    'bg-blue-50 text-blue-700 border border-blue-200',
    arocs:     'bg-orange-50 text-orange-700 border border-orange-200',
    atego:     'bg-green-50 text-green-700 border border-green-200',
  };

  return (
    <span
      className={`inline-block px-2.5 py-1 rounded text-sm font-semibold font-barlow tracking-wide uppercase ${variants[variant] ?? variants.default} ${className}`}
    >
      {children}
    </span>
  );
}
