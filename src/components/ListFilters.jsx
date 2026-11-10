import { BODY_TYPE_ORDER } from '../lib/mergeRows';

export const BODY_TABS = ['전체', ...BODY_TYPE_ORDER];
export const SERIES_OPTIONS = ['Actros', 'Arocs', 'Atego', 'eActros'];

/** 차종·시리즈 필터 매칭 (빈 값/'전체' = 조건 없음) */
export function matchBodySeries(model, bodyType, series) {
  if (bodyType && bodyType !== '전체' && model.name_ko !== bodyType) return false;
  if (series && model.series !== series) return false;
  return true;
}

const selectCls =
  'h-9 px-2 sm:px-3 border border-gray-300 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-mb-blue';

/**
 * 목록 화면 공통 필터 바 — 페이지 제목 오른쪽에 놓는다.
 * 차종 탭(전체/트랙터/카고/덤프) · 시리즈 드롭다운 · MY 드롭다운 · 검색, 그리고 children(화면별 추가 필터).
 * 값이 없는 항목(setYear 미전달 등)은 표시하지 않는다.
 */
export default function ListFilters({
  bodyType,
  setBodyType,
  series,
  setSeries,
  year,
  setYear,
  years = [],
  yearLabel = (y) => y,
  search,
  setSearch,
  searchPlaceholder = '검색...',
  children,
  className = '',
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* 차종 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 h-9 items-center">
        {BODY_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setBodyType(tab)}
            className={`px-3 h-7 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              bodyType === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 시리즈 */}
      <select value={series} onChange={(e) => setSeries(e.target.value)} className={selectCls}>
        <option value="">전체 시리즈</option>
        {SERIES_OPTIONS.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {/* MY */}
      {setYear && (
        <select value={year} onChange={(e) => setYear(e.target.value)} className={selectCls}>
          <option value="">전체 연식</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>{yearLabel(y)}</option>
          ))}
        </select>
      )}

      {children}

      {/* 검색 */}
      {setSearch && (
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 w-full sm:w-56 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue"
        />
      )}
    </div>
  );
}
