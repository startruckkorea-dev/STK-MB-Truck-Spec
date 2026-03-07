/**
 * sync-codes.mjs — v2
 * Excel(mb_codes_total_translated.xlsx) → Supabase code_dict 동기화
 *
 * 엑셀 형식 (CLAUDE_v2.md 기준):
 *   A열 = 카테고리, B열 = 영문 코드, C열 = 국문 번역
 *   D열 = Y/N (Y=표시 → is_hidden=false, N=숨김 → is_hidden=true)
 *   E열 = HEX 컬러 (선택)
 *
 * 사용법:
 *   node scripts/sync-codes.mjs [엑셀파일경로]
 *   기본 경로: code/mb_codes_total_translated.xlsx
 *
 * 사전 준비:
 *   .env.local에 VITE_SUPABASE_URL + SUPABASE_SERVICE_KEY 필요
 *   (Supabase Dashboard > Settings > API > service_role key)
 */

import { readFileSync, existsSync } from 'fs';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// .env.local 로드
config({ path: path.join(ROOT, '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BATCH_SIZE = 500;

const EXCEL_PATH = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, 'code', 'mb_codes_total_translated.xlsx');

// ── 검증 ───────────────────────────────────────────────────────
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('오류: .env.local에 VITE_SUPABASE_URL과 SUPABASE_SERVICE_KEY를 설정해주세요.');
  process.exit(1);
}
if (!existsSync(EXCEL_PATH)) {
  console.error(`오류: 엑셀 파일을 찾을 수 없습니다: ${EXCEL_PATH}`);
  process.exit(1);
}

// ── 메인 ───────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(60));
  console.log('MB Trucks 코드 사전 동기화 (v2)');
  console.log('='.repeat(60));
  console.log(`엑셀 파일: ${EXCEL_PATH}`);
  console.log(`Supabase : ${SUPABASE_URL}`);
  console.log('');

  // 1. 엑셀 파싱
  console.log('[1/3] 엑셀 파일 읽는 중...');
  const buf = readFileSync(EXCEL_PATH);
  const workbook = XLSX.read(buf);
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
    ? raw.slice(1) : raw;

  const validRows = dataRows.filter((r) => {
    const code   = String(r.code   ?? '').trim();
    const nameKo = String(r.name_ko ?? '').trim();
    return code.length > 0 && nameKo.length > 0;
  });

  console.log(`  시트: "${sheetName}" / 총 ${raw.length}행 → 유효 ${validRows.length}행`);

  if (validRows.length === 0) {
    console.error('오류: 유효 데이터가 없습니다. A=카테고리, B=코드, C=국문 형식을 확인하세요.');
    process.exit(1);
  }

  // 2. Supabase 연결
  console.log('\n[2/3] Supabase 연결 중...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: dbRows, error: fetchErr } = await supabase
    .from('code_dict')
    .select('code, name_ko, is_hidden');
  if (fetchErr) {
    console.error('오류: code_dict 조회 실패:', fetchErr.message);
    process.exit(1);
  }
  console.log(`  현재 DB 코드 수: ${dbRows.length}개`);

  // 3. Upsert
  console.log('\n[3/3] 코드 동기화 중...');
  const now = new Date().toISOString();

  const payload = validRows.map((r) => {
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

  // 코드 중복 제거 (마지막 값 우선)
  const dedupMap = new Map();
  payload.forEach((r) => dedupMap.set(r.code, r));
  const dedupedPayload = [...dedupMap.values()];
  console.log(`  중복 제거: ${payload.length} → ${dedupedPayload.length}개`);

  // 통계 계산
  const dbMap = new Map(dbRows.map((r) => [r.code, r]));
  const excelCodes = new Set(dedupedPayload.map((r) => r.code));
  const newCount  = dedupedPayload.filter((r) => !dbMap.has(r.code)).length;
  const updCount  = dedupedPayload.filter((r) => {
    const db = dbMap.get(r.code);
    return db && db.name_ko !== r.name_ko;
  }).length;
  const missingCount = dbRows.filter((r) => !excelCodes.has(r.code)).length;

  let processed = 0;
  for (let i = 0; i < dedupedPayload.length; i += BATCH_SIZE) {
    const batch = dedupedPayload.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('code_dict')
      .upsert(batch, { onConflict: 'code' });
    if (error) {
      console.error(`오류: ${i + 1}~${i + batch.length}번째 upsert 실패:`, error.message);
      process.exit(1);
    }
    processed += batch.length;
    const pct = Math.round((processed / dedupedPayload.length) * 100);
    process.stdout.write(`  진행: ${processed}/${dedupedPayload.length} (${pct}%)\r`);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('동기화 완료!');
  console.log(`  신규 코드:         ${newCount}개`);
  console.log(`  번역 수정:         ${updCount}개`);
  console.log(`  엑셀 미존재(유지): ${missingCount}개`);
  console.log(`  전체 처리:         ${processed}개`);
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('\n오류:', err.message);
  process.exit(1);
});
