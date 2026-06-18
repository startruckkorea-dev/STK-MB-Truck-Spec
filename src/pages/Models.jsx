import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import ModelCard from '../components/ModelCard';
import CompareBar from '../components/CompareBar';
import Badge from '../components/ui/Badge';
import { useModels } from '../hooks/useModels';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../hooks/useAuth';
import { compareModels } from '../lib/modelSort';

const SERIES_TABS = ['전체', 'Actros', 'Arocs', 'Atego'];

const SERIES_BADGE = { Actros: 'actros', Arocs: 'arocs', Atego: 'atego' };

const VIEW_KEY = 'models-view-mode';

// 차종 정렬 우선순위
const BODY_TYPE_ORDER = ['트랙터', '카고', '덤프', '믹서', '크레인'];

function getYearHeaderStyle(modelYear) {
  const n = parseInt(String(modelYear).replace(/\D/g, '')) || 0;
  if (n >= 28) return 'text-amber-700 bg-amber-50 border border-amber-300';
  if (n === 27) return 'text-violet-700 bg-violet-50 border border-violet-300';
  if (n === 26) return 'text-sky-700 bg-sky-50 border border-sky-300';
  if (n === 25) return 'text-teal-700 bg-teal-50 border border-teal-300';
  if (n === 24) return 'text-orange-700 bg-orange-50 border border-orange-300';
  return 'text-gray-600 bg-gray-100 border border-gray-300';
}

function sortBodyTypes(types) {
  return types.sort(([a], [b]) => {
    const ia = BODY_TYPE_ORDER.indexOf(a);
    const ib = BODY_TYPE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export default function Models() {
  const { models, loading, error } = useModels();
  const { moveModelOrder, modelNotes, setModelVisible } = useData();
  const { isAdmin } = useAuth();

  const [activeSeries, setActiveSeries] = useState('전체');
  const [selectedYear, setSelectedYear] = useState('');
  const [search, setSearch] = useState('');
  const [compareList, setCompareList] = useState([]);
  const [reordering, setReordering] = useState(false);
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem(VIEW_KEY) || 'tile'
  );

  function changeView(mode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  }

  // model_id → 노트 배열 (기타특징 표시용)
  const notesByModel = useMemo(() => {
    const map = {};
    modelNotes.forEach((n) => {
      (map[n.model_id] || (map[n.model_id] = [])).push(n);
    });
    return map;
  }, [modelNotes]);

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
          !(m.name_ko || '').toLowerCase().includes(q) &&
          !m.model_year.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [models, activeSeries, selectedYear, search]);

  // MY별 → 차종별 그룹핑
  const grouped = useMemo(() => {
    const yearMap = {};
    filtered.forEach((m) => {
      const yr = m.model_year || '기타';
      const body = m.name_ko || '기타';
      if (!yearMap[yr]) yearMap[yr] = {};
      if (!yearMap[yr][body]) yearMap[yr][body] = [];
      yearMap[yr][body].push(m);
    });
    return Object.entries(yearMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, typeMap]) => ({
        year,
        types: sortBodyTypes(Object.entries(typeMap)),
      }));
  }, [filtered]);

  // MY별 그룹 (리스트 뷰용 — 차종 구분 없이 한 그룹에 정렬해 담음)
  const groupedList = useMemo(() => {
    const yearMap = {};
    filtered.forEach((m) => {
      const yr = m.model_year || '기타';
      (yearMap[yr] || (yearMap[yr] = [])).push(m);
    });
    return Object.entries(yearMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, list]) => ({
        year,
        models: [...list].sort(compareModels),
      }));
  }, [filtered]);

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

  // 같은 그룹 내 두 모델의 표시 순서를 맞바꿈 (admin 전용)
  async function moveModel(idA, idB) {
    if (reordering) return;
    setReordering(true);
    try {
      await moveModelOrder(idA, idB);
    } catch (e) {
      alert(e.message);
    }
    setReordering(false);
  }

  async function toggleVisibility(model) {
    try {
      await setModelVisible(model.id, !model.is_visible);
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <Layout>
      {/* 헤더 */}
      <div className="mb-4 sm:mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-barlow font-bold text-xl sm:text-2xl text-gray-900 tracking-wide">
            모델 목록
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            {filtered.length}개 모델
          </p>
        </div>

        {/* 타일 / 리스트 뷰 토글 */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
          {[
            { key: 'tile', label: '타일' },
            { key: 'list', label: '리스트' },
          ].map((v) => (
            <button
              key={v.key}
              onClick={() => changeView(v.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === v.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
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

      {/* 모델 목록 — 타일 또는 리스트 */}
      {!loading && !error && (
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400 text-sm">
              조건에 맞는 모델이 없습니다.
            </div>
          ) : viewMode === 'tile' ? (
            grouped.map(({ year, types }) => (
              <div key={year} className="mb-8 sm:mb-10">
                {/* MY 섹션 헤더 */}
                <div className="flex items-center gap-3 mb-4">
                  <span className={`font-barlow font-bold text-base tracking-widest px-3 py-1 rounded ${getYearHeaderStyle(year)}`}>
                    {year}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* 차종별 서브그룹 */}
                {types.map(([bodyType, bodyModels]) => (
                  <div key={bodyType} className="mb-5">
                    {/* 차종 서브헤더 (차종이 2가지 이상일 때만) */}
                    {types.length > 1 && (
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest pl-1">
                          {bodyType}
                        </span>
                        <div className="flex-1 h-px bg-gray-100" />
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                      {bodyModels.map((model, idx) => (
                        <ModelCard
                          key={model.id}
                          model={model}
                          isSelected={compareList.some((m) => m.id === model.id)}
                          onCompareToggle={toggleCompare}
                          reordering={reordering}
                          onMoveLeft={
                            isAdmin && idx > 0
                              ? () => moveModel(model.id, bodyModels[idx - 1].id)
                              : null
                          }
                          onMoveRight={
                            isAdmin && idx < bodyModels.length - 1
                              ? () => moveModel(model.id, bodyModels[idx + 1].id)
                              : null
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            /* 리스트 뷰 — MY별 그룹 + 테이블 */
            groupedList.map(({ year, models: yearModels }) => (
              <div key={year} className="mb-8 sm:mb-10">
                {/* MY 섹션 헤더 */}
                <div className="flex items-center gap-3 mb-3">
                  <span className={`font-barlow font-bold text-base tracking-widest px-3 py-1 rounded ${getYearHeaderStyle(year)}`}>
                    {year}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                        <th className="px-3 py-2.5 font-medium whitespace-nowrap">차종분류</th>
                        <th className="px-3 py-2.5 font-medium whitespace-nowrap">시리즈</th>
                        <th className="px-3 py-2.5 font-medium whitespace-nowrap">모델코드</th>
                        <th className="px-3 py-2.5 font-medium whitespace-nowrap">축구성</th>
                        <th className="px-3 py-2.5 font-medium whitespace-nowrap">캐빈</th>
                        <th className="px-3 py-2.5 font-medium whitespace-nowrap">기타특징</th>
                        <th className="px-3 py-2.5 font-medium whitespace-nowrap">생산월</th>
                        <th className="px-3 py-2.5 font-medium whitespace-nowrap text-center">사양상세</th>
                        <th className="px-3 py-2.5 font-medium whitespace-nowrap text-center">비교</th>
                        {isAdmin && (
                          <>
                            <th className="px-3 py-2.5 font-medium whitespace-nowrap text-center">상태</th>
                            <th className="px-3 py-2.5 font-medium whitespace-nowrap text-center">공개</th>
                            <th className="px-3 py-2.5 font-medium whitespace-nowrap text-center">순서</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {yearModels.map((model, idx) => {
                        const isSelected = compareList.some((m) => m.id === model.id);
                        const notes = [...(notesByModel[model.id] ?? [])].sort(
                          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
                        );
                        return (
                          <tr
                            key={model.id}
                            className={`hover:bg-gray-50 transition-colors ${!model.is_visible ? 'opacity-50' : ''}`}
                          >
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {model.name_ko ? (
                                <Badge variant="default">{model.name_ko}</Badge>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <Badge variant={SERIES_BADGE[model.series] ?? 'default'}>
                                {model.series}
                              </Badge>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs text-gray-800 whitespace-nowrap">
                              {model.code}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">
                              {model.axle || <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">
                              {model.cabin || <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-2.5">
                              {notes.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {notes.map((n) => (
                                    <span
                                      key={n.id}
                                      className="inline-block text-xs bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded"
                                    >
                                      {n.label}
                                    </span>
                                  ))}
                                </div>
                              ) : model.code_desc ? (
                                <span className="text-xs text-gray-400">{model.code_desc}</span>
                              ) : (
                                <span className="text-gray-300 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs text-mb-blue font-semibold whitespace-nowrap">
                              {model.production_month || <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <Link
                                to={`/models/${model.id}`}
                                className="inline-block px-2.5 py-1 text-xs text-mb-blue hover:bg-blue-50 rounded transition-colors"
                              >
                                사양 상세
                              </Link>
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              <button
                                onClick={() => toggleCompare(model)}
                                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                                  isSelected
                                    ? 'bg-mb-blue text-white border-mb-blue'
                                    : 'text-gray-600 border-gray-300 hover:bg-gray-100'
                                }`}
                              >
                                {isSelected ? '해제' : '비교'}
                              </button>
                            </td>
                            {isAdmin && (
                              <>
                                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                                      model.is_visible
                                        ? 'bg-green-50 text-green-700'
                                        : 'bg-gray-100 text-gray-500'
                                    }`}
                                  >
                                    {model.is_visible ? '공개' : '숨김'}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                  <button
                                    onClick={() => toggleVisibility(model)}
                                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                  >
                                    {model.is_visible ? '숨기기' : '공개하기'}
                                  </button>
                                </td>
                                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-0.5">
                                    <button
                                      onClick={() => moveModel(model.id, yearModels[idx - 1].id)}
                                      disabled={idx === 0 || reordering}
                                      title="위로 이동"
                                      className="px-2 py-1 text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                    >
                                      ↑
                                    </button>
                                    <button
                                      onClick={() => moveModel(model.id, yearModels[idx + 1].id)}
                                      disabled={idx === yearModels.length - 1 || reordering}
                                      title="아래로 이동"
                                      className="px-2 py-1 text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                    >
                                      ↓
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
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
