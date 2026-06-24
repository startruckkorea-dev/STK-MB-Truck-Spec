import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { useData } from '../../contexts/DataContext';

const SERIES_BADGE = { Actros: 'actros', Arocs: 'arocs', Atego: 'atego' };

const BADGE_LABELS = {
  new: 'NEW',
  updated: 'UPDATED',
  'fleet-domestic': 'Fleet내수',
  'fleet-export': 'Fleet수출',
  'branch-order': 'Branch주문차',
};

function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col)
    return <span className="ml-0.5 text-gray-300 text-xs">↕</span>;
  return (
    <span className="ml-0.5 text-mb-blue text-xs">
      {sortDir === 'asc' ? '↑' : '↓'}
    </span>
  );
}

export default function AdminModels() {
  const {
    models: allModels,
    modelNotes,
    loading,
    error,
    setModelVisible,
    deleteModel: ctxDeleteModel,
  } = useData();
  const [deleting, setDeleting] = useState(null);
  const [actionError, setActionError] = useState(null);

  // 필터
  const [filterYear, setFilterYear] = useState('');
  const [filterSeries, setFilterSeries] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // 정렬
  const [sortKey, setSortKey] = useState('model_year');
  const [sortDir, setSortDir] = useState('desc');

  // 캐시의 모델에 노트를 붙임
  const models = useMemo(() => {
    const notesMap = {};
    modelNotes.forEach((n) => {
      (notesMap[n.model_id] || (notesMap[n.model_id] = [])).push(n);
    });
    return allModels.map((m) => ({ ...m, model_notes: notesMap[m.id] ?? [] }));
  }, [allModels, modelNotes]);

  async function toggleVisibility(model) {
    setActionError(null);
    try {
      await setModelVisible(model.id, !model.is_visible);
    } catch (e) {
      setActionError(e.message);
    }
  }

  async function deleteModel(id) {
    if (!window.confirm('이 모델과 모든 사양 데이터를 삭제하시겠습니까?')) return;
    setActionError(null);
    setDeleting(id);
    try {
      await ctxDeleteModel(id);
    } catch (e) {
      setActionError(e.message);
    }
    setDeleting(null);
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  // 연식 목록 (중복 제거)
  const yearOptions = useMemo(
    () => [...new Set(models.map((m) => m.model_year))].sort((a, b) => b - a),
    [models]
  );
  const seriesOptions = useMemo(
    () => [...new Set(models.map((m) => m.series))].sort(),
    [models]
  );

  // 필터 + 정렬 적용
  const filtered = useMemo(() => {
    let list = [...models];
    if (filterYear) list = list.filter((m) => String(m.model_year) === filterYear);
    if (filterSeries) list = list.filter((m) => m.series === filterSeries);
    if (filterStatus === 'visible') list = list.filter((m) => m.is_visible);
    if (filterStatus === 'hidden') list = list.filter((m) => !m.is_visible);

    list.sort((a, b) => {
      let va = a[sortKey] ?? '';
      let vb = b[sortKey] ?? '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [models, filterYear, filterSeries, filterStatus, sortKey, sortDir]);

  const activeFilters = [filterYear, filterSeries, filterStatus].filter(Boolean).length;

  function clearFilters() {
    setFilterYear('');
    setFilterSeries('');
    setFilterStatus('');
  }

  const thClass =
    'text-left px-4 py-3 text-gray-500 font-medium cursor-pointer select-none hover:text-gray-800 whitespace-nowrap';

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <div>
          <h1 className="font-barlow font-bold text-lg sm:text-2xl text-gray-900 tracking-wide">
            모델 관리
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            {filtered.length !== models.length
              ? `${filtered.length} / ${models.length}개 모델`
              : `총 ${models.length}개 모델`}
          </p>
        </div>
        <Link to="/admin/models/new">
          <Button className="text-xs sm:text-sm">+ 모델 등록</Button>
        </Link>
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* MY 필터 */}
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-mb-blue/30"
        >
          <option value="">MY 전체</option>
          {yearOptions.map((y) => (
            <option key={y} value={String(y)}>
              MY{String(y).slice(2)}
            </option>
          ))}
        </select>

        {/* 시리즈 필터 */}
        <select
          value={filterSeries}
          onChange={(e) => setFilterSeries(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-mb-blue/30"
        >
          <option value="">시리즈 전체</option>
          {seriesOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* 상태 필터 */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-mb-blue/30"
        >
          <option value="">상태 전체</option>
          <option value="visible">공개</option>
          <option value="hidden">숨김</option>
        </select>

        {activeFilters > 0 && (
          <button
            onClick={clearFilters}
            className="text-xs text-red-400 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            필터 초기화 ({activeFilters})
          </button>
        )}
      </div>

      {loading && (
        <div className="text-center py-20 text-gray-400 animate-pulse">로딩 중...</div>
      )}
      {(error || actionError) && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm mb-4">
          {error || actionError}
        </div>
      )}

      {!loading && (
        <>
          {/* 데스크톱 테이블 */}
          <div className="hidden sm:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className={thClass} onClick={() => handleSort('name_ko')}>
                    모델 <SortIcon col="name_ko" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">기타특징</th>
                  <th className={thClass} onClick={() => handleSort('series')}>
                    시리즈 <SortIcon col="series" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">배지</th>
                  <th className={`${thClass} hidden md:table-cell`} onClick={() => handleSort('model_year')}>
                    MY <SortIcon col="model_year" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className={thClass} onClick={() => handleSort('is_visible')}>
                    상태 <SortIcon col="is_visible" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((model) => {
                  const sortedNotes = [...(model.model_notes ?? [])].sort(
                    (a, b) => a.sort_order - b.sort_order
                  );
                  return (
                    <tr
                      key={model.id}
                      className={`hover:bg-gray-50 transition-colors ${!model.is_visible ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{model.name_ko}</div>
                        <div className="font-mono text-xs text-gray-400">
                          {model.code}{model.axle ? ` ${model.axle}` : ''}{model.cabin ? ` ${model.cabin}` : ''}
                        </div>
                        {model.code_desc && (
                          <div className="text-xs text-gray-400 mt-0.5">{model.code_desc}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {sortedNotes.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {sortedNotes.map((n) => (
                              <span
                                key={n.id}
                                className="inline-block text-xs bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded"
                              >
                                {n.label}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={SERIES_BADGE[model.series] ?? 'default'}>{model.series}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {model.badge ? (
                          <Badge variant={model.badge}>
                            {BADGE_LABELS[model.badge] ?? model.badge}
                          </Badge>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="font-mono text-xs text-mb-blue font-semibold">{model.model_year}</span>
                        {model.production_month && (
                          <div className="font-mono text-[10px] text-gray-400 mt-0.5">{model.production_month}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            model.is_visible
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {model.is_visible ? '공개' : '숨김'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => toggleVisibility(model)}
                            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                            title={model.is_visible ? '숨기기' : '공개하기'}
                          >
                            {model.is_visible ? '숨김' : '공개'}
                          </button>
                          <Link
                            to={`/admin/models/${model.id}/edit`}
                            className="px-2 py-1 text-xs text-mb-blue hover:bg-blue-50 rounded transition-colors"
                          >
                            편집
                          </Link>
                          <Link
                            to={`/models/${model.id}`}
                            className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
                          >
                            보기
                          </Link>
                          <button
                            onClick={() => deleteModel(model.id)}
                            disabled={deleting === model.id}
                            className="px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400 text-sm">
                      {activeFilters > 0
                        ? '필터 조건에 맞는 모델이 없습니다.'
                        : <>등록된 모델이 없습니다.{' '}
                            <Link to="/admin/models/new" className="text-mb-blue hover:underline">모델 등록하기</Link>
                          </>}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 리스트 */}
          <div className="sm:hidden space-y-2">
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                {activeFilters > 0
                  ? '필터 조건에 맞는 모델이 없습니다.'
                  : <>등록된 모델이 없습니다.{' '}
                      <Link to="/admin/models/new" className="text-mb-blue hover:underline">모델 등록하기</Link>
                    </>}
              </div>
            )}
            {filtered.map((model) => {
              const sortedNotes = [...(model.model_notes ?? [])].sort(
                (a, b) => a.sort_order - b.sort_order
              );
              return (
                <div
                  key={model.id}
                  className={`bg-white border border-gray-200 rounded-xl p-3 ${!model.is_visible ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <Badge variant={SERIES_BADGE[model.series] ?? 'default'}>{model.series}</Badge>
                        {model.badge && (
                          <Badge variant={model.badge}>
                            {BADGE_LABELS[model.badge] ?? model.badge}
                          </Badge>
                        )}
                        <span className="font-mono text-xs text-mb-blue font-semibold">{model.model_year}</span>
                        {model.production_month && (
                          <span className="font-mono text-[10px] text-gray-400">{model.production_month}</span>
                        )}
                        <span
                          className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                            model.is_visible ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {model.is_visible ? '공개' : '숨김'}
                        </span>
                      </div>
                      <div className="font-medium text-gray-900 text-sm">{model.name_ko}</div>
                      <div className="font-mono text-xs text-gray-400">
                        {model.code}{model.axle ? ` ${model.axle}` : ''}{model.cabin ? ` ${model.cabin}` : ''}
                      </div>
                      {model.code_desc && (
                        <div className="text-xs text-gray-400 mt-0.5">{model.code_desc}</div>
                      )}
                      {sortedNotes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {sortedNotes.map((n) => (
                            <span
                              key={n.id}
                              className="inline-block text-xs bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded"
                            >
                              {n.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => toggleVisibility(model)}
                      className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
                    >
                      {model.is_visible ? '숨김' : '공개'}
                    </button>
                    <Link
                      to={`/admin/models/${model.id}/edit`}
                      className="px-2 py-1 text-xs text-mb-blue hover:bg-blue-50 rounded transition-colors"
                    >
                      편집
                    </Link>
                    <Link
                      to={`/models/${model.id}`}
                      className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded transition-colors"
                    >
                      보기
                    </Link>
                    <button
                      onClick={() => deleteModel(model.id)}
                      disabled={deleting === model.id}
                      className="ml-auto px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Layout>
  );
}
