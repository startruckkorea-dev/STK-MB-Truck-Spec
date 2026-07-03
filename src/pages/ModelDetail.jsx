import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import SpecTable from '../components/SpecTable';
import PhotoGallery from '../components/PhotoGallery';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useModelDetail } from '../hooks/useModels';
import { useAuth } from '../hooks/useAuth';
import { useSpecLang } from '../hooks/useSpecLang';
import { useData } from '../contexts/DataContext';
import { exportDetailToExcel, exportDetailToPDF } from '../lib/export';


// 인증 자료 링크 버튼 — 링크가 있으면 새 탭으로 SharePoint 열기, 없으면 비활성.
function HomologButton({ url, label }) {
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-1.5 font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-mb-blue focus:ring-offset-1 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 px-2.5 py-1.5 text-xs"
      >
        📄 {label}
      </a>
    );
  }
  return (
    <Button variant="outline" size="sm" disabled title="등록된 링크가 없습니다">
      📄 {label}
    </Button>
  );
}

export default function ModelDetail() {
  const { id } = useParams();
  const { isAdmin, canViewCodes } = useAuth();
  const { model, specs: initialSpecs, notes, loading, error } = useModelDetail(id);
  const { codeIndex: dict, setSpecHidden } = useData();
  const [specs, setSpecs] = useState([]);
  const [lang] = useSpecLang();
  // 코드 열람 권한이 있어도 외부 배포용으로 코드를 숨겨 출력하는 옵션
  const [hideCodesExport, setHideCodesExport] = useState(false);
  const exportCodes = canViewCodes && !hideCodesExport;
  // 사진 갤러리 모달 (sales 포함 전체 열람)
  const [showPhotos, setShowPhotos] = useState(false);

  // initialSpecs(캐시)가 갱신되면 로컬 상태로 동기화
  useEffect(() => {
    setSpecs(initialSpecs);
  }, [initialSpecs]);

  // 어드민 인라인 숨김 토글 (낙관적 업데이트)
  const toggleSpecHidden = useCallback(async (specId, currentValue) => {
    const newValue = !currentValue;
    setSpecs((prev) => prev.map((s) => (s.id === specId ? { ...s, is_hidden: newValue } : s)));
    try {
      await setSpecHidden(specId, newValue);
    } catch {
      // 실패 시 롤백
      setSpecs((prev) => prev.map((s) => (s.id === specId ? { ...s, is_hidden: currentValue } : s)));
    }
  }, [setSpecHidden]);

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-20 text-gray-400 animate-pulse">
          사양 로딩 중...
        </div>
      </Layout>
    );
  }

  if (error || !model) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-red-500 mb-4">{error || '모델을 찾을 수 없습니다.'}</p>
          <Link to="/models">
            <Button variant="outline">목록으로</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* 브레드크럼 */}
      <div className="text-xs sm:text-sm text-gray-400 mb-3 sm:mb-4">
        <Link to="/models" className="hover:text-mb-blue transition-colors">
          모델 목록
        </Link>
        <span className="mx-1.5 sm:mx-2">/</span>
        <span className="text-gray-700">{model.name_ko}</span>
      </div>

      {/* 모델 헤더 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 flex-wrap">
              {model.name_ko && <Badge variant="default">{model.name_ko}</Badge>}
              <Badge variant="year">{model.model_year}</Badge>
              {model.badge && (
                <Badge variant={model.badge === 'new' ? 'new' : 'updated'}>
                  {model.badge === 'new' ? 'NEW' : 'update'}
                </Badge>
              )}
              {!model.is_visible && (
                <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-500 rounded font-medium">
                  숨김
                </span>
              )}
            </div>
            <h1 className="font-noto font-bold text-lg sm:text-2xl text-gray-900 mb-0.5 sm:mb-1">
              {model.series} {model.code}{model.axle ? ` ${model.axle}` : ''}{model.cabin ? ` ${model.cabin}` : ''}
              {model.production_month && (
                <span className="ml-2 text-xs sm:text-sm font-normal text-gray-400 align-middle">
                  ({model.production_month})
                </span>
              )}
            </h1>
            {model.code_desc && (
              <p className="text-xs sm:text-sm text-gray-400 mt-1">{model.code_desc}</p>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap items-center">
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
            <HomologButton url={model.homolog_spec_url} label="제원표" />
            <HomologButton url={model.homolog_view_url} label="외관사면도" />
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowPhotos(true)}
            >
              📷 사진
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportDetailToExcel(model, specs, dict, notes, lang, exportCodes)}
            >
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportDetailToPDF(model, specs, dict, notes, lang, exportCodes)}
            >
              PDF
            </Button>
            <Link to="/models">
              <Button variant="outline" size="sm">← 목록</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 보충 설명 노트 */}
      {notes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4 sm:mb-6 shadow-sm">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <span className="font-barlow font-semibold text-gray-800 tracking-wide uppercase text-xs sm:text-sm">
              보충 설명
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {notes.map((note) => (
              <div key={note.id} className="flex items-start gap-2 px-3 sm:px-4 py-2 sm:py-2.5">
                <div className="text-gray-500 text-xs sm:text-sm w-2/5 sm:w-1/3 flex-shrink-0 break-words pt-0.5">
                  {note.label}
                </div>
                <div className="text-gray-900 text-xs sm:text-sm flex-1 min-w-0 font-mono">
                  {note.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 사양 테이블 */}
      {specs.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          등록된 사양이 없습니다.
        </div>
      ) : (
        <SpecTable specs={specs} dict={dict} language={lang} onToggleHide={isAdmin ? toggleSpecHidden : undefined} />
      )}

      {showPhotos && (
        <PhotoGallery model={model} onClose={() => setShowPhotos(false)} />
      )}
    </Layout>
  );
}
