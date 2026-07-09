/**
 * graph.js — Microsoft Graph REST 저수준 헬퍼
 *
 * MSAL([src/lib/msal.js])에서 받은 액세스 토큰으로 Graph API를 호출한다.
 * SharePoint Excel(워크북) 접근은 위임 권한 Files.ReadWrite.All / Sites.ReadWrite.All 로 충분.
 */

import { getGraphToken } from './msal';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// 워크북(파일) 접근에 필요한 스코프
export const FILE_SCOPES = ['Files.ReadWrite.All', 'Sites.ReadWrite.All'];

/**
 * Graph 호출. path 는 '/sites/...' 형태(상대) 또는 전체 URL.
 * 실패 시 Graph 오류 메시지를 담은 Error 를 throw.
 */
async function graphFetch(path, { method = 'GET', body, headers = {}, _retry = 0 } = {}) {
  const token = await getGraphToken(FILE_SCOPES);
  const url = path.startsWith('http') ? path : GRAPH_BASE + path;

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 429(throttle)/503 → Retry-After 만큼 대기 후 재시도 (최대 3회)
  if ((res.status === 429 || res.status === 503) && _retry < 3) {
    const headerWait = Number(res.headers.get('Retry-After'));
    const waitSec = Math.min(headerWait > 0 ? headerWait : 2 ** _retry * 2, 20);
    await new Promise((r) => setTimeout(r, waitSec * 1000));
    return graphFetch(path, { method, body, headers, _retry: _retry + 1 });
  }

  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.error?.message || JSON.stringify(j);
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(`Graph ${method} ${res.status}: ${detail}`);
  }

  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

export const graphGet = (path, opts) => graphFetch(path, { ...opts, method: 'GET' });
export const graphPost = (path, body, opts) => graphFetch(path, { ...opts, method: 'POST', body });
export const graphPatch = (path, body, opts) => graphFetch(path, { ...opts, method: 'PATCH', body });
export const graphDelete = (path, opts) => graphFetch(path, { ...opts, method: 'DELETE' });

/**
 * 바이너리 파일 업로드 (PUT …/content). 이미지 등 소용량 파일용(≤ 4MB 권장).
 * file: Blob/File. 성공 시 생성된 driveItem(JSON) 반환.
 */
export async function graphPutFile(path, file, { _retry = 0 } = {}) {
  const token = await getGraphToken(FILE_SCOPES);
  const url = path.startsWith('http') ? path : GRAPH_BASE + path;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  if ((res.status === 429 || res.status === 503) && _retry < 3) {
    const headerWait = Number(res.headers.get('Retry-After'));
    const waitSec = Math.min(headerWait > 0 ? headerWait : 2 ** _retry * 2, 20);
    await new Promise((r) => setTimeout(r, waitSec * 1000));
    return graphPutFile(path, file, { _retry: _retry + 1 });
  }

  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.error?.message || JSON.stringify(j);
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(`Graph PUT ${res.status}: ${detail}`);
  }
  return res.json();
}
