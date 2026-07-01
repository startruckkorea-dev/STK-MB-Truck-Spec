import { useSearchParams, Link } from 'react-router-dom';
import { useState, useMemo } from 'react';
import Layout from '../components/Layout';
import CompareTable from '../components/CompareTable';
import Button from '../components/ui/Button';
import { useSpecLang } from '../hooks/useSpecLang';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../hooks/useAuth';
import { exportCompareToExcel, exportCompareToPDF } from '../lib/export';

export default function Compare() {
  const [searchParams] = useSearchParams();
  const idsKey = (searchParams.get('ids') ?? '').split(',').filter(Boolean).join(',');
  const idCount = idsKey ? idsKey.split(',').length : 0;

  const { models: allModels, specs: allSpecs, modelNotes, codeIndex, loading, error } = useData();
  const { canViewCodes } = useAuth();
  const [showDiffOnly, setShowDiffOnly] = useState(false);
  const [lang] = useSpecLang();
  // 코드 열람 권한이 있어도 외부 배포용으로 코드를 숨겨 출력하는 옵션
  const [hideCodesExport, setHideCodesExport] = useState(false);
  const exportCodes = canViewCodes && !hideCodesExport;

  // 캐시에서 선택 모델 + 사양 + 노트 구성 (id 순서 유지)
  const { models, specsMap, notesMap } = useMemo(() => {
    const idList = idsKey.split(',').filter(Boolean).map(Number);
    const ms = idList
      .map((id) => allModels.find((m) => Number(m.id) === id))
      .filter(Boolean);
    const sm = {};
    const nm = {};
    ms.forEach((m) => {
      sm[m.id] = allSpecs
        .filter((s) => Number(s.model_id) === Number(m.id))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      nm[m.id] = modelNotes
        .filter((n) => Number(n.model_id) === Number(m.id))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    });
    return { models: ms, specsMap: sm, notesMap: nm };
  }, [idsKey, allModels, allSpecs, modelNotes]);

  const dict = codeIndex;

  if (idCount < 2) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">비교할 모델을 2개 이상 선택해주세요.</p>
          <Link to="/models"><Button variant="outline">모델 목록으로</Button></Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="font-barlow font-bold text-lg sm:text-2xl text-gray-900 tracking-wide">
            모델 비교
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">
            {models.length}개 모델 비교
          </p>
          {/* 세그먼트 컨트롤 */}
          <div className="mt-2 inline-flex bg-gray-100 rounded-lg p-0.5 text-sm">
            <button
              onClick={() => setShowDiffOnly(false)}
              className={`px-3 py-1 rounded-md transition-all ${
                !showDiffOnly
                  ? 'bg-white shadow-sm text-gray-900 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              전체 보기
            </button>
            <button
              onClick={() => setShowDiffOnly(true)}
              className={`px-3 py-1 rounded-md transition-all ${
                showDiffOnly
                  ? 'bg-white shadow-sm text-gray-900 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              차이점만 보기
            </button>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {canViewCodes && (
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none mr-1">
              <input
                type="checkbox"
                checked={hideCodesExport}
                onChange={(e) => setHideCodesExport(e.target.checked)}
                className="accent-mb-blue"
              />
              코드숨김 출력
            </label>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCompareToExcel(models, specsMap, dict, notesMap, showDiffOnly, lang, exportCodes)}
            disabled={loading || models.length === 0}
          >
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCompareToPDF(models, specsMap, dict, notesMap, showDiffOnly, lang, exportCodes)}
            disabled={loading || models.length === 0}
          >
            PDF
          </Button>
          <Link to="/models">
            <Button variant="outline" size="sm">← 목록</Button>
          </Link>
        </div>
      </div>

      {loading && (
        <div className="text-center py-20 text-gray-400 animate-pulse">로딩 중...</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && models.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <CompareTable models={models} specsMap={specsMap} notesMap={notesMap} dict={dict} showDiffOnly={showDiffOnly} language={lang} />
        </div>
      )}
    </Layout>
  );
}
