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
    // 인증 자료 링크(homolog_spec_url=제원표, homolog_view_url=외관사면도)는 sort_order 뒤에 추가.
    // 앱은 컬럼을 위치 기준으로 읽으므로 반드시 맨 뒤에 둔다(기존 컬럼 순서 유지).
    columns: ['id', 'series', 'code', 'axle', 'cabin', 'code_desc', 'name_ko', 'model_year', 'production_month', 'badge', 'is_visible', 'sort_order', 'homolog_spec_url', 'homolog_view_url'],
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
  // 공지사항 — 모델 목록 상단 게시판. 첨부파일은 SharePoint `Notice` 폴더에 올리고
  // attachments 컬럼에 JSON 문자열([{id,name,size,webUrl}])로 보관한다.
  notices: {
    columns: ['id', 'title', 'content', 'is_pinned', 'is_visible', 'author', 'created_at', 'updated_at', 'attachments', 'sort_order'],
    types: { id: 'num', is_pinned: 'bool', is_visible: 'bool', sort_order: 'num' },
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

// ─── 워크북 세션 ─────────────────────────────────────────────────────
// 세션 없이 호출하면 Graph 가 요청마다 워크북을 새로 열어 느리다. 여러 쓰기를 묶을 때
// withSession() 으로 감싸면 같은 세션(workbook-session-id)을 재사용한다.
let _sessionId = null;

/** 현재 세션이 있으면 헤더를 붙인 옵션 반환 */
const sOpts = () => (_sessionId ? { headers: { 'workbook-session-id': _sessionId } } : undefined);

/**
 * fn 을 워크북 세션(persistChanges=true) 안에서 실행한다.
 * 세션 생성에 실패하면 세션 없이 그대로 실행한다(기존 동작).
 */
export async function withSession(fn) {
  if (_sessionId) return fn(); // 이미 세션 안
  const base = await wbBase();
  try {
    const s = await graphPost(`${base}/createSession`, { persistChanges: true });
    _sessionId = s?.id || null;
  } catch (err) {
    console.warn('[workbook] 세션 생성 실패 — 세션 없이 진행:', err.message);
  }
  const sid = _sessionId;
  try {
    return await fn();
  } finally {
    _sessionId = null;
    if (sid) {
      graphPost(`${base}/closeSession`, undefined, {
        headers: { 'workbook-session-id': sid },
      }).catch(() => {});
    }
  }
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

/**
 * 시트가 없으면 만들고 1행에 헤더를 써 넣는다 (이미 있으면 아무 것도 안 함).
 * 워크북에 나중에 추가된 시트(notices 등)를 관리자가 수동으로 만들지 않아도 되게 한다.
 */
export async function ensureSheet(name) {
  const base = await wbBase();
  try {
    await graphGet(`${base}/worksheets('${name}')?$select=name`);
    return false; // 이미 있음
  } catch (err) {
    if (!/\b404\b/.test(err.message)) throw err;
  }
  await graphPost(`${base}/worksheets/add`, { name });
  const cols = SHEETS[name].columns;
  await graphPatch(
    `${base}/worksheets('${name}')/range(address='A1:${colLetter(cols.length)}1')`,
    { values: [cols] }
  );
  return true; // 새로 만듦
}

/**
 * readSheet 와 같지만 실패하면 빈 배열을 반환한다 (선택 기능용).
 * 아직 만들어지지 않은 시트(`notices` 등)나 그 조회 실패 때문에 앱 전체 데이터
 * 로드가 깨지면 안 되므로, 404 뿐 아니라 어떤 오류든 삼키고 빈 목록으로 둔다.
 */
export async function readSheetIfExists(name) {
  try {
    return await readSheet(name);
  } catch (err) {
    console.warn(`[workbook] '${name}' 시트를 읽지 못했습니다 (무시):`, err.message);
    return [];
  }
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

/**
 * 시트 데이터 전체를 objs 로 교체 (app 관리 시트: models/specs/model_notes/users)
 *
 * prevObjs(메모리상 기존 데이터)를 주면 "바뀐 구간"만 쓴다:
 *   - 앞쪽에서 처음 달라지는 행 ~ (길이가 같으면) 뒤쪽에서 마지막으로 달라지는 행
 *   - 길이가 다르면 처음 달라지는 행부터 끝까지
 * 단, 시트의 실제 행 수가 prevObjs 와 다르면(다른 사람이 변경) 안전하게 전체를 다시 쓴다.
 */
export async function overwriteSheet(name, objs, prevObjs = null) {
  const base = await wbBase();
  const lastCol = colLetter(SHEETS[name].columns.length);
  const newVals = objs.map((o) => rowToValues(name, o));

  // 변경 구간 계산 (prev 기준)
  let from = 0;
  let to = newVals.length; // exclusive
  if (prevObjs) {
    const key = (v) => JSON.stringify(v);
    const oldKeys = prevObjs.map((o) => key(rowToValues(name, o)));
    const newKeys = newVals.map(key);
    while (from < newKeys.length && from < oldKeys.length && newKeys[from] === oldKeys[from]) from++;
    if (newKeys.length === oldKeys.length) {
      if (from === newKeys.length) return; // 변경 없음 → 아무 요청도 안 보냄
      while (to > from && newKeys[to - 1] === oldKeys[to - 1]) to--;
    }
  }

  const ur = await graphGet(
    `${base}/worksheets('${name}')/usedRange(valuesOnly=true)?$select=rowCount`,
    sOpts()
  );
  const oldRows = Math.max(0, (ur?.rowCount || 1) - 1);

  // 메모리와 시트 행 수가 다르면 diff 를 믿을 수 없음 → 전체 쓰기
  if (prevObjs && oldRows !== prevObjs.length) {
    from = 0;
    to = newVals.length;
  }

  // 변경 구간 쓰기 (대용량 대비 청크 분할)
  const CHUNK = 1000;
  for (let i = from; i < to; i += CHUNK) {
    const slice = newVals.slice(i, Math.min(i + CHUNK, to));
    const start = i + 2;
    const end = start + slice.length - 1;
    await graphPatch(
      `${base}/worksheets('${name}')/range(address='A${start}:${lastCol}${end}')`,
      { values: slice },
      sOpts()
    );
  }

  // 남은 옛 행 삭제
  if (oldRows > objs.length) {
    const delStart = objs.length + 2;
    const delEnd = oldRows + 1;
    await graphPost(
      `${base}/worksheets('${name}')/range(address='A${delStart}:${lastCol}${delEnd}')/delete`,
      { shift: 'Up' },
      sOpts()
    );
  }
}
