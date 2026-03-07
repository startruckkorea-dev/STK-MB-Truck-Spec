import { useState, useMemo } from 'react';
import Layout from '../components/Layout';
import ModelCard from '../components/ModelCard';
import CompareBar from '../components/CompareBar';
import { useModels } from '../hooks/useModels';

const SERIES_TABS = ['전체', 'Actros', 'Arocs', 'Atego'];

export default function Models() {
  const { models, loading, error, refetch } = useModels();

  const [activeSeries, setActiveSeries] = useState('전체');
  const [selectedYear, setSelectedYear] = useState('');
  const [search, setSearch] = useState('');
  const [compareList, setCompareList] = useState([]);

  // 연식 목록 (중복 제거, 최신순)
  const years = useMemo(() => {
    const yrs = [...new Set(models.map((m) => m.model_year))].sort().reverse();
    return yrs;
  }, [models]);

  // 필터링
  const filtered = useMemo(() => {
    return models.filter((m) => {
      if (activeSeries !== '전체' && m.series !== activeSeries) return false;
      if (selectedYear && m.model_year !== selectedYear) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !m.code.toLowerCase().includes(q) &&
          !m.name_ko.toLowerCase().includes(q) &&
          !m.model_year.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [models, activeSeries, selectedYear, search]);

  function toggleCompare(model) {
    setCompareList((prev) => {
      const exists = prev.find((m) => m.id === model.id);
      if (exists) return prev.filter((m) => m.id !== model.id);
      if (prev.length >= 3) return prev;
      return [...prev, model];
    });
  }

  function removeFromCompare(modelId) {
    setCompareList((prev) => prev.filter((m) => m.id !== modelId));
  }

  return (
    <Layout>
      {/* 헤더 */}
      <div className="mb-4 sm:mb-6">
        <h1 className="font-barlow font-bold text-xl sm:text-2xl text-gray-900 tracking-wide">
          모델 목록
        </h1>
        <p className="text-gray-500 text-xs sm:text-sm mt-1">
          {filtered.length}개 모델
        </p>
      </div>

      {/* 필터 + 검색 */}
      <div className="space-y-2 sm:space-y-0 sm:flex sm:flex-row sm:gap-3 mb-4 sm:mb-6">
        {/* 시리즈 탭 */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
          {SERIES_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSeries(tab)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                activeSeries === tab
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex gap-2 sm:gap-3">
          {/* MY 드롭다운 */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-2 sm:px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-mb-blue"
          >
            <option value="">전체 연식</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* 검색 */}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="모델 검색..."
            className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue"
          />
        </div>
      </div>

      {/* 상태 */}
      {loading && (
        <div className="text-center py-20 text-gray-400">
          <div className="animate-pulse">모델 로딩 중...</div>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* 모델 그리드 */}
      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm">
              조건에 맞는 모델이 없습니다.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {filtered.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  isSelected={compareList.some((m) => m.id === model.id)}
                  onCompareToggle={toggleCompare}
                  onVisibilityChange={refetch}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* 비교 바 */}
      <CompareBar selectedModels={compareList} onRemove={removeFromCompare} />

      {/* 비교 바 공간 확보 */}
      {compareList.length > 0 && <div className="h-20 sm:h-16" />}
    </Layout>
  );
}
