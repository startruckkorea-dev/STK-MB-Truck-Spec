/**
 * ExcelImport.jsx — v2
 * AdminDict 페이지 상단에 배치하는 엑셀 가져오기 컴포넌트.
 *
 * 엑셀 형식 (mb_codes_total_translated.xlsx):
 *   A열 = 코드, B열 = 영문 설명, C열 = 국문 번역
 *
 * 사용법:
 *   import ExcelImport from '../../components/admin/ExcelImport';
 *   <ExcelImport onImportComplete={refetch} />
 */

import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';

const BATCH_SIZE = 200;

export default function ExcelImport({ onImportComplete }) {
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | parsing | confirming | importing | done | error
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // ─── 1. 파일 선택 → 파싱 & 미리보기 ────────────────────────
  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    setStatus('parsing');
    setErrorMsg('');
    setPreview(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      // 첫 번째 시트 사용 (시트명 무관)
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // 실제 엑셀 형식: A=코드, B=영문설명, C=국문번역
      const raw = XLSX.utils.sheet_to_json(sheet, {
        header: ['code', 'name_en', 'name_ko'],
        defval: '',
      });

      // 헤더 행 제거 (첫 행이 텍스트 헤더인 경우)
      const firstCode = String(raw[0]?.code ?? '').toLowerCase().trim();
      const dataRows = (firstCode === 'code' || firstCode === '코드' || firstCode === 'english' || firstCode === 'a')
        ? raw.slice(1)
        : raw;

      const rows = dataRows.filter((r) => {
        const code = String(r.code ?? '').trim();
        const nameKo = String(r.name_ko ?? '').trim();
        return code.length > 0 && nameKo.length > 0;
      });

      if (rows.length === 0) {
        throw new Error(
          '유효한 데이터가 없습니다.\n' +
          '엑셀 형식: A=코드, B=영문설명, C=국문번역'
        );
      }

      // DB 현재 코드 조회
      const { data: dbRows, error: fetchErr } = await supabase
        .from('code_dict')
        .select('code, name_ko, is_hidden');
      if (fetchErr) throw new Error(`DB 조회 실패: ${fetchErr.message}`);

      const dbMap = new Map(dbRows.map((r) => [r.code, r]));
      const excelCodes = new Set(rows.map((r) => String(r.code).trim().toUpperCase()));

      const newCodes     = rows.filter((r) => !dbMap.has(String(r.code).trim().toUpperCase()));
      const updatedCodes = rows.filter((r) => {
        const db = dbMap.get(String(r.code).trim().toUpperCase());
        return db && db.name_ko !== String(r.name_ko).trim();
      });
      // 엑셀에 없는 기존 코드 → 확인용 표시만 (자동 변경 안 함)
      const missingCodes = dbRows.filter((r) => !excelCodes.has(r.code));

      setPreview({
        rows,
        fileName: file.name,
        sheetName,
        totalRows: rows.length,
        newCount: newCodes.length,
        updateCount: updatedCodes.length,
        missingCount: missingCodes.length,
      });
      setStatus('confirming');
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  // ─── 2. 가져오기 확인 → Supabase upsert ─────────────────────
  async function handleConfirm() {
    if (!preview) return;
    setStatus('importing');
    setProgress(0);

    try {
      const now = new Date().toISOString();

      const payload = preview.rows.map((r) => {
        return {
          code:       String(r.code).trim().toUpperCase(),
          name_en:    String(r.name_en ?? '').trim() || null,
          name_ko:    String(r.name_ko).trim(),
          category:   null,
          hex_color:  null,
          is_hidden:  false,
          updated_at: now,
        };
      });

      for (let i = 0; i < payload.length; i += BATCH_SIZE) {
        const batch = payload.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .from('code_dict')
          .upsert(batch, { onConflict: 'code' });
        if (error) throw new Error(`업로드 실패 (${i + 1}번째 배치): ${error.message}`);
        setProgress(Math.round(((i + batch.length) / payload.length) * 100));
      }

      setStatus('done');
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onImportComplete?.();
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  }

  function handleCancel() {
    setPreview(null);
    setStatus('idle');
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleReset() {
    setStatus('idle');
    setErrorMsg('');
    setProgress(0);
  }

  // ─── 렌더 ────────────────────────────────────────────────────
  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
      <h3 className="font-barlow font-semibold text-gray-800 tracking-wide uppercase text-sm mb-1">
        엑셀 가져오기
      </h3>
      <p className="text-xs text-gray-400 mb-4">
        mb_codes_total_translated.xlsx (A=코드, B=영문설명, C=국문번역)
      </p>

      {/* 파일 선택 */}
      {(status === 'idle' || status === 'done') && (
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            id="excel-upload-input"
          />
          <label
            htmlFor="excel-upload-input"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-mb-blue text-white text-sm font-medium cursor-pointer hover:bg-mb-blue-dark transition-colors"
          >
            엑셀 파일 선택
          </label>
          {status === 'done' && (
            <span className="text-xs text-green-600 font-medium">가져오기 완료!</span>
          )}
        </div>
      )}

      {/* 파싱 중 */}
      {status === 'parsing' && (
        <p className="text-sm text-gray-400 animate-pulse">파일 분석 중...</p>
      )}

      {/* 오류 */}
      {status === 'error' && (
        <div className="space-y-3">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm whitespace-pre-line">
            {errorMsg}
          </div>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 미리보기 & 확인 */}
      {status === 'confirming' && preview && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            <span className="font-medium text-gray-800">{preview.fileName}</span> ({preview.sheetName}) —
            총 {preview.totalRows.toLocaleString()}개 코드
          </p>

          {/* 변경 요약 */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <SummaryCard value={preview.newCount}    label="신규 추가" color="green" />
            <SummaryCard value={preview.updateCount} label="번역 수정" color="blue" />
            <SummaryCard value={preview.missingCount} label="엑셀 미존재" color="gray" />
          </div>

          {preview.missingCount > 0 && (
            <p className="text-xs text-gray-400 bg-gray-100 rounded p-2">
              * 엑셀에 없는 기존 코드 {preview.missingCount}개는 변경되지 않습니다. (기존 번역 유지)
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-mb-blue text-white text-sm font-medium rounded-lg hover:bg-mb-blue-dark transition-colors"
            >
              가져오기 확인
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 진행 중 */}
      {status === 'importing' && (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">가져오는 중... {progress}%</p>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-mb-blue h-2 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ value, label, color }) {
  const colorMap = {
    green: 'bg-green-50 border-green-200 text-green-700',
    blue:  'bg-blue-50 border-blue-200 text-mb-blue',
    gray:  'bg-gray-100 border-gray-200 text-gray-500',
  };
  return (
    <div className={`border rounded-lg p-3 ${colorMap[color]}`}>
      <div className="font-barlow font-bold text-2xl">{value.toLocaleString()}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
