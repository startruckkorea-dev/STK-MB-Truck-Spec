/**
 * 컬러 스와치 + 국문 컬러명
 */
export default function ColorSwatch({ hexColor, nameKo, size = 'md' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-block rounded-full border border-gray-200 shadow-sm flex-shrink-0 ${sizes[size] ?? sizes.md}`}
        style={{ backgroundColor: hexColor ?? '#cccccc' }}
        title={hexColor}
      />
      <span className="text-gray-800">{nameKo}</span>
    </span>
  );
}
