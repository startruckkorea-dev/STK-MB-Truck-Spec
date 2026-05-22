/**
 * ExcelImport.jsx — v3 (SharePoint)
 *
 * 코드 사전은 이제 SharePoint Excel(mbtruck-spec-data.xlsx)에 저장된다.
 * 관리자는 파일을 직접 열어 편집하고, [다시 불러오기]로 앱에 반영한다.
 *
 * 사용법:
 *   import ExcelImport from '../../components/admin/ExcelImport';
 *   <ExcelImport onImportComplete={refetch} />
 */

import { useState, useEffect } from 'react';
import { getFileWebUrl } from '../../lib/workbook';

export default function ExcelImport({ onImportComplete }) {
  const [fileUrl, setFileUrl] = useState(null);
  const [reloading, setReloading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getFileWebUrl()
      .then(setFileUrl)
      .catch(() => setFileUrl(null));
  }, []);

  async function handleReload() {
    setReloading(true);
    setDone(false);
    try {
      await onImportComplete?.();
      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } finally {
      setReloading(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
      <h3 className="font-barlow font-semibold text-gray-800 tracking-wide uppercase text-sm mb-1">
        SharePoint 코드 사전
      </h3>
      <p className="text-xs text-gray-400 mb-4">
        코드 사전은 SharePoint Excel(mbtruck-spec-data.xlsx)에 저장됩니다.
        파일을 직접 열어 편집한 뒤 [다시 불러오기]를 누르면 앱에 반영됩니다.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {fileUrl ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-mb-blue text-white text-sm font-medium hover:bg-mb-blue-dark transition-colors"
          >
            SharePoint에서 Excel 열기
          </a>
        ) : (
          <span className="text-xs text-gray-400">파일 위치 확인 중...</span>
        )}

        <button
          onClick={handleReload}
          disabled={reloading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          {reloading ? '불러오는 중...' : '다시 불러오기'}
        </button>

        {done && (
          <span className="text-xs text-green-600 font-medium">최신 데이터로 갱신했습니다.</span>
        )}
      </div>
    </div>
  );
}
