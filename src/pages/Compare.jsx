import { useSearchParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import CompareTable from '../components/CompareTable';
import Button from '../components/ui/Button';
import { supabase } from '../lib/supabase';
import { exportCompareToExcel, exportCompareToPDF } from '../lib/export';

export default function Compare() {
  const [searchParams] = useSearchParams();
  const ids = (searchParams.get('ids') ?? '').split(',').filter(Boolean).map(Number);

  const [models, setModels] = useState([]);
  const [specsMap, setSpecsMap] = useState({});
  const [notesMap, setNotesMap] = useState({});
  const [dict, setDict] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDiffOnly, setShowDiffOnly] = useState(false);

  useEffect(() => {
    if (ids.length < 2) { setLoading(false); return; }
    fetchData(ids);
  }, [ids.join(',')]);

  async function fetchData(modelIds) {
    setLoading(true);
    try {
      // 모델 조회
      const { data: modelsData, error: mErr } = await supabase
        .from('models')
        .select('*')
        .in('id', modelIds);
      if (mErr) throw mErr;

      // id 순서 유지
      const orderedModels = modelIds
        .map((id) => modelsData.find((m) => m.id === id))
        .filter(Boolean);

      // 사양 + 노트 조회 (병렬)
      const [
        { data: specsData, error: sErr },
        { data: notesData, error: nErr },
      ] = await Promise.all([
        supabase.from('specs').select('*').in('model_id', modelIds).order('sort_order'),
        supabase.from('model_notes').select('*').in('model_id', modelIds).order('sort_order'),
      ]);
      if (sErr) throw sErr;
      if (nErr) throw nErr;

      // 사양 맵 구성
      const sm = {};
      specsData.forEach((spec) => {
        if (!sm[spec.model_id]) sm[spec.model_id] = [];
        sm[spec.model_id].push(spec);
      });

      // 노트 맵 구성
      const nm = {};
      (notesData ?? []).forEach((note) => {
        if (!nm[note.model_id]) nm[note.model_id] = [];
        nm[note.model_id].push(note);
      });

      // 코드 사전 조회 (정규화)
      const allCodes = [...new Set(
        specsData.filter((s) => s.use_translate).map((s) => (s.spec_value || '').trim().toUpperCase()).filter(Boolean)
      )];
      let dictData = {};
      if (allCodes.length > 0) {
        const { data: dData } = await supabase
          .from('code_dict')
          .select('code, name_ko, hex_color, is_hidden, category')
          .in('code', allCodes);
        if (dData) {
          dData.forEach((r) => { dictData[r.code] = r; });
        }
      }

      setModels(orderedModels);
      setSpecsMap(sm);
      setNotesMap(nm);
      setDict(dictData);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  if (ids.length < 2) {
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
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCompareToExcel(models, specsMap, dict, notesMap, showDiffOnly)}
            disabled={loading || models.length === 0}
          >
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCompareToPDF(models, specsMap, dict, notesMap, showDiffOnly)}
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
          <CompareTable models={models} specsMap={specsMap} notesMap={notesMap} dict={dict} showDiffOnly={showDiffOnly} />
        </div>
      )}
    </Layout>
  );
}
