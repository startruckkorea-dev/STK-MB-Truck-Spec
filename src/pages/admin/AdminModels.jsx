import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { useData } from '../../contexts/DataContext';
import { compareModels } from '../../lib/modelSort';
import { VEHICLE_STATUSES, normalizeStatus } from '../../lib/vehicleStatus';
import { groupForMerge, computeMergeSpans, MODEL_MERGE_LEVELS } from '../../lib/mergeRows';

// 모델 관리 표 병합 단계: MY → 차종분류 → 시리즈 → 모델코드 → 축 → 캐빈
const ADMIN_MERGE_LEVELS = [(m) => String(m.model_year ?? ''), ...MODEL_MERGE_LEVELS];

const SERIES_BADGE = { Actros: 'actros', Arocs: 'arocs', Atego: 'atego', eActros: 'eactros' };

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
    setModelStatus,
    deleteModel: ctxDeleteModel,
  } = useData();
  const [deleting, setDeleting] = useState(null);
  const [actionError, setActionError] = useState(null);

  // 필터
  const [filterYear, setFilterYear] = useState('');
  const [filterSeries, setFilterSeries] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // 정렬
  // 'default' = MY 최신순 → 차종(트랙터·카고·덤프)·시리즈·코드별로 묶어 병합 표시
  const [sortKey, setSortKey] = useState('default');
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

  // 출고준비단계 드롭다운 변경 (저장 중인 모델 id 는 잠금)
  const [statusSaving, setStatusSaving] = useState(null);
  async function changeStatus(model, value) {
    setActionError(null);
    setStatusSaving(model.id);
    try {
      await setModelStatus(model.id, value);
    } catch (e) {
      setActionError(e.message);
    }
    setStatusSaving(null);
  }

  function renderStatusSelect(model) {
    const cur = normalizeStatus(model.vehicle_status);
    const green = cur === '출시';
    return (
      <select
        value={cur}
        disabled={statusSaving === model.id}
        onChange={(e) => changeStatus(model, e.target.value)}
        className={`text-xs font-medium border rounded-md pl-2 pr-6 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-mb-blue/30 disabled:opacity-50 ${
          !cur
            ? 'border-gray-200 text-gray-400'
            : green
              ? 'border-emerald-300 text-emerald-700'
              : 'border-red-300 text-red-600'
        }`}
      >
        <option value="">미지정</option>
        {VEHICLE_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.value}</option>
        ))}
      </select>
    );
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

    if (sortKey === 'default') {
      // MY 내림차순 → 같은 MY 안에서 차종·시리즈·코드·축·캐빈별로 묶음
      const byYear = new Map();
      [...list].sort(compareModels).forEach((m) => {
        const y = String(m.model_year ?? '');
        if (!byYear.has(y)) byYear.set(y, []);
        byYear.get(y).push(m);
      });
      return [...byYear.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .flatMap(([, arr]) => groupForMerge(arr));
    }

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

  // 연속된 행 중 같은 값(MY→차종→시리즈→코드→축→캐빈)을 세로 병합
  const spans = useMemo(() => computeMergeSpans(filtered, ADMIN_MERGE_LEVELS), [filtered]);

  const activeFilters = [filterYear, filterSeries, filterStatus].filter(Boolean).length;

  function clearFilters() {
    setFilterYear('');
    setFilterSeries('');
    setFilterStatus('');
  }

  const thClass =
    'text-left px-3 py-3 text-gray-500 font-medium cursor-pointer select-none hover:text-gray-800 whitespace-nowrap first:pl-4';
  const tdHead = 'text-left px-3 py-3 text-gray-500 font-medium whitespace-nowrap';

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

        {sortKey !== 'default' && (
          <button
            onClick={() => { setSortKey('default'); setSortDir('desc'); }}
            className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            기본 정렬(묶어보기)
          </button>
        )}

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
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className={`${thClass} hidden md:table-cell`} onClick={() => handleSort('model_year')}>
                    MY <SortIcon col="model_year" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className={thClass} onClick={() => handleSort('name_ko')}>
                    차종 <SortIcon col="name_ko" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className={thClass} onClick={() => handleSort('series')}>
                    시리즈 <SortIcon col="series" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className={tdHead}>모델코드</th>
                  <th className={tdHead}>축</th>
                  <th className={tdHead}>캐빈</th>
                  <th className={tdHead}>기타특징</th>
                  <th className={tdHead}>배지</th>
                  <th className={`${tdHead} hidden lg:table-cell`}>생산월</th>
                  <th className={tdHead}>출고준비단계</th>
                  <th className={thClass} onClick={() => handleSort('is_visible')}>
                    상태 <SortIcon col="is_visible" sortKey={sortKey} sortDir={sortDir} />
                  </th>
                  <th className="text-right px-3 py-3 text-gray-500 font-medium">액션</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((model, i) => {
                  const sortedNotes = [...(model.model_notes ?? [])].sort(
                    (a, b) => a.sort_order - b.sort_order
                  );
                  const lv = spans[i];
                  const border =
                    i === 0 ? '' : lv[0] > 0 || lv[1] > 0 ? 'border-t border-gray-200' : 'border-t border-gray-100';
                  const dim = !model.is_visible ? 'opacity-60' : '';
                  const cell = `px-3 py-3 align-top ${border} group-hover:bg-gray-50 transition-colors`;
                  // 병합 셀: 위쪽 정렬, 묶인 모델이 모두 숨김일 때만 흐리게
                  const merged = (level, extra, content) => {
                    const span = lv[level];
                    if (!span) return null;
                    const allHidden = filtered.slice(i, i + span).every((m) => !m.is_visible);
                    return (
                      <td
                        rowSpan={span}
                        className={`px-3 py-3 align-top whitespace-nowrap ${border} ${
                          span > 1 ? '' : 'group-hover:bg-gray-50'
                        } ${extra}`}
                      >
                        <div className={`cell-line ${allHidden ? 'opacity-60' : ''}`}>{content}</div>
                      </td>
                    );
                  };
                  return (
                    <tr key={model.id} className="group">
                      {merged(0, 'hidden md:table-cell !pl-4', (
                        <span className="font-mono text-xs text-mb-blue font-semibold">{model.model_year}</span>
                      ))}
                      {merged(1, '', model.name_ko ? (
                        <Badge variant="default">{model.name_ko}</Badge>
                      ) : (
                        <span className="text-gray-300">—</span>
                      ))}
                      {merged(2, '', (
                        <Badge variant={SERIES_BADGE[model.series] ?? 'default'}>{model.series}</Badge>
                      ))}
                      {merged(3, 'font-mono text-sm font-semibold text-gray-900', model.code)}
                      {merged(4, 'font-mono text-sm text-gray-500',
                        model.axle || <span className="text-gray-300">—</span>)}
                      {merged(5, 'font-mono text-sm text-gray-500',
                        model.cabin || <span className="text-gray-300">—</span>)}
                      <td className={cell}>
                        <div className={`cell-line ${dim}`}>
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
                          ) : model.code_desc ? (
                            <span className="text-xs text-gray-500">{model.code_desc}</span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className={`${cell} whitespace-nowrap`}>
                        <div className={`cell-line ${dim}`}>
                          {model.badge ? (
                            <Badge variant={model.badge}>
                              {BADGE_LABELS[model.badge] ?? model.badge}
                            </Badge>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className={`${cell} hidden lg:table-cell font-mono text-xs text-gray-500 whitespace-nowrap`}>
                        <div className={`cell-line ${dim}`}>
                          {model.production_month || <span className="text-gray-300">—</span>}
                        </div>
                      </td>
                      <td className={`${cell} whitespace-nowrap`}>
                        <div className="cell-line">{renderStatusSelect(model)}</div>
                      </td>
                      <td className={`${cell} whitespace-nowrap`}>
                        <div className="cell-line">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            model.is_visible
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {model.is_visible ? '공개' : '숨김'}
                        </span>
                        </div>
                      </td>
                      <td className={`${cell} text-right whitespace-nowrap`}>
                        <div className="cell-line !flex-row items-center justify-end gap-1">
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
                    <td colSpan={12} className="text-center py-12 text-gray-400 text-sm">
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
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-500">출고준비단계</span>
                    {renderStatusSelect(model)}
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
