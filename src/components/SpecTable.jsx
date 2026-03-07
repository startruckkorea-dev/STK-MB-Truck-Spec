import { useState } from 'react';
import ColorSwatch from './ColorSwatch';
import { useAuth } from '../hooks/useAuth';

/**
 * 카테고리별 접이식 사양 테이블
 *
 * specs: [{ category, spec_key, spec_value, label_ko, use_translate, is_color, is_hidden }]
 * dict:  { [code]: { name_ko, hex_color, is_hidden, category } }
 * onToggleHide: (specId, currentIsHidden) => void  — admin 전용 인라인 숨김 토글
 */
export default function SpecTable({ specs, dict, onToggleHide }) {
  const { isAdmin } = useAuth();

  // 카테고리별 그룹핑
  const groups = groupByCategory(specs);

  return (
    <div className="space-y-2 sm:space-y-3">
      {groups.map(({ category, items }) => (
        <CategoryGroup
          key={category}
          category={category}
          items={items}
          dict={dict}
          isAdmin={isAdmin}
          onToggleHide={onToggleHide}
        />
      ))}
    </div>
  );
}

function CategoryGroup({ category, items, dict, isAdmin, onToggleHide }) {
  const [open, setOpen] = useState(true);

  // 숨겨진 항목 개수 (sales는 아예 렌더 안 함)
  const visibleItems = isAdmin
    ? items
    : items.filter((s) => !s.is_hidden && !dict[s.spec_value]?.is_hidden);

  if (visibleItems.length === 0 && !isAdmin) return null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* 카테고리 헤더 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="font-barlow font-semibold text-gray-800 tracking-wide uppercase text-xs sm:text-sm">
          {category}
          <span className="ml-2 text-gray-400 font-normal normal-case">
            ({(isAdmin ? items : visibleItems).length})
          </span>
        </span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {/* 사양 목록 */}
      {open && (
        <div className="divide-y divide-gray-100">
          {(isAdmin ? items : visibleItems).map((spec) => {
            const dictEntry = dict[spec.spec_value];
            const isGlobalHidden = dictEntry?.is_hidden ?? false;
            const isItemHidden = spec.is_hidden;
            const showDimmed = isAdmin && (isGlobalHidden || isItemHidden);

            // 표시할 값 결정
            let displayValue;
            if (!spec.use_translate) {
              displayValue = <span className="font-mono text-xs">{spec.spec_value}</span>;
            } else if (dictEntry) {
              displayValue = dictEntry.is_color && dictEntry.hex_color
                ? <ColorSwatch hexColor={dictEntry.hex_color} nameKo={dictEntry.name_ko} />
                : <span className="text-xs sm:text-sm">{dictEntry.name_ko}</span>;
            } else {
              displayValue = (
                <span className="text-amber-500 text-xs">
                  번역 미등록
                  {isAdmin && (
                    <span className="ml-1 font-mono text-gray-400">({spec.spec_value})</span>
                  )}
                </span>
              );
            }

            return (
              <div
                key={spec.id || `${spec.spec_key}-${spec.sort_order}`}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 ${showDimmed ? 'opacity-40' : ''}`}
              >
                <div className="text-gray-500 text-xs sm:text-sm w-2/5 sm:w-1/3 flex-shrink-0 break-words">
                  {spec.label_ko || spec.spec_key}
                </div>
                <div className="text-gray-900 flex-1 min-w-0">
                  {displayValue}
                </div>
                {isAdmin && onToggleHide && (
                  <button
                    onClick={() => onToggleHide(spec.id, spec.is_hidden)}
                    className={`flex-shrink-0 p-1 rounded transition-colors ${
                      isItemHidden
                        ? 'text-gray-300 hover:text-gray-500'
                        : 'text-gray-300 hover:text-gray-500'
                    }`}
                    title={isItemHidden ? '표시하기' : '숨기기'}
                  >
                    {isItemHidden ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function groupByCategory(specs) {
  const map = new Map();
  for (const spec of specs) {
    const cat = spec.category || '기타';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(spec);
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
}

// ─── 인라인 SVG 아이콘 ────────────────────────────────────────────
function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
