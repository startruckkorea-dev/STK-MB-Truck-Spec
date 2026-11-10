import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Badge from '../components/ui/Badge';
import ColorSwatch from '../components/ColorSwatch';
import ListFilters, { matchBodySeries } from '../components/ListFilters';
import { useModels } from '../hooks/useModels';
import { useData } from '../contexts/DataContext';
import { useSpecLang } from '../hooks/useSpecLang';
import { normCode } from '../lib/codeIndex';
import { groupForMerge, computeMergeSpans, modelLevels } from '../lib/mergeRows';

const SERIES_BADGE = { Actros: 'actros', Arocs: 'arocs', Atego: 'atego', eActros: 'eactros' };

// MY26 컬러코드는 "MB" + 숫자 4자리 (예: MB 6888)
const COLOR_CODE_RE = /^MB\s*\d{4}$/i;

function getYearHeaderStyle(modelYear) {
  const n = parseInt(String(modelYear).replace(/\D/g, '')) || 0;
  if (n >= 28) return 'text-amber-700 bg-amber-50 border border-amber-300';
  if (n === 27) return 'text-violet-700 bg-violet-50 border border-violet-300';
  if (n === 26) return 'text-sky-700 bg-sky-50 border border-sky-300';
  if (n === 25) return 'text-teal-700 bg-teal-50 border border-teal-300';
  if (n === 24) return 'text-orange-700 bg-orange-50 border border-orange-300';
  return 'text-gray-600 bg-gray-100 border border-gray-300';
}

/** 모델 표시명: 시리즈 코드 축 캐빈 */
function modelName(m) {
  return [m.series, m.code, m.axle, m.cabin].filter(Boolean).join(' ');
}

export default function ColorCodes() {
  const { models, loading, error } = useModels();
  const { specs, codeIndex } = useData();
  const [lang] = useSpecLang();
  const navigate = useNavigate();

  const [bodyType, setBodyType] = useState('전체');
  const [activeSeries, setActiveSeries] = useState(''); // '' = 전체 시리즈
  const [selectedYear, setSelectedYear] = useState('');
  const [search, setSearch] = useState('');

  // model_id → 외장컬러 사양 목록 (is_color=true & "MB ####" 코드)
  const colorsByModel = useMemo(() => {
    const map = {};
    for (const s of specs) {
      if (!s.is_color) continue;
      const code = String(s.spec_value || '').trim();
      if (!COLOR_CODE_RE.test(code)) continue;
      (map[s.model_id] || (map[s.model_id] = [])).push({
        ...s,
        code,
        sort_order: s.sort_order ?? 0,
      });
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.sort_order - b.sort_order);
    }
    return map;
  }, [specs]);

  // 연식 목록 (컬러가 있는 모델 기준)
  const years = useMemo(() => {
    const set = new Set(
      models.filter((m) => colorsByModel[m.id]?.length).map((m) => m.model_year)
    );
    return [...set].sort().reverse();
  }, [models, colorsByModel]);

  // 필터 → MY별 그룹 (모델 순서는 useModels 정렬 유지)
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const yearMap = {};
    for (const m of models) {
      const colors = colorsByModel[m.id];
      if (!colors?.length) continue;
      if (!matchBodySeries(m, bodyType, activeSeries)) continue;
      if (selectedYear && m.model_year !== selectedYear) continue;

      // 색상명(번역) 문자열
      const rows = colors.map((c) => {
        const entry = codeIndex[normCode(c.code)];
        const nameKo = entry?.name_ko || '';
        const nameEn = entry?.name_en || '';
        const name = lang === 'en' ? nameEn || nameKo : nameKo || nameEn;
        return { code: c.code, name, hex: entry?.hex_color, hasEntry: !!entry };
      });

      if (q) {
        const hay = [
          m.name_ko,
          modelName(m),
          m.model_year,
          ...rows.map((r) => r.code),
          ...rows.map((r) => r.name),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) continue;
      }

      const yr = m.model_year || '기타';
      (yearMap[yr] || (yearMap[yr] = [])).push({ model: m, rows });
    }
    return Object.entries(yearMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, items]) => ({ year, items }));
  }, [models, colorsByModel, codeIndex, bodyType, activeSeries, selectedYear, search, lang]);

  const totalModels = grouped.reduce((n, g) => n + g.items.length, 0);

  return (
    <Layout>
      {/* 헤더 — 제목 오른쪽에 필터 */}
      <div className="mb-4 sm:mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex-shrink-0">
          <h1 className="font-barlow font-bold text-xl sm:text-2xl text-gray-900 tracking-wide">
            색상코드
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            모델별 외장 컬러 코드 · {totalModels}개 모델
          </p>
        </div>

        <ListFilters
          className="flex-1 min-w-0"
          bodyType={bodyType}
          setBodyType={setBodyType}
          series={activeSeries}
          setSeries={setActiveSeries}
          year={selectedYear}
          setYear={setSelectedYear}
          years={years}
          search={search}
          setSearch={setSearch}
          searchPlaceholder="모델·색상 검색..."
        />
      </div>

      {/* 상태 */}
      {loading && (
        <div className="text-center py-20 text-gray-400">
          <div className="animate-pulse">색상코드 로딩 중...</div>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* 표 */}
      {!loading && !error && (
        totalModels === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            표시할 외장 컬러 코드가 없습니다.
          </div>
        ) : (
          grouped.map(({ year, items }) => (
            <div key={year} className="mb-8 sm:mb-10">
              {/* MY 섹션 헤더 */}
              <div className="flex items-center gap-3 mb-3">
                <span className={`font-barlow font-bold text-base tracking-widest px-3 py-1 rounded ${getYearHeaderStyle(year)}`}>
                  {year}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
                <table className="w-full text-sm table-fixed min-w-[820px] border-collapse">
                  {/* MY별 표 열 너비 통일 */}
                  <colgroup>
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[7%]" />
                    <col className="w-[7%]" />
                    <col className="w-[18%]" />
                    <col className="w-[12%]" />
                    <col className="w-[26%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                      <th className="pl-4 pr-3 py-2.5 font-medium whitespace-nowrap">차종분류</th>
                      <th className="px-3 py-2.5 font-medium whitespace-nowrap">시리즈</th>
                      <th className="px-3 py-2.5 font-medium whitespace-nowrap">모델코드</th>
                      <th className="px-3 py-2.5 font-medium whitespace-nowrap">축</th>
                      <th className="px-3 py-2.5 font-medium whitespace-nowrap">캐빈</th>
                      <th className="px-3 py-2.5 font-medium whitespace-nowrap">기타특징</th>
                      <th className="px-3 py-2.5 font-medium whitespace-nowrap">색상코드</th>
                      <th className="px-3 py-2.5 font-medium whitespace-nowrap">색상명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // 모델을 차종→시리즈→코드→축→캐빈 순으로 묶은 뒤 색상 행으로 펼친다
                      const flat = groupForMerge(items, (it) => it.model).flatMap(({ model, rows }) =>
                        rows.map((row, ri) => ({ model, row, ri }))
                      );
                      // 병합 단계: 모델 5단계 + 모델 자체(기타특징 칸)
                      const spans = computeMergeSpans(flat, [
                        ...modelLevels((r) => r.model),
                        (r) => r.model.id,
                      ]);
                      return flat.map(({ model, row, ri }, i) => {
                        const lv = spans[i];
                        const border =
                          i === 0 ? '' : lv[0] > 0 ? 'border-t border-gray-200' : 'border-t border-gray-100';
                        // 병합 셀 — 한 모델만 묶은 셀이면 클릭 시 상세로, 여러 모델이면 이동 없음
                        const merged = (level, extra, content) => {
                          const span = lv[level];
                          if (!span) return null;
                          const single = flat.slice(i, i + span).every((r) => r.model.id === model.id);
                          return (
                            <td
                              rowSpan={span}
                              onClick={single ? undefined : (e) => e.stopPropagation()}
                              className={`px-3 py-2.5 align-top ${border} ${
                                single ? 'group-hover:bg-gray-50' : 'cursor-default'
                              } ${extra}`}
                            >
                              {content}
                            </td>
                          );
                        };
                        const cell = `px-3 py-2.5 ${border} group-hover:bg-gray-50 transition-colors`;
                        return (
                          <tr
                            key={`${model.id}-${row.code}-${ri}`}
                            onClick={() => navigate(`/models/${model.id}`)}
                            className="group cursor-pointer"
                          >
                            {merged(0, '!pl-4 whitespace-nowrap', (
                              <>
                                {model.name_ko ? (
                                  <Badge variant="default">{model.name_ko}</Badge>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </>
                            ))}
                            {merged(1, 'whitespace-nowrap', (
                              <Badge variant={SERIES_BADGE[model.series] ?? 'default'}>{model.series}</Badge>
                            ))}
                            {merged(2, 'font-mono text-sm font-semibold text-gray-900 whitespace-nowrap', model.code)}
                            {merged(3, 'font-mono text-sm text-gray-500 whitespace-nowrap',
                              model.axle || <span className="text-gray-300">—</span>)}
                            {merged(4, 'font-mono text-sm text-gray-500 whitespace-nowrap',
                              model.cabin || <span className="text-gray-300">—</span>)}
                            {merged(5, 'text-xs text-gray-500', model.code_desc || <span className="text-gray-300">—</span>)}
                            <td className={`${cell} font-mono text-sm text-gray-800 whitespace-nowrap`}>
                              {row.code}
                            </td>
                            <td className={cell}>
                              {row.hasEntry ? (
                                <ColorSwatch hexColor={row.hex} nameKo={row.name || row.code} />
                              ) : (
                                <span className="text-amber-500 text-xs">번역 미등록</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )
      )}
    </Layout>
  );
}
