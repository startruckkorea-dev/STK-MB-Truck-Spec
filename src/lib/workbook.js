/**
 * workbook.js — SharePoint Excel(워크북) 데이터 액세스
 *
 * SharePoint `mbtruck-spec/mbtruck-spec-data.xlsx` 의 각 시트를 Microsoft Graph
 * Workbook API 로 읽고 쓴다. Excel "표(Table)" 객체에 의존하지 않고 워크시트
 * 범위(range)를 직접 조작한다 — 1행 헤더, 2행부터 데이터.
 *
 * 시트 스키마는 scripts/export-to-xlsx.mjs 의 SHEETS 와 반드시 일치해야 한다.
 */

import { graphGet, graphPatch, graphPost } from './graph';

// ─── SharePoint 위치 (env 로 덮어쓰기 가능) ──────────────────────────
const HOST = import.meta.env.VITE_SP_HOSTNAME || 'startruckkorea.sharepoint.com';
const SITE_PATH = import.meta.env.VITE_SP_SITE_PATH || '/sites/STK-PMM';
// 워크북이 들어 있는 폴더 (이 폴더 안의 .xlsx 를 자동 탐색)
const FOLDER_PATH = import.meta.env.VITE_SP_FOLDER_PATH || 'mbtruck-spec/Code';
// 동명 파일이 여럿일 때 우선 선택할 이름
const PREFERRED_FILE = 'mbtruck-spec-data.xlsx';

// ─── 시트 스키마 ─────────────────────────────────────────────────────
export const SHEETS = {
  code_dict: {
    columns: ['id', 'code', 'name_en', 'name_ko', 'category', 'hex_color', 'is_hidden'],
    types: { id: 'num', is_hidden: 'bool' },
  },
  models: {
    columns: ['id', 'series', 'code', 'axle', 'cabin', 'code_desc', 'name_ko', 'model_year', 'production_month', 'badge', 'is_visible', 'sort_order'],
    types: { id: 'num', is_visible: 'bool', sort_order: 'num' },
  },
  specs: {
    columns: ['id', 'model_id', 'category', 'spec_key', 'spec_value', 'label_ko', 'use_translate', 'is_color', 'is_hidden', 'sort_order'],
    types: { id: 'num', model_id: 'num', use_translate: 'bool', is_color: 'bool', is_hidden: 'bool', sort_order: 'num' },
  },
  model_notes: {
    columns: ['id', 'model_id', 'label', 'content', 'sort_order'],
    types: { id: 'num', model_id: 'num', sort_order: 'num' },
  },
  users: {
    columns: ['email', 'name', 'role', 'is_active'],
    types: { is_active: 'bool' },
  },
};

// ─── 파일(워크북) 위치 해석 — 1회 캐시 ───────────────────────────────
let _filePromise = null;

function resolveFile() {
  if (!_filePromise) {
    _filePromise = (async () => {
      const site = await graphGet(`/sites/${HOST}:${SITE_PATH}`);
      // 폴더 내 .xlsx 워크북 자동 탐색 (파일명 무관)
      const listing = await graphGet(
        `/sites/${site.id}/drive/root:/${FOLDER_PATH}:/children?$select=name,id,webUrl,file`
      );
      const xlsx = (listing.value || []).filter(
        (it) => it.file && /\.xlsx$/i.test(it.name || '')
      );
      if (xlsx.length === 0) {
        throw new Error(
          `SharePoint '${FOLDER_PATH}' 폴더에서 .xlsx 워크북 파일을 찾지 못했습니다.`
        );
      }
      const item =
        xlsx.find((f) => (f.name || '').toLowerCase() === PREFERRED_FILE) || xlsx[0];
      return { siteId: site.id, itemId: item.id, webUrl: item.webUrl };
    })().catch((err) => {
      _filePromise = null; // 실패 시 다음 호출에서 재시도 가능
      throw err;
    });
  }
  return _filePromise;
}

export async function getFileWebUrl() {
  return (await resolveFile()).webUrl;
}

async function wbBase() {
  const { siteId, itemId } = await resolveFile();
  return `/sites/${siteId}/drive/items/${itemId}/workbook`;
}

// ─── 값 변환 ─────────────────────────────────────────────────────────
function colLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = (n - m - 1) / 26;
  }
  return s;
}

function coerceRead(v, type) {
  if (type === 'num') return v === '' || v == null ? null : Number(v);
  if (type === 'bool') return v === true || v === 1 || String(v).trim().toUpperCase() === 'TRUE';
  return v === '' || v == null ? null : String(v);
}

function rowToValues(sheet, obj) {
  return SHEETS[sheet].columns.map((c) => {
    const v = obj[c];
    return v === null || v === undefined ? '' : v; // ''=셀 비움, null=변경안함이므로 ''사용
  });
}

function valuesToRow(sheet, vals) {
  const { columns, types } = SHEETS[sheet];
  const obj = {};
  columns.forEach((c, i) => { obj[c] = coerceRead(vals[i], types[c]); });
  return obj;
}

// ─── 읽기 ────────────────────────────────────────────────────────────
/** 시트 전체를 객체 배열로 반환 (시트 행 순서 유지) */
export async function readSheet(name) {
  const base = await wbBase();
  const r = await graphGet(
    `${base}/worksheets('${name}')/usedRange(valuesOnly=true)?$select=values,rowCount`
  );
  const values = r?.values || [];
  if (values.length < 2) return []; // 헤더만 또는 빈 시트
  return values.slice(1).map((v) => valuesToRow(name, v));
}

/** 특정 데이터 행(0-base index) 1줄만 읽음 — 동시편집 검증용 */
export async function readRow(name, dataIndex) {
  const base = await wbBase();
  const lastCol = colLetter(SHEETS[name].columns.length);
  const n = dataIndex + 2;
  const r = await graphGet(
    `${base}/worksheets('${name}')/range(address='A${n}:${lastCol}${n}')?$select=values`
  );
  const vals = r?.values?.[0];
  return vals ? valuesToRow(name, vals) : null;
}

// ─── 쓰기 ────────────────────────────────────────────────────────────
/** 데이터 행(0-base index) 1줄 갱신 */
export async function updateRow(name, dataIndex, obj) {
  const base = await wbBase();
  const lastCol = colLetter(SHEETS[name].columns.length);
  const n = dataIndex + 2;
  await graphPatch(
    `${base}/worksheets('${name}')/range(address='A${n}:${lastCol}${n}')`,
    { values: [rowToValues(name, obj)] }
  );
}

/** 시트 끝에 행 추가 (라이브 행 수를 조회해 충돌 회피) */
export async function appendRows(name, objs) {
  if (!objs.length) return;
  const base = await wbBase();
  const lastCol = colLetter(SHEETS[name].columns.length);
  const ur = await graphGet(
    `${base}/worksheets('${name}')/usedRange(valuesOnly=true)?$select=rowCount`
  );
  const start = (ur?.rowCount || 1) + 1;
  const end = start + objs.length - 1;
  await graphPatch(
    `${base}/worksheets('${name}')/range(address='A${start}:${lastCol}${end}')`,
    { values: objs.map((o) => rowToValues(name, o)) }
  );
}

/** 데이터 행(0-base index) 1줄 삭제 (아래 행 위로 당김) */
export async function deleteRow(name, dataIndex) {
  const base = await wbBase();
  const lastCol = colLetter(SHEETS[name].columns.length);
  const n = dataIndex + 2;
  await graphPost(
    `${base}/worksheets('${name}')/range(address='A${n}:${lastCol}${n}')/delete`,
    { shift: 'Up' }
  );
}

/** 시트 데이터 전체를 objs 로 교체 (app 관리 시트: models/specs/model_notes/users) */
export async function overwriteSheet(name, objs) {
  const base = await wbBase();
  const lastCol = colLetter(SHEETS[name].columns.length);

  const ur = await graphGet(
    `${base}/worksheets('${name}')/usedRange(valuesOnly=true)?$select=rowCount`
  );
  const oldRows = Math.max(0, (ur?.rowCount || 1) - 1);

  // 새 데이터 쓰기 (대용량 대비 청크 분할)
  const CHUNK = 1000;
  for (let i = 0; i < objs.length; i += CHUNK) {
    const slice = objs.slice(i, i + CHUNK);
    const start = i + 2;
    const end = start + slice.length - 1;
    await graphPatch(
      `${base}/worksheets('${name}')/range(address='A${start}:${lastCol}${end}')`,
      { values: slice.map((o) => rowToValues(name, o)) }
    );
  }

  // 남은 옛 행 삭제
  if (oldRows > objs.length) {
    const delStart = objs.length + 2;
    const delEnd = oldRows + 1;
    await graphPost(
      `${base}/worksheets('${name}')/range(address='A${delStart}:${lastCol}${delEnd}')/delete`,
      { shift: 'Up' }
    );
  }
}
