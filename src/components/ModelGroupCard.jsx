import { useNavigate } from 'react-router-dom';
import Badge from './ui/Badge';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../contexts/DataContext';
import { BADGE_LABELS, getYearVariant } from './ModelCard';

/**
 * 타일 보기 — 같은 시리즈·모델코드의 변형(캐빈·배지·특징이 다른 모델)을
 * 카드 하나로 묶어 보여준다. 카드 상단은 공통 정보, 아래는 변형별 행.
 * 배지·기타특징·생산월·비교는 변형(모델)별로 개별 표시한다.
 */
export default function ModelGroupCard({
  models,
  compareList,
  onCompareToggle,
  notesByModel = {},
  reordering = false,
  draggable = false,
  dragId,
  overId,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onNavigate,
}) {
  const { isAdmin } = useAuth();
  const { setModelVisible } = useData();
  const navigate = useNavigate();

  const head = models[0];
  const sameAxle = models.every((m) => (m.axle || '') === (head.axle || ''));
  const allHidden = models.every((m) => !m.is_visible);

  async function toggleVisibility(model) {
    try {
      await setModelVisible(model.id, !model.is_visible);
    } catch (e) {
      alert(e.message);
    }
  }

  function go(model) {
    onNavigate?.();
    navigate(`/models/${model.id}`);
  }

  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md hover:border-mb-blue/30 ${
        allHidden ? 'opacity-50' : ''
      }`}
    >
      {/* 공통 헤더 */}
      <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3">
        <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3 flex-wrap">
          {head.name_ko && <Badge variant="default">{head.name_ko}</Badge>}
          <Badge variant={getYearVariant(head.model_year)}>{head.model_year}</Badge>
          <span className="ml-auto text-xs text-gray-400">{models.length}개 사양</span>
        </div>
        <h3 className="font-noto font-bold text-gray-900 text-sm sm:text-base leading-snug">
          {head.series} {head.code}
          {sameAxle && head.axle ? ` ${head.axle}` : ''}
        </h3>
      </div>

      {/* 변형별 행 */}
      <ul className="border-t border-gray-100 divide-y divide-gray-100">
        {models.map((m) => {
          const isSelected = compareList.some((c) => c.id === m.id);
          const notes = [...(notesByModel[m.id] ?? [])].sort(
            (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
          );
          const desc = notes.length > 0 ? notes.map((n) => n.label).join(', ') : m.code_desc;
          const isDropTarget = overId === m.id && dragId != null && dragId !== m.id;
          return (
            <li
              key={m.id}
              draggable={draggable}
              onDragStart={(e) => onDragStart?.(e, m.id)}
              onDragOver={(e) => onDragOver?.(e, m.id)}
              onDrop={(e) => onDrop?.(e, m.id)}
              onDragEnd={onDragEnd}
              onClick={() => go(m)}
              className={`px-4 sm:px-5 py-2.5 flex items-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                dragId === m.id ? 'opacity-40' : ''
              } ${isDropTarget ? 'shadow-[inset_0_2px_0_#00ADEF]' : ''}`}
            >
              <div className={`flex-1 min-w-0 ${!m.is_visible && !allHidden ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-sm font-semibold text-gray-800">
                    {[!sameAxle && m.axle, m.cabin].filter(Boolean).join(' ') || '—'}
                  </span>
                  {m.badge && (
                    <Badge variant={m.badge} className="!text-[11px] !px-1.5 !py-0.5">
                      {BADGE_LABELS[m.badge] ?? m.badge}
                    </Badge>
                  )}
                  {m.production_month && (
                    <span className="font-mono text-[11px] text-mb-blue font-semibold">
                      {m.production_month}
                    </span>
                  )}
                  {isAdmin && !m.is_visible && (
                    <span className="px-1.5 py-0.5 text-[11px] bg-gray-200 text-gray-500 rounded font-medium">
                      숨김
                    </span>
                  )}
                </div>
                {desc && (
                  <p className="text-xs text-gray-400 leading-snug mt-0.5 truncate" title={desc}>
                    {desc}
                  </p>
                )}
              </div>

              {isAdmin && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleVisibility(m); }}
                    className="px-1.5 py-1 text-[11px] text-gray-400 hover:text-gray-700 rounded"
                  >
                    {m.is_visible ? '숨기기' : '공개'}
                  </button>
                  <span
                    title="드래그해서 순서 이동"
                    className={`text-gray-400 select-none ${reordering ? 'opacity-40' : 'cursor-grab hover:text-gray-700'}`}
                  >
                    ⠿
                  </span>
                </div>
              )}

              <button
                onClick={(e) => { e.stopPropagation(); onCompareToggle?.(m); }}
                className={`flex-shrink-0 px-2.5 py-1 text-xs rounded border transition-colors ${
                  isSelected
                    ? 'bg-mb-blue text-white border-mb-blue'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {isSelected ? '해제' : '비교'}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
