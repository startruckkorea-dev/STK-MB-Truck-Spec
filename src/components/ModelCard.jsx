import { Link } from 'react-router-dom';
import Badge from './ui/Badge';
import Button from './ui/Button';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';


export default function ModelCard({
  model,
  isSelected,
  onCompareToggle,
  onVisibilityChange,
}) {
  const { isAdmin } = useAuth();

  async function toggleVisibility() {
    const { error } = await supabase
      .from('models')
      .update({ is_visible: !model.is_visible })
      .eq('id', model.id);
    if (!error) onVisibilityChange?.();
  }

  const isHidden = !model.is_visible;

  return (
    <div
      className={`relative rounded-xl border bg-white shadow-sm transition-all ${
        isHidden
          ? 'opacity-50 border-gray-200'
          : 'border-gray-200 hover:shadow-md hover:border-mb-blue/30'
      }`}
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
          <Badge variant="year">{model.model_year}</Badge>
          {model.badge && (
            <Badge variant={model.badge === 'new' ? 'new' : 'updated'}>
              {model.badge === 'new' ? 'NEW' : 'update'}
            </Badge>
          )}
        </div>

        {/* 모델명: 시리즈 + 코드 */}
        <h3 className="font-noto font-bold text-gray-900 text-sm sm:text-base leading-snug mb-3 sm:mb-4">
          {model.series} {model.code}
        </h3>

        {/* 액션 버튼 */}
        <div className="flex gap-2">
          <Link to={`/models/${model.id}`} className="flex-1 min-w-0">
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

        {/* admin 전용: 공개/숨기기 토글 */}
        {isAdmin && (
          <button
            onClick={toggleVisibility}
            className="mt-2 sm:mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors py-1"
          >
            <span>{isHidden ? '공개하기' : '숨기기'}</span>
          </button>
        )}
      </div>
    </div>
  );
}
