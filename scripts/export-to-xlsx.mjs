/**
 * export-to-xlsx.mjs
 * Supabase → SharePoint 이전용 일회성 추출 스크립트.
 *
 * Supabase의 code_dict / models / specs / model_notes 테이블을 모두 읽어
 * mbtruck-spec-data.xlsx (시트 5개) 로 저장한다.
 * 생성된 파일을 SharePoint `mbtruck-spec` 폴더에 업로드하면 앱이 그 파일을
 * Microsoft Graph로 직접 읽고 쓴다.
 *
 * 사용법:
 *   node scripts/export-to-xlsx.mjs
 *
 * 사전 준비: .env.local 에 VITE_SUPABASE_URL + SUPABASE_SERVICE_KEY
 */

import ExcelJS from 'exceljs';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
config({ path: path.join(ROOT, '.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ .env.local 에 VITE_SUPABASE_URL 과 SUPABASE_SERVICE_KEY 가 필요합니다.');
  process.exit(1);
}

const OUT_FILE = path.join(ROOT, 'mbtruck-spec-data.xlsx');
const PAGE = 1000;

// 시트별 컬럼 정의 (앱 데이터 계층 src/lib/workbook.js 와 반드시 일치)
const SHEETS = {
  code_dict: ['id', 'code', 'name_en', 'name_ko', 'category', 'hex_color', 'is_hidden'],
  models: ['id', 'series', 'code', 'axle', 'cabin', 'code_desc', 'name_ko', 'model_year', 'badge', 'is_visible'],
  specs: ['id', 'model_id', 'category', 'spec_key', 'spec_value', 'label_ko', 'use_translate', 'is_color', 'is_hidden', 'sort_order'],
  model_notes: ['id', 'model_id', 'label', 'content', 'sort_order'],
  users: ['email', 'name', 'role', 'is_active'],
};

/** Supabase 테이블 전체를 페이지네이션으로 추출 */
async function fetchAll(table, columns) {
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const url =
      `${SUPABASE_URL}/rest/v1/${table}` +
      `?select=${columns.join(',')}&order=id.asc&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${table} 조회 실패 (${res.status}): ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    process.stdout.write(`\r  ${table}: ${rows.length}개 추출...`);
    if (page.length < PAGE) break;
  }
  process.stdout.write('\n');
  return rows;
}

async function main() {
  console.log('▶ Supabase 데이터 추출 시작\n');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'mb-truck-spec migration';
  wb.created = new Date();

  for (const [sheetName, columns] of Object.entries(SHEETS)) {
    const ws = wb.addWorksheet(sheetName);
    ws.columns = columns.map((c) => ({ header: c, key: c, width: 18 }));
    ws.getRow(1).font = { bold: true };

    // users 시트는 Supabase 원본이 없음 → 헤더만 (앱에서 부트스트랩)
    if (sheetName === 'users') {
      console.log(`  ${sheetName}: 헤더만 (앱에서 관리)`);
      continue;
    }

    let data = await fetchAll(sheetName, columns);

    // code_dict: 과거 엑셀 가져오기 때 데이터로 잘못 들어간 헤더 행 제거
    if (sheetName === 'code_dict') {
      const HEADER_WORDS = new Set(['code', 'english', 'korean', '코드', '영문', '국문']);
      const before = data.length;
      data = data.filter((r) => {
        const code = String(r.code ?? '').trim().toLowerCase();
        const ko = String(r.name_ko ?? '').trim().toLowerCase();
        return !(HEADER_WORDS.has(code) && HEADER_WORDS.has(ko));
      });
      if (before !== data.length) {
        console.log(`  ${sheetName}: 헤더 잔재 행 ${before - data.length}개 제외`);
      }
    }

    for (const row of data) {
      ws.addRow(columns.map((c) => (row[c] === null || row[c] === undefined ? null : row[c])));
    }
  }

  await wb.xlsx.writeFile(OUT_FILE);

  console.log('\n✅ 생성 완료:', OUT_FILE);
  for (const name of Object.keys(SHEETS)) {
    const ws = wb.getWorksheet(name);
    console.log(`   - ${name}: ${ws.rowCount - 1}행 (+ 헤더)`);
  }
  console.log('\n다음 단계: 이 파일을 SharePoint `mbtruck-spec` 폴더에 업로드하세요.');
}

main().catch((err) => {
  console.error('\n❌ 오류:', err.message);
  process.exit(1);
});
