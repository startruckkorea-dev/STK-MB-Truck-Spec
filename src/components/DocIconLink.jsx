/**
 * 제원표 / 도면 아이콘 링크 — URL 이 있으면 파란색(활성, 클릭 시 새 탭),
 * 없으면 회색(비활성, 클릭 불가). 좌우 스크롤 없이 표·모바일 목록에 넣기 위한 컴팩트 버튼.
 *
 * kind: 'spec'(제원표 PDF) | 'drawing'(도면)
 */
const META = {
  spec: { label: '제원표', path: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6' },
  drawing: { label: '도면', path: 'M4 20h16M4 20V4h16v16M4 14l5-5 4 4 3-3 4 4M15 8h.01' },
};

export default function DocIconLink({ kind, url, title, size = 'md' }) {
  const meta = META[kind];
  const box = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9';
  const icon = (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={meta.path} />
    </svg>
  );
  const base = `inline-flex flex-col items-center justify-center rounded-lg border ${box} leading-none`;
  const caption = <span className="text-[9px] mt-0.5 font-medium">{meta.label}</span>;

  if (!url) {
    return (
      <span
        className={`${base} border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed`}
        title={`${meta.label} 없음`}
        onClick={(e) => e.stopPropagation()}
      >
        {icon}
        {caption}
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={title || `${meta.label} 열기`}
      className={`${base} border-mb-blue/40 bg-mb-blue/10 text-mb-blue hover:bg-mb-blue hover:text-white transition-colors`}
    >
      {icon}
      {caption}
    </a>
  );
}
