import { useNavigate } from 'react-router-dom';
import Button from './ui/Button';

/**
 * 하단 고정 비교 바
 * selectedModels: Model[] (최대 3개)
 * onRemove: (modelId) => void
 */
export default function CompareBar({ selectedModels, onRemove }) {
  const navigate = useNavigate();

  if (selectedModels.length === 0) return null;

  function handleCompare() {
    const ids = selectedModels.map((m) => m.id).join(',');
    navigate(`/compare?ids=${ids}`);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-gray-900 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-xs font-medium text-gray-400 flex-shrink-0 hidden sm:block">
              비교 ({selectedModels.length}/3)
            </span>

            {/* 선택된 모델 칩 */}
            <div className="flex flex-1 gap-1.5 sm:gap-2 flex-wrap min-w-0">
              {selectedModels.map((model) => (
                <span
                  key={model.id}
                  className="inline-flex items-center gap-1 sm:gap-1.5 bg-gray-800 rounded-full px-2 sm:px-3 py-1 text-xs sm:text-sm"
                >
                  <span className="text-gray-200 truncate max-w-[80px] sm:max-w-[150px]">{model.name_ko}</span>
                  <button
                    onClick={() => onRemove(model.id)}
                    className="text-gray-500 hover:text-white ml-0.5 text-xs leading-none"
                    aria-label={`${model.name_ko} 제거`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>

            <Button
              onClick={handleCompare}
              disabled={selectedModels.length < 2}
              size="sm"
              className="flex-shrink-0 text-xs sm:text-sm"
            >
              비교
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
