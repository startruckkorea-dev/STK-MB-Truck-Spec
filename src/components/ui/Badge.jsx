export default function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default:  'bg-gray-100 text-gray-600',
    new:      'bg-mb-blue text-white',
    updated:  'bg-amber-100 text-amber-700',
    hidden:   'bg-gray-200 text-gray-500',
    year:     'bg-blue-50 text-blue-700 border border-blue-200',
    actros:   'bg-blue-50 text-blue-700 border border-blue-200',
    arocs:    'bg-orange-50 text-orange-700 border border-orange-200',
    atego:    'bg-green-50 text-green-700 border border-green-200',
  };

  return (
    <span
      className={`inline-block px-2.5 py-1 rounded text-sm font-semibold font-barlow tracking-wide uppercase ${variants[variant] ?? variants.default} ${className}`}
    >
      {children}
    </span>
  );
}
