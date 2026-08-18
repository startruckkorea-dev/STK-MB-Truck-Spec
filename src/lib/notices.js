/**
 * notices.js — 공지사항 첨부파일(SharePoint) 관리
 *
 * 공지 본문·제목은 워크북 `notices` 시트에 저장하고, 첨부파일(이미지·PDF·문서)은
 * SharePoint `mbtruck-spec/Notice/` 폴더에 올린다. 시트에는 파일의 driveItem id 와
 * 이름만 JSON 으로 남기고, 실제 다운로드 URL 은 볼 때마다 Graph 로 새로 받아온다
 * (Graph 의 downloadUrl 은 1시간 정도면 만료되므로 저장해 두면 안 된다).
 *
 * 폴더 구조 (평면):
 *   mbtruck-spec/Notice/
 *     ├── 1712-공지사진.jpg
 *     └── 1713-가격표.pdf
 */

import { graphGet, graphPost, graphPutFile, graphDelete } from './graph';

const HOST = import.meta.env.VITE_SP_HOSTNAME || 'startruckkorea.sharepoint.com';
const SITE_PATH = import.meta.env.VITE_SP_SITE_PATH || '/sites/STK-PMM';
const NOTICE_PATH = (
  import.meta.env.VITE_SP_NOTICE_PATH || 'mbtruck-spec/Notice'
).replace(/^\/+|\/+$/g, '');

/** 첨부 1건 최대 용량 (Graph 단순 업로드 한계 4MB 보다 약간 낮게) */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

const IMAGE_RE = /\.(jpe?g|png|gif|webp|bmp|heic|heif|svg)$/i;
const PDF_RE = /\.pdf$/i;

export const isImageName = (name) => IMAGE_RE.test(String(name || ''));
export const isPdfName = (name) => PDF_RE.test(String(name || ''));

/** 관리자 안내용 — 첨부파일이 저장되는 SharePoint 경로 */
export function noticeFolderPath() {
  return NOTICE_PATH;
}

// ─── 사이트 ID 해석 — 1회 캐시 ───────────────────────────────────────
let _sitePromise = null;
function resolveSiteId() {
  if (!_sitePromise) {
    _sitePromise = graphGet(`/sites/${HOST}:${SITE_PATH}`)
      .then((site) => site.id)
      .catch((err) => {
        _sitePromise = null;
        throw err;
      });
  }
  return _sitePromise;
}

/** Notice 폴더가 없으면 만든다 (첫 업로드 시 1회) */
let _folderReady = null;
function ensureNoticeFolder(siteId) {
  if (!_folderReady) {
    _folderReady = (async () => {
      try {
        await graphGet(`/sites/${siteId}/drive/root:/${encodeURI(NOTICE_PATH)}:?$select=id`);
        return true;
      } catch (err) {
        if (!/\b404\b/.test(err.message)) throw err;
      }
      const parts = NOTICE_PATH.split('/');
      const name = parts.pop();
      const parent = parts.join('/');
      const parentRef = parent ? `root:/${encodeURI(parent)}:` : 'root';
      await graphPost(`/sites/${siteId}/drive/${parentRef}/children`, {
        name,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'replace',
      });
      return true;
    })().catch((err) => {
      _folderReady = null;
      throw err;
    });
  }
  return _folderReady;
}

/** SharePoint 파일명에 쓸 수 없는 문자를 정리한다 */
function safeName(name) {
  return String(name || 'file')
    .replace(/[\\/:*?"<>|#%]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'file';
}

/**
 * 첨부파일 1건 업로드. 같은 이름이 있어도 덮어쓰지 않도록 접두어를 붙인다.
 * @returns { id, name, size, webUrl } — 시트에 JSON 으로 보관할 메타
 */
export async function uploadNoticeFile(file, keyPrefix = '') {
  if (!file) throw new Error('파일이 없습니다.');
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(
      `"${file.name}" 파일이 너무 큽니다 (최대 ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)}MB).`
    );
  }
  const siteId = await resolveSiteId();
  await ensureNoticeFolder(siteId);
  const prefix = keyPrefix ? `${keyPrefix}-` : '';
  const path = `${NOTICE_PATH}/${prefix}${safeName(file.name)}`;
  const item = await graphPutFile(
    `/sites/${siteId}/drive/root:/${encodeURI(path)}:/content`,
    file
  );
  return {
    id: item.id,
    name: file.name,
    size: file.size,
    webUrl: item.webUrl || null,
  };
}

/** 첨부파일 삭제 (이미 지워졌으면 조용히 무시) */
export async function deleteNoticeFile(itemId) {
  if (!itemId) return;
  const siteId = await resolveSiteId();
  try {
    await graphDelete(`/sites/${siteId}/drive/items/${itemId}`);
  } catch (err) {
    if (!/\b404\b/.test(err.message)) throw err;
  }
}

/**
 * 첨부 메타 목록에 유효한 다운로드 URL 을 채워 돌려준다.
 * (URL 은 만료되므로 공지를 펼칠 때마다 새로 조회한다)
 */
export async function resolveNoticeFileUrls(attachments = []) {
  const siteId = await resolveSiteId();
  const out = await Promise.all(
    attachments.map(async (a) => {
      if (!a?.id) return { ...a, url: null, missing: true };
      try {
        const it = await graphGet(
          `/sites/${siteId}/drive/items/${a.id}` +
            `?$select=name,size,webUrl,@microsoft.graph.downloadUrl`
        );
        return {
          ...a,
          url: it['@microsoft.graph.downloadUrl'] || null,
          webUrl: it.webUrl || a.webUrl || null,
          size: a.size ?? it.size,
        };
      } catch {
        return { ...a, url: null, missing: true };
      }
    })
  );
  return out;
}

/** 시트 셀(JSON 문자열) → 첨부 배열 */
export function parseAttachments(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const v = JSON.parse(String(raw));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** 첨부 배열 → 시트 셀(JSON 문자열) */
export function stringifyAttachments(list = []) {
  if (!list.length) return '';
  return JSON.stringify(
    list.map((a) => ({ id: a.id, name: a.name, size: a.size ?? null, webUrl: a.webUrl ?? null }))
  );
}

/** 사람이 읽는 파일 크기 */
export function formatBytes(n) {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
