import ColorSwatch from './ColorSwatch';
import Badge from './ui/Badge';
import { useAuth } from '../hooks/useAuth';


/**
 * 비교 테이블
 *
 * models: Model[]
 * specsMap: { [modelId]: Spec[] }
 * dict: { [code]: { name_ko, hex_color, is_hidden, category } }
 */
export default function CompareTable({ models, specsMap, notesMap = {}, dict, showDiffOnly = false }) {
  const { isAdmin } = useAuth();

  // 모든 모델의 spec_key 유니온 (카테고리 + 순서 유지)
  const allKeys = buildAllKeys(models, specsMap, isAdmin, dict);

  // showDiffOnly 시 diff 여부를 미리 계산
  const diffSet = showDiffOnly ? buildDiffSet(allKeys, models, specsMap, dict, isAdmin) : null;

  const hasAnyNotes = models.some((m) => (notesMap[m.id] ?? []).length > 0);

  return (
    <div className="overflow-x-auto -mx-px">
      <table className="w-full text-sm sm:text-base border-collapse min-w-[480px]">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left px-2 sm:px-4 py-2 sm:py-3 text-gray-500 font-medium w-24 sm:w-36 bg-gray-50 sticky left-0 z-10">항목</th>
            {models.map((m) => (
              <th key={m.id} className="px-2 sm:px-4 py-2 sm:py-3 bg-gray-50 text-left">
                <div className="flex flex-col gap-0.5 sm:gap-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    {m.name_ko && <Badge variant="default">{m.name_ko}</Badge>}
                    <Badge variant="year">{m.model_year}</Badge>
                    {m.badge && (
                      <Badge variant={m.badge === 'new' ? 'new' : 'updated'}>
                        {m.badge === 'new' ? 'NEW' : 'update'}
                      </Badge>
                    )}
                  </div>
                  <span className="font-bold text-gray-900 text-xs sm:text-sm leading-tight">
                    {m.series} {m.code}
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
                  className="px-2 sm:px-4 py-1.5 sm:py-2 font-barlow font-semibold text-gray-700 tracking-wide uppercase text-sm"
                >
                  보충 설명
                </td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-400 text-xs align-top sticky left-0 bg-white z-10">
                  —
                </td>
                {models.map((m) => {
                  const notes = notesMap[m.id] ?? [];
                  return (
                    <td key={m.id} className="px-2 sm:px-4 py-2 sm:py-3 align-top">
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

          {allKeys.map((row) => {
            if (row.type === 'category') {
              // showDiffOnly 시 이 카테고리에 diff 항목이 없으면 skip
              if (diffSet && !diffSet.categories.has(row.category)) return null;
              return (
                <tr key={`cat-${row.category}`} className="bg-gray-50">
                  <td
                    colSpan={models.length + 1}
                    className="px-2 sm:px-4 py-1.5 sm:py-2 font-barlow font-semibold text-gray-700 tracking-wide uppercase text-sm"
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
              const entry = dict[spec.spec_value];
              if (!spec.use_translate) return spec.spec_value;
              return entry?.name_ko ?? null;
            });

            const uniqueValues = new Set(displayValues.filter(Boolean));
            const hasAbsent = displayValues.some((v) => v === null);
            const isDifferent = uniqueValues.size > 1 || (hasAbsent && uniqueValues.size > 0);

            // showDiffOnly 시 동일 항목 숨김
            if (diffSet && !diffSet.specKeys.has(row.spec_key)) return null;

            return (
              <tr
                key={`${row.category}-${row.spec_key}`}
                className={`border-b border-gray-100 transition-colors ${
                  isDifferent ? '' : 'opacity-65'
                }`}
                style={isDifferent ? { backgroundColor: 'rgba(0,173,239,0.06)' } : {}}
              >
                <td className="px-2 sm:px-4 py-1.5 sm:py-2.5 text-gray-700 align-top text-sm sticky left-0 bg-white z-10">
                  {row.labelKo || row.spec_key}
                </td>
                {values.map((spec, i) => (
                  <td key={models[i].id} className="px-2 sm:px-4 py-1.5 sm:py-2.5 align-top">
                    {spec ? (
                      <SpecValue spec={spec} dict={dict} />
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SpecValue({ spec, dict }) {
  const entry = dict[spec.spec_value];
  if (!spec.use_translate) {
    return <span className="font-mono text-sm text-gray-800">{spec.spec_value}</span>;
  }
  if (!entry) {
    return <span className="text-amber-400 text-sm">번역 미등록</span>;
  }
  if (entry.is_color && entry.hex_color) {
    return <ColorSwatch hexColor={entry.hex_color} nameKo={entry.name_ko} size="sm" />;
  }
  return <span className="text-sm sm:text-base text-gray-800">{entry.name_ko}</span>;
}

// 차이가 있는 spec_key와 해당 카테고리를 Set으로 반환
function buildDiffSet(allKeys, models, specsMap, dict, isAdmin) {
  const specKeys = new Set();
  const categories = new Set();

  allKeys.forEach((row) => {
    if (row.type !== 'spec') return;
    const displayValues = models.map((m) => {
      const specs = specsMap[m.id] ?? [];
      const spec = specs.find((s) => s.spec_key === row.spec_key);
      if (!spec) return null;
      if (!isAdmin && (spec.is_hidden || dict[spec.spec_value]?.is_hidden)) return null;
      const entry = dict[spec.spec_value];
      if (!spec.use_translate) return spec.spec_value;
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
