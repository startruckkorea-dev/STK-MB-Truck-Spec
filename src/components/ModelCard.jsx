import { Link } from 'react-router-dom';
import Badge from './ui/Badge';
import Button from './ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useData } from '../contexts/DataContext';

const BADGE_LABELS = {
  new: 'NEW',
  updated: 'UPDATED',
  'fleet-domestic': 'Fleet내수',
  'fleet-export': 'Fleet수출',
  'branch-order': 'Branch주문차',
};

function getYearVariant(modelYear) {
  const n = parseInt(String(modelYear).replace(/\D/g, '')) || 0;
  if (n >= 28) return 'year28';
  if (n === 27) return 'year27';
  if (n === 26) return 'year26';
  if (n === 25) return 'year25';
  if (n === 24) return 'year24';
  return 'yearOld';
}


export default function ModelCard({
  model,
  isSelected,
  onCompareToggle,
  reordering = false,
  draggable = false,
  isDragging = false,
  isDropTarget = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onNavigate,
}) {
  const { isAdmin } = useAuth();
  const { setModelVisible } = useData();

  async function toggleVisibility() {
    try {
      await setModelVisible(model.id, !model.is_visible);
    } catch (e) {
      alert(e.message);
    }
  }

  const isHidden = !model.is_visible;

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`relative rounded-xl border bg-white shadow-sm transition-all ${
        isHidden
          ? 'opacity-50 border-gray-200'
          : 'border-gray-200 hover:shadow-md hover:border-mb-blue/30'
      } ${isDragging ? 'opacity-40' : ''} ${isDropTarget ? 'ring-2 ring-mb-blue' : ''}`}
    >
      {/* 숨김 배지 (admin 전용) */}
      {isAdmin && isHidden && (
        <span className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 px-1.5 py-0.5 text-xs bg-gray-200 text-gray-500 rounded font-medium">
          숨김
        </span>
      )}

      <div className="p-4 sm:p-5">
        {/* 상단: 차종 배지 + MY 배지 + 상태 배지 */}
        <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3 flex-wrap">
          {model.name_ko && (
            <Badge variant="default">{model.name_ko}</Badge>
          )}
          <Badge variant={getYearVariant(model.model_year)}>{model.model_year}</Badge>
          {model.badge && (
            <Badge variant={model.badge}>
              {BADGE_LABELS[model.badge] ?? model.badge}
            </Badge>
          )}
        </div>

        {/* 모델명: 시리즈 + 코드 */}
        <h3 className="font-noto font-bold text-gray-900 text-sm sm:text-base leading-snug mb-1">
          {model.series} {model.code}{model.axle ? ` ${model.axle}` : ''}{model.cabin ? ` ${model.cabin}` : ''}
          {model.production_month && (
            <span className="ml-1.5 text-[10px] sm:text-xs font-normal text-gray-400 align-middle">
              ({model.production_month})
            </span>
          )}
        </h3>

        {/* 기타 특징 — 항상 동일한 높이 유지 */}
        <div className="min-h-[1rem] mb-3 sm:mb-4">
          {model.code_desc && (
            <p className="text-xs text-gray-400 leading-snug">{model.code_desc}</p>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-2">
          <Link to={`/models/${model.id}`} onClick={() => onNavigate?.()} className="flex-1 min-w-0">
            <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm">
              사양 상세
            </Button>
          </Link>
          <Button
            variant={isSelected ? 'primary' : 'outline'}
            size="sm"
            onClick={() => onCompareToggle?.(model)}
            className="flex-shrink-0 text-xs sm:text-sm"
          >
            {isSelected ? '해제' : '비교'}
          </Button>
        </div>

        {/* admin 전용: 드래그 순서 이동 핸들 + 공개/숨기기 토글 */}
        {isAdmin && (
          <div className="mt-2 sm:mt-3 flex items-center justify-between gap-2">
            <span
              title="드래그해서 순서 이동"
              className={`inline-flex items-center gap-1 text-xs text-gray-400 select-none ${
                reordering ? 'opacity-40' : 'cursor-grab hover:text-gray-700'
              }`}
            >
              <span className="text-sm leading-none">⠿</span> 이동
            </span>
            <button
              onClick={toggleVisibility}
              className="flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors py-1"
            >
              <span>{isHidden ? '공개하기' : '숨기기'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
