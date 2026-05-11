/**
 * 컬러 스와치 + 라벨 (기본: 국문, label prop으로 영문 코드 등 override 가능)
 */
export default function ColorSwatch({ hexColor, nameKo, label, size = 'md' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const text = label ?? nameKo;

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-block rounded-full border border-gray-200 shadow-sm flex-shrink-0 ${sizes[size] ?? sizes.md}`}
        style={{ backgroundColor: hexColor ?? '#cccccc' }}
        title={hexColor}
      />
      <span className="text-gray-800">{text}</span>
    </span>
  );
}
