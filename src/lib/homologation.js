/**
 * homologation.js — SharePoint 인증(homologation) 자료 폴더 탐색
 *
 * 모델 편집 시 인증 자료(제원표·외관사면도 등)를 SharePoint 공유폴더에서 직접
 * 골라 모델에 연동한다. 링크는 파일의 영구 `webUrl` 을 저장하며, 상세 화면 버튼이
 * 이 URL 로 SharePoint 뷰어를 새 탭에서 연다 (접근권한은 SharePoint 가 통제).
 *
 * 폴더 구조는 자유롭게 하위 폴더를 둘 수 있고, 트리로 탐색한다.
 */

import { graphGet } from './graph';

// ─── SharePoint 위치 (env 로 덮어쓰기 가능) ──────────────────────────
const HOST = import.meta.env.VITE_SP_HOSTNAME || 'startruckkorea.sharepoint.com';
const SITE_PATH = import.meta.env.VITE_SP_SITE_PATH || '/sites/STK-PMM';
// 인증 자료가 들어 있는 루트 폴더
const HOMOLOGATION_PATH = (
  import.meta.env.VITE_SP_HOMOLOGATION_PATH || 'mbtruck-spec/Homologation'
).replace(/^\/+|\/+$/g, '');

// 탐색 트리에서 루트로 표시할 이름
export const HOMOLOGATION_ROOT_LABEL = HOMOLOGATION_PATH.split('/').pop() || 'Homologation';

// ─── 사이트 ID 해석 — 1회 캐시 ───────────────────────────────────────
let _sitePromise = null;
function resolveSiteId() {
  if (!_sitePromise) {
    _sitePromise = graphGet(`/sites/${HOST}:${SITE_PATH}`)
      .then((site) => site.id)
      .catch((err) => {
        _sitePromise = null; // 실패 시 재시도 가능
        throw err;
      });
  }
  return _sitePromise;
}

/**
 * 인증 자료 루트 기준 상대경로(relPath)의 하위 항목을 조회한다.
 *   relPath '' → 루트
 * @returns {{ folders: {name,id}[], files: {name,id,size,webUrl}[] }}
 */
export async function listHomologationFolder(relPath = '') {
  const siteId = await resolveSiteId();
  const clean = String(relPath || '').replace(/^\/+|\/+$/g, '');
  const fullPath = clean ? `${HOMOLOGATION_PATH}/${clean}` : HOMOLOGATION_PATH;

  let r;
  try {
    r = await graphGet(
      `/sites/${siteId}/drive/root:/${encodeURI(fullPath)}:/children?$top=400`
    );
  } catch (err) {
    if (/\b404\b/.test(err.message)) {
      throw new Error(
        `SharePoint 인증 자료 폴더를 찾을 수 없습니다: '${fullPath}'.\n` +
          `해당 경로에 폴더를 만들거나 VITE_SP_HOMOLOGATION_PATH 환경변수를 확인해주세요.`
      );
    }
    throw err;
  }

  const items = r?.value || [];
  const folders = items
    .filter((it) => it.folder)
    .map((it) => ({ name: it.name, id: it.id }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const files = items
    .filter((it) => it.file)
    .map((it) => ({
      name: it.name,
      id: it.id,
      size: it.size || 0,
      webUrl: it.webUrl || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  return { folders, files };
}
