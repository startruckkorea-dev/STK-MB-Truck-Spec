import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Badge from '../components/ui/Badge';
import { useData } from '../contexts/DataContext';
import { useModels } from '../hooks/useModels';
import { parseHomologNo, homologFileName } from '../lib/homologNo';

const SERIES_TABS = ['전체', 'Actros', 'Arocs', 'Atego', 'eActros'];
// 차종(소분류) 정렬 우선순위 — 모델 목록과 동일
const BODY_TYPE_ORDER = ['트랙터', '카고', '덤프', '믹서', '크레인'];

const SERIES_BADGE = { Actros: 'actros', Arocs: 'arocs', Atego: 'atego', eActros: 'eactros' };

const modelName = (m) => [m.series, m.code, m.axle, m.cabin].filter(Boolean).join(' ');

// 모델 목록과 동일한 MY 헤더 색상
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

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    } catch {
      /* 클립보드 권한 없음 — 무시 */
    }
  }
  return (
    <button
      onClick={copy}
      className="ml-2 px-1.5 py-0.5 text-[11px] rounded border border-gray-300 text-gray-500 hover:bg-gray-50"
    >
      {done ? '복사됨' : '복사'}
    </button>
  );
}

export default function HomologNumbers() {
  const { models, loading, error } = useModels();
  const { modelNotes } = useData();
  const [series, setSeries] = useState('전체');
  const [selectedYear, setSelectedYear] = useState('');
  const [search, setSearch] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);

  // model_id → 기타특징(노트) 배열
  const notesByModel = useMemo(() => {
    const map = {};
    modelNotes.forEach((n) => (map[n.model_id] ||= []).push(n));
    Object.values(map).forEach((a) => a.sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0)));
    return map;
  }, [modelNotes]);

  const years = useMemo(
    () => [...new Set(models.map((m) => m.model_year).filter(Boolean))].sort().reverse(),
    [models]
  );

  const missingCount = useMemo(
    () => models.filter((m) => !parseHomologNo(m.homolog_spec_url)).length,
    [models]
  );

  // 필터 → MY별 → 차종별 그룹 (모델 순서는 useModels 정렬 유지)
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const yearMap = {};
    for (const model of models) {
      if (series !== '전체' && model.series !== series) continue;
      if (selectedYear && model.model_year !== selectedYear) continue;
      const no = parseHomologNo(model.homolog_spec_url);
      if (onlyMissing && no) continue;
      const file = homologFileName(model.homolog_spec_url);
      if (
        q &&
        ![modelName(model), model.name_ko, model.code_desc, model.model_year, no, file]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      ) {
        continue;
      }
      const yr = model.model_year || '기타';
      const body = model.name_ko || '기타';
      ((yearMap[yr] ||= {})[body] ||= []).push({ model, no, file });
    }
    return Object.entries(yearMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, typeMap]) => ({ year, types: sortBodyTypes(Object.entries(typeMap)) }));
  }, [models, series, selectedYear, search, onlyMissing]);

  return (
    <Layout>
      <div className="mb-4">
        <h1 className="font-noto font-bold text-lg sm:text-2xl text-gray-900">제원관리번호</h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">
          모델에 연동된 제원표(PDF) 파일명에서 추출한 번호입니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {SERIES_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setSeries(s)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              series === s ? 'bg-mb-blue text-white' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
            }`}
          >
            {s}
          </button>
        ))}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-mb-blue"
        >
          <option value="">전체 MY</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="모델·번호 검색"
          className="ml-auto w-full sm:w-64 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-mb-blue"
        />
        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(e) => setOnlyMissing(e.target.checked)}
            className="accent-mb-blue"
          />
          번호 없는 모델만 ({missingCount})
        </label>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 animate-pulse">로딩 중...</div>
      ) : error ? (
        <div className="text-center py-20 text-red-500">{String(error)}</div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">해당하는 모델이 없습니다.</div>
      ) : (
        grouped.map(({ year, types }) => (
          <div key={year} className="mb-8 sm:mb-10">
            {/* MY 섹션 헤더 */}
            <div className="flex items-center gap-3 mb-4">
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
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">축</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">캐빈</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">기타특징</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">제원관리번호</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">제원표</th>
                    <th className="px-3 py-2.5 font-medium whitespace-nowrap">도면파일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {types.flatMap(([, items]) => items).map(({ model, no, file }) => {
                    const notes = notesByModel[model.id] ?? [];
                    return (
                      <tr key={model.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {model.name_ko ? (
                            <Badge variant="default">{model.name_ko}</Badge>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <Badge variant={SERIES_BADGE[model.series] ?? 'default'}>{model.series}</Badge>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-sm text-gray-800 whitespace-nowrap">
                          <Link to={`/models/${model.id}`} className="hover:text-mb-blue">{model.code}</Link>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-sm text-gray-500 whitespace-nowrap">
                          {model.axle || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-sm text-gray-500 whitespace-nowrap">
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
                        <td className="px-3 py-2.5 whitespace-nowrap font-mono text-sm">
                          {no ? (
                            <>
                              {no}
                              <CopyButton text={no} />
                            </>
                          ) : (
                            <span className="text-gray-300 text-xs">
                              {model.homolog_spec_url ? '번호 인식 불가' : '제원표 미연동'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                          {model.homolog_spec_url ? (
                            <a
                              href={model.homolog_spec_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-mb-blue hover:underline"
                              title={file}
                            >
                              📄 열기
                            </a>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                          {model.homolog_view_url ? (
                            <a
                              href={model.homolog_view_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-mb-blue hover:underline"
                                                          >
                              📐 열기
                            </a>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </Layout>
  );
}
