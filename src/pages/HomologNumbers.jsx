import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Badge from '../components/ui/Badge';
import { useModels } from '../hooks/useModels';
import { parseHomologNo, homologFileName } from '../lib/homologNo';

const SERIES_TABS = ['전체', 'Actros', 'Arocs', 'Atego'];

const modelName = (m) => [m.series, m.code, m.axle, m.cabin].filter(Boolean).join(' ');

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
  const [series, setSeries] = useState('전체');
  const [search, setSearch] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return models
      .map((m) => ({
        model: m,
        no: parseHomologNo(m.homolog_spec_url),
        file: homologFileName(m.homolog_spec_url),
      }))
      .filter(({ model, no, file }) => {
        if (series !== '전체' && model.series !== series) return false;
        if (onlyMissing && no) return false;
        if (!q) return true;
        return [modelName(model), model.name_ko, model.code_desc, model.model_year, no, file]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q);
      });
  }, [models, series, search, onlyMissing]);

  const missingCount = useMemo(
    () => models.filter((m) => !parseHomologNo(m.homolog_spec_url)).length,
    [models]
  );

  return (
    <Layout>
      <div className="mb-4">
        <h1 className="font-noto font-bold text-lg sm:text-2xl text-gray-900">제원관리번호</h1>
        <p className="text-xs sm:text-sm text-gray-400 mt-1">
          모델에 연동된 제원표(PDF) 파일명에서 추출한 번호입니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
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
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
              <tr>
                <th className="text-left font-medium px-3 py-2.5">모델</th>
                <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">MY</th>
                <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">제원관리번호</th>
                <th className="text-left font-medium px-3 py-2.5 whitespace-nowrap">제원표</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-gray-400">
                    해당하는 모델이 없습니다.
                  </td>
                </tr>
              )}
              {rows.map(({ model, no, file }) => (
                <tr key={model.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <Link to={`/models/${model.id}`} className="text-gray-900 hover:text-mb-blue">
                      {modelName(model)}
                    </Link>
                    {model.code_desc && (
                      <span className="ml-2 text-xs text-gray-400">{model.code_desc}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <Badge variant="year">{model.model_year}</Badge>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-mono">
                    {no ? (
                      <>
                        {no}
                        <CopyButton text={no} />
                      </>
                    ) : (
                      <span className="text-gray-300">
                        {model.homolog_spec_url ? '번호 인식 불가' : '제원표 미연동'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {model.homolog_spec_url ? (
                      <a
                        href={model.homolog_spec_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-mb-blue hover:underline break-all"
                        title={file}
                      >
                        📄 열기
                      </a>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
