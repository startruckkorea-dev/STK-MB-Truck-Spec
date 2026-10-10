/**
 * activityLog.js — 사용자 접속·다운로드 기록 (관리자 통계용)
 *
 * 일반 사용자는 데이터 워크북에 "읽기" 권한만 있으므로 워크북에는 쓸 수 없다.
 * 그래서 SharePoint `mbtruck-spec/Log/` 폴더에 **사용자별 JSON 파일 1개**
 * (`{이메일}.json`)를 두고, 각자 자기 파일에만 이어 쓴다 → 사용자 간 쓰기 충돌이 없다.
 * 관리자는 폴더의 모든 파일을 읽어 통계 화면에서 집계한다.
 *
 * ⚠️ `Log` 폴더는 앱 사용자 전원에게 "편집" 권한이 있어야 기록이 남는다
 *    (권한이 없으면 기록은 조용히 건너뛴다 — 앱 동작에는 영향 없음).
 *
 * 이벤트: { t: ISO시각, a: 'login'|'download', n: 이름, r: 역할,
 *           k?: 'excel'|'pdf', s?: 'detail'|'compare', m?: 대상 모델 }
 */

import { graphGet, graphPost, graphPutFile } from './graph';

const HOST = import.meta.env.VITE_SP_HOSTNAME || 'startruckkorea.sharepoint.com';
const SITE_PATH = import.meta.env.VITE_SP_SITE_PATH || '/sites/STK-PMM';
const LOG_PATH = (import.meta.env.VITE_SP_LOG_PATH || 'mbtruck-spec/Log').replace(/^\/+|\/+$/g, '');

const KEEP_DAYS = 120;
const MAX_EVENTS = 3000;

export function logFolderPath() {
  return LOG_PATH;
}

let _sitePromise = null;
function resolveSiteId() {
  if (!_sitePromise) {
    _sitePromise = graphGet(`/sites/${HOST}:${SITE_PATH}`)
      .then((s) => s.id)
      .catch((err) => { _sitePromise = null; throw err; });
  }
  return _sitePromise;
}

let _folderReady = null;
function ensureFolder(siteId) {
  if (!_folderReady) {
    _folderReady = (async () => {
      try {
        await graphGet(`/sites/${siteId}/drive/root:/${encodeURI(LOG_PATH)}:?$select=id`);
        return;
      } catch (err) {
        if (!/\b404\b/.test(err.message)) throw err;
      }
      const parts = LOG_PATH.split('/');
      const name = parts.pop();
      const parent = parts.join('/');
      await graphPost(`/sites/${siteId}/drive/${parent ? `root:/${encodeURI(parent)}:` : 'root'}/children`, {
        name,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      });
    })().catch((err) => { _folderReady = null; throw err; });
  }
  return _folderReady;
}

const fileNameFor = (email) =>
  `${String(email || 'unknown').toLowerCase().replace(/[^a-z0-9@._-]/g, '_')}.json`;

function parseJson(raw) {
  if (Array.isArray(raw)) return raw;
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// ─── 기록 (모든 사용자) ──────────────────────────────────────────────
let _identity = null;     // { email, name, role }
let _events = null;       // 내 파일 내용 캐시
let _chain = Promise.resolve();

/** 로그인 확정 후 호출 — 이후 logEvent 가 이 신원으로 기록한다 */
export function setLogIdentity(identity) {
  if (_identity?.email !== identity?.email) _events = null;
  _identity = identity;
}

async function loadOwn(siteId) {
  if (_events) return _events;
  try {
    const raw = await graphGet(
      `/sites/${siteId}/drive/root:/${encodeURI(`${LOG_PATH}/${fileNameFor(_identity.email)}`)}:/content`
    );
    _events = parseJson(raw);
  } catch (err) {
    if (!/\b404\b/.test(err.message)) throw err;
    _events = [];
  }
  return _events;
}

/** 이벤트 1건 기록 (실패해도 예외를 던지지 않는다) */
export function logEvent(event) {
  if (!_identity?.email) return Promise.resolve();
  const identity = _identity;
  const rec = { t: new Date().toISOString(), n: identity.name, r: identity.role, ...event };
  _chain = _chain
    .then(async () => {
      const siteId = await resolveSiteId();
      await ensureFolder(siteId);
      const events = await loadOwn(siteId);
      const cutoff = Date.now() - KEEP_DAYS * 86400000;
      const next = [...events, rec].filter((e) => new Date(e.t).getTime() >= cutoff).slice(-MAX_EVENTS);
      const blob = new Blob([JSON.stringify(next)], { type: 'application/json' });
      await graphPutFile(
        `/sites/${siteId}/drive/root:/${encodeURI(`${LOG_PATH}/${fileNameFor(identity.email)}`)}:/content`,
        blob
      );
      _events = next;
    })
    .catch((err) => {
      _events = null; // 다음 기록 때 다시 읽어 동기화
      console.warn('[activityLog] 기록 실패 (무시):', err.message);
    });
  return _chain;
}

/** 탭(세션)·일자당 1회만 접속 기록 */
export function logVisitOnce() {
  const key = `act_visit_${new Date().toDateString()}_${_identity?.email}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch { /* sessionStorage 불가 시 그냥 기록 */ }
  logEvent({ a: 'login' });
}

/** 다운로드 기록 — kind: 'excel'|'pdf', scope: 'detail'|'compare', target: 모델명 문자열 */
export function logDownload(kind, scope, target) {
  return logEvent({ a: 'download', k: kind, s: scope, m: target });
}

// ─── 조회 (관리자) ───────────────────────────────────────────────────
/** 모든 사용자 파일을 읽어 { email, ...event } 배열로 반환 */
export async function readAllEvents() {
  const siteId = await resolveSiteId();
  let url = `/sites/${siteId}/drive/root:/${encodeURI(LOG_PATH)}:/children?$select=id,name,file&$top=200`;
  const files = [];
  try {
    while (url) {
      const page = await graphGet(url);
      files.push(...(page.value || []).filter((f) => f.file && /\.json$/i.test(f.name)));
      url = page['@odata.nextLink'] || null;
    }
  } catch (err) {
    if (/\b404\b/.test(err.message)) return { events: [], folderMissing: true };
    throw err;
  }
  const events = [];
  const BATCH = 8;
  for (let i = 0; i < files.length; i += BATCH) {
    await Promise.all(
      files.slice(i, i + BATCH).map(async (f) => {
        try {
          const raw = await graphGet(`/sites/${siteId}/drive/items/${f.id}/content`);
          const email = f.name.replace(/\.json$/i, '');
          parseJson(raw).forEach((e) => events.push({ email, ...e }));
        } catch (err) {
          console.warn(`[activityLog] ${f.name} 읽기 실패:`, err.message);
        }
      })
    );
  }
  return { events, folderMissing: false };
}
