import { Fragment } from 'react';
import ColorSwatch from './ColorSwatch';
import Badge from './ui/Badge';
import { useAuth } from '../hooks/useAuth';

// 모바일에서 헤더 배지를 작게
const MOBILE_BADGE = '!px-1 !py-0 !text-[10px] sm:!px-2.5 sm:!py-1 sm:!text-sm';

const BADGE_LABELS = {
  new: 'NEW',
  updated: 'UPDATED',
  'fleet-domestic': 'Fleet내수',
  'fleet-export': 'Fleet수출',
  'branch-order': 'Branch주문차',
};


/**
 * 비교 테이블
 *
 * models: Model[]
 * specsMap: { [modelId]: Spec[] }
 * dict: { [code]: { name_ko, hex_color, is_hidden, category } }
 */
export default function CompareTable({ models, specsMap, notesMap = {}, dict, showDiffOnly = false, language = 'ko' }) {
  const { isAdmin, canViewCodes } = useAuth();

  // 모든 모델의 spec_key 유니온 (카테고리 + 순서 유지)
  const allKeys = buildAllKeys(models, specsMap, isAdmin, dict);

  // showDiffOnly 시 diff 여부를 미리 계산
  const diffSet = showDiffOnly ? buildDiffSet(allKeys, models, specsMap, dict, isAdmin, language) : null;

  // 렌더 행: 전체 보기는 카테고리 헤더 포함 원래 순서,
  // 차이점만 보기는 카테고리 그룹 없이 코드(spec_key) A→Z 오름차순 평면 정렬.
  const renderRows = diffSet
    ? allKeys
        .filter((r) => r.type === 'spec' && diffSet.specKeys.has(r.spec_key))
        .sort((a, b) => String(a.spec_key || '').localeCompare(String(b.spec_key || '')))
    : allKeys;

  const hasAnyNotes = models.some((m) => (notesMap[m.id] ?? []).length > 0);

  return (
    // 모바일: '항목' 열을 숨기고 모델 열을 균등 분할(table-fixed) → 좌우 스크롤 없이 한눈에.
    //         항목명은 값 행 위에 작은 회색 줄로 표시한다.
    <div className="sm:overflow-x-auto -mx-px">
      <table className="w-full table-fixed text-xs sm:text-base border-collapse sm:min-w-[480px]">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="hidden sm:table-cell text-left px-4 py-3 text-gray-500 font-medium w-36 bg-gray-50 sticky left-0 z-10">항목</th>
            {models.map((m) => (
              <th key={m.id} className="px-1.5 sm:px-4 py-2 sm:py-3 bg-gray-50 text-left align-top">
                <div className="flex flex-col gap-0.5 sm:gap-1">
                  <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap">
                    {m.name_ko && <Badge variant="default" className={MOBILE_BADGE}>{m.name_ko}</Badge>}
                    <Badge variant="year" className={MOBILE_BADGE}>{m.model_year}</Badge>
                    {m.badge && (
                      <Badge variant={m.badge} className={MOBILE_BADGE}>
                        {BADGE_LABELS[m.badge] ?? m.badge}
                      </Badge>
                    )}
                  </div>
                  <span className="font-bold text-gray-900 text-xs sm:text-sm leading-tight break-words">
                    {m.series} {m.code}{m.axle ? ` ${m.axle}` : ''}{m.cabin ? ` ${m.cabin}` : ''}
                    {m.production_month && (
                      <span className="ml-1 text-[10px] font-normal text-gray-400 align-middle">
                        ({m.production_month})
                      </span>
                    )}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {/* 보충 설명 노트 섹션 */}
          {hasAnyNotes && (
            <>
              <tr className="bg-gray-50">
                <td
                  colSpan={models.length + 1}
                  className="px-1.5 sm:px-4 py-1 sm:py-2 font-barlow font-semibold text-gray-700 tracking-wide uppercase text-sm"
                >
                  보충 설명
                </td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="hidden sm:table-cell px-4 py-3 text-gray-400 text-xs align-top sticky left-0 bg-white z-10">
                  —
                </td>
                {models.map((m) => {
                  const notes = notesMap[m.id] ?? [];
                  return (
                    <td key={m.id} className="px-1.5 sm:px-4 py-2 sm:py-3 align-top break-words">
                      {notes.length === 0 ? (
                        <span className="text-gray-300 text-xs">—</span>
                      ) : (
                        <div className="space-y-1.5">
                          {notes.map((note) => (
                            <div key={note.id}>
                              <div className="text-xs text-gray-500">{note.label}</div>
                              <div className="text-xs font-mono text-gray-900">{note.content}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            </>
          )}

          {renderRows.map((row) => {
            if (row.type === 'category') {
              return (
                <tr key={`cat-${row.category}`} className="bg-gray-50">
                  <td
                    colSpan={models.length + 1}
                    className="px-1.5 sm:px-4 py-1 sm:py-2 font-barlow font-semibold text-gray-700 tracking-wide uppercase text-sm"
                  >
                    {row.category}
                  </td>
                </tr>
              );
            }

            // 값 수집
            const values = models.map((m) => {
              const specs = specsMap[m.id] ?? [];
              const spec = specs.find((s) => s.spec_key === row.spec_key);
              if (!spec) return null;
              if (!isAdmin && (spec.is_hidden || dict[spec.spec_value]?.is_hidden)) return null;
              return spec;
            });

            // 유효한 값만 추출 (비교용)
            const displayValues = values.map((spec) => {
              if (!spec) return null;
              if (!spec.use_translate) return spec.spec_value;
              const entry = dict[spec.spec_value];
              if (language === 'en') return entry?.name_en || spec.spec_value;
              return entry?.name_ko ?? null;
            });

            const uniqueValues = new Set(displayValues.filter(Boolean));
            const hasAbsent = displayValues.some((v) => v === null);
            const isDifferent = uniqueValues.size > 1 || (hasAbsent && uniqueValues.size > 0);

            // showDiffOnly 시 동일 항목 숨김
            if (diffSet && !diffSet.specKeys.has(row.spec_key)) return null;

            // 국문 라벨 우선. 없으면 admin/staff 는 영문 코드, 영업직원은 숨김
            const label = row.labelKo || (canViewCodes ? row.spec_key : '');
            const rowStyle = isDifferent ? { backgroundColor: 'rgba(0,173,239,0.06)' } : {};

            return (
              <Fragment key={`${row.category}-${row.spec_key}`}>
              {/* 모바일 전용: 항목명 줄 */}
              {label && (
                <tr className={`sm:hidden ${isDifferent ? '' : 'opacity-65'}`} style={rowStyle}>
                  <td colSpan={models.length} className="px-1.5 pt-1.5 pb-0 text-[11px] text-gray-400 break-words">
                    {label}
                  </td>
                </tr>
              )}
              <tr
                className={`border-b border-gray-100 transition-colors ${
                  isDifferent ? '' : 'opacity-65'
                }`}
                style={rowStyle}
              >
                <td className="hidden sm:table-cell px-4 py-2.5 text-gray-700 align-top text-sm sticky left-0 bg-white z-10">
                  {label}
                </td>
                {values.map((spec, i) => (
                  <td key={models[i].id} className="px-1.5 sm:px-4 py-1.5 sm:py-2.5 align-top break-words">
                    {spec ? (
                      <SpecValue spec={spec} dict={dict} language={language} />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                ))}
              </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SpecValue({ spec, dict, language = 'ko' }) {
  const entry = dict[spec.spec_value];
  if (!spec.use_translate) {
    return <span className="font-mono text-xs sm:text-sm text-gray-800">{spec.spec_value}</span>;
  }
  if (language === 'en') {
    const enText = entry?.name_en || spec.spec_value;
    return entry?.hex_color
      ? <ColorSwatch hexColor={entry.hex_color} label={enText} size="sm" />
      : <span className="text-xs sm:text-base text-gray-800 leading-snug">{enText}</span>;
  }
  if (!entry) {
    return <span className="text-amber-400 text-xs sm:text-sm">번역 미등록</span>;
  }
  if (entry.is_color && entry.hex_color) {
    return <ColorSwatch hexColor={entry.hex_color} nameKo={entry.name_ko} size="sm" />;
  }
  return <span className="text-xs sm:text-base text-gray-800 leading-snug">{entry.name_ko}</span>;
}

// 차이가 있는 spec_key와 해당 카테고리를 Set으로 반환
function buildDiffSet(allKeys, models, specsMap, dict, isAdmin, language = 'ko') {
  const specKeys = new Set();
  const categories = new Set();

  allKeys.forEach((row) => {
    if (row.type !== 'spec') return;
    const displayValues = models.map((m) => {
      const specs = specsMap[m.id] ?? [];
      const spec = specs.find((s) => s.spec_key === row.spec_key);
      if (!spec) return null;
      if (!isAdmin && (spec.is_hidden || dict[spec.spec_value]?.is_hidden)) return null;
      if (!spec.use_translate) return spec.spec_value;
      const entry = dict[spec.spec_value];
      if (language === 'en') return entry?.name_en || spec.spec_value;
      return entry?.name_ko ?? null;
    });
    const unique = new Set(displayValues.filter(Boolean));
    const hasAbsent = displayValues.some((v) => v === null);
    if (unique.size > 1 || (hasAbsent && unique.size > 0)) {
      specKeys.add(row.spec_key);
      categories.add(row.category);
    }
  });

  return { specKeys, categories };
}

function buildAllKeys(models, specsMap, isAdmin, dict) {
  // 카테고리 + spec_key 순서 보존 (첫 번째 모델 기준, 나머지 보완)
  const categoryOrder = [];
  const keysByCategory = new Map();

  models.forEach((m) => {
    const specs = specsMap[m.id] ?? [];
    specs.forEach((spec) => {
      if (!isAdmin && (spec.is_hidden || dict[spec.spec_value]?.is_hidden)) return;
      const cat = spec.category || '기타';
      if (!keysByCategory.has(cat)) {
        keysByCategory.set(cat, new Map());
        categoryOrder.push(cat);
      }
      const keyMap = keysByCategory.get(cat);
      if (!keyMap.has(spec.spec_key)) {
        keyMap.set(spec.spec_key, {
          spec_key: spec.spec_key,
          labelKo: spec.label_ko,
          sort_order: spec.sort_order,
        });
      }
    });
  });

  const result = [];
  categoryOrder.forEach((cat) => {
    result.push({ type: 'category', category: cat });
    const keys = Array.from(keysByCategory.get(cat).values()).sort(
      (a, b) => a.sort_order - b.sort_order
    );
    keys.forEach((k) => result.push({ type: 'spec', category: cat, ...k }));
  });

  return result;
}
