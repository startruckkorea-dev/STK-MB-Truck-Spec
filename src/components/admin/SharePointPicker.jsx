/**
 * SharePointPicker.jsx — SharePoint 견적서 폴더 탐색 모달
 *
 * 모델 등록 화면에서 로컬 PC 업로드 대신 공유폴더의 .docx 를 직접 고른다.
 * MY 연도 → 생산월 → 파일 순으로 폴더를 내려가며 탐색한다.
 *
 * 기본값은 견적서(.docx) 폴더를 탐색하지만, listFolder/rootLabel/title/hint 를
 * 넘겨 다른 SharePoint 폴더(예: 인증 자료)에도 재사용할 수 있다.
 *
 * 사용법:
 *   {open && (
 *     <SharePointPicker
 *       onPick={(file, folderPath) => { ... }}   // file: {name,downloadUrl|webUrl,size}
 *       onClose={() => setOpen(false)}
 *     />
 *   )}
 */

import { useState, useEffect } from 'react';
import { listSourceFolder, QUOTATION_ROOT_LABEL } from '../../lib/sourceFiles';

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function SharePointPicker({
  onPick,
  onClose,
  listFolder = listSourceFolder,
  rootLabel = QUOTATION_ROOT_LABEL,
  title = 'SharePoint 견적서 선택',
  hint = '폴더를 눌러 이동하고, .docx 파일을 누르면 등록 화면으로 불러옵니다.',
}) {
  const [path, setPath] = useState(''); // 루트 기준 상대경로
  const [data, setData] = useState(null); // { folders, files }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    listFolder(path)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [path]);

  const crumbs = path ? path.split('/') : [];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="font-barlow font-semibold text-gray-800 tracking-wide uppercase text-sm">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-lg leading-none"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 경로(브레드크럼) */}
        <div className="flex items-center gap-1 flex-wrap px-5 py-2 border-b border-gray-100 text-xs">
          <button
            onClick={() => setPath('')}
            className="text-mb-blue hover:underline font-medium"
          >
            {rootLabel}
          </button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-gray-300">/</span>
              <button
                onClick={() => setPath(crumbs.slice(0, i + 1).join('/'))}
                className={
                  i === crumbs.length - 1
                    ? 'text-gray-700 font-medium'
                    : 'text-mb-blue hover:underline font-medium'
                }
              >
                {c}
              </button>
            </span>
          ))}
        </div>

        {/* 목록 */}
        <div className="overflow-y-auto flex-1 min-h-[200px]">
          {loading && (
            <p className="text-sm text-gray-400 text-center py-10 animate-pulse">
              불러오는 중...
            </p>
          )}

          {!loading && error && (
            <div className="m-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-3 whitespace-pre-line">
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <ul className="divide-y divide-gray-100">
              {data.folders.length === 0 && data.files.length === 0 && (
                <li className="text-sm text-gray-400 text-center py-10">
                  이 폴더에 항목이 없습니다.
                </li>
              )}

              {data.folders.map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => setPath(path ? `${path}/${f.name}` : f.name)}
                    className="w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-lg">📁</span>
                    <span className="text-sm text-gray-800 font-medium">{f.name}</span>
                  </button>
                </li>
              ))}

              {data.files.map((file) => (
                <li key={file.id}>
                  <button
                    onClick={() => onPick(file, path)}
                    className="w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-blue-50 transition-colors group"
                  >
                    <span className="text-lg">📄</span>
                    <span className="text-sm text-gray-700 flex-1 truncate group-hover:text-mb-blue">
                      {file.name}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatSize(file.size)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 안내 */}
        <div className="px-5 py-2.5 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            {hint}
          </p>
        </div>
      </div>
    </div>
  );
}
