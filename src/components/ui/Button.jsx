export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  ...props
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-mb-blue focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary:  'bg-mb-blue text-white hover:bg-mb-blue-dark',
    outline:  'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50',
    ghost:    'text-gray-600 hover:bg-gray-100',
    danger:   'bg-red-500 text-white hover:bg-red-600',
    'outline-danger': 'border border-red-300 text-red-600 bg-white hover:bg-red-50',
  };

  const sizes = {
    sm:  'px-2.5 py-1.5 text-xs',
    md:  'px-4 py-2 text-sm',
    lg:  'px-5 py-2.5 text-base',
  };

  return (
    <button
      disabled={disabled}
      className={`${base} ${variants[variant] ?? variants.primary} ${sizes[size] ?? sizes.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
