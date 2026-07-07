/**
 * homologation.js — SharePoint 인증(homologation) 자료 폴더 탐색
 *
 * 모델 편집 시 인증 자료(제원표·외관사면도 등)를 SharePoint 공유폴더에서 직접
 * 골라 모델에 연동한다. 링크는 파일의 영구 `webUrl` 을 저장하며, 상세 화면 버튼이
 * 이 URL 로 SharePoint 뷰어를 새 탭에서 연다 (접근권한은 SharePoint 가 통제).
 *
 * ⚠️ 이 폴더는 데이터 워크북(startruckkorea)과 다른 사이트/테넌트(ehyosung/STK-NAS)에
 *    있을 수 있다. 첫 경로 세그먼트가 별도 문서 라이브러리(드라이브)일 수 있으므로
 *    드라이브를 자동 탐지한 뒤 나머지 경로로 탐색한다. (교차 테넌트 접근은 로그인
 *    토큰 권한에 따라 실패할 수 있음)
 */

import { graphGet } from './graph';

// ─── SharePoint 위치 (env 로 덮어쓰기 가능) ──────────────────────────
const HOST = import.meta.env.VITE_SP_HOMOLOGATION_HOSTNAME || 'ehyosung.sharepoint.com';
const SITE_PATH = import.meta.env.VITE_SP_HOMOLOGATION_SITE_PATH || '/sites/STK-NAS';
// 사이트 기준 폴더 경로. 첫 세그먼트가 문서 라이브러리(드라이브) 이름일 수 있다.
const FOLDER_PATH = (
  import.meta.env.VITE_SP_HOMOLOGATION_PATH ||
  'STK/HS_STK-Shared/4. Cross-Department/도면 및 데이터'
).replace(/^\/+|\/+$/g, '');

// 탐색 트리에서 루트로 표시할 이름
export const HOMOLOGATION_ROOT_LABEL = FOLDER_PATH.split('/').filter(Boolean).pop() || '도면 및 데이터';

// ─── 위치(사이트/드라이브/기준경로) 해석 — 1회 캐시 ──────────────────
let _locPromise = null;
function resolveLocation() {
  if (!_locPromise) {
    _locPromise = (async () => {
      const site = await graphGet(`/sites/${HOST}:${SITE_PATH}`);
      const segs = FOLDER_PATH.split('/').filter(Boolean);
      // 문서 라이브러리(드라이브) 목록에서 첫 세그먼트와 이름이 같은 라이브러리를 찾는다.
      // 있으면 그 드라이브 기준으로 나머지 경로를 사용하고, 없으면 기본 드라이브를 쓴다.
      let driveId = null;
      let basePath = FOLDER_PATH;
      try {
        const drives = await graphGet(`/sites/${site.id}/drives?$select=id,name`);
        const match = (drives.value || []).find(
          (d) => (d.name || '').trim().toLowerCase() === (segs[0] || '').trim().toLowerCase()
        );
        if (match) {
          driveId = match.id;
          basePath = segs.slice(1).join('/');
        }
      } catch {
        /* 드라이브 목록 조회 실패 → 기본 드라이브로 폴백 */
      }
      return { siteId: site.id, driveId, basePath };
    })().catch((err) => {
      _locPromise = null; // 실패 시 재시도 가능
      throw err;
    });
  }
  return _locPromise;
}

/**
 * 인증 자료 루트 기준 상대경로(relPath)의 하위 항목을 조회한다.
 *   relPath '' → 루트
 * @returns {{ folders: {name,id}[], files: {name,id,size,webUrl}[] }}
 */
export async function listHomologationFolder(relPath = '') {
  const { siteId, driveId, basePath } = await resolveLocation();
  const clean = String(relPath || '').replace(/^\/+|\/+$/g, '');
  const full = [basePath, clean].filter(Boolean).join('/');
  const drivePart = driveId ? `/drives/${driveId}` : `/sites/${siteId}/drive`;
  const childrenUrl = full
    ? `${drivePart}/root:/${encodeURI(full)}:/children?$top=400`
    : `${drivePart}/root/children?$top=400`;

  let r;
  try {
    r = await graphGet(childrenUrl);
  } catch (err) {
    if (/\b404\b/.test(err.message)) {
      throw new Error(
        `SharePoint 인증 자료 폴더를 찾을 수 없습니다: '${HOST}${SITE_PATH}/${full}'.\n` +
          `경로를 확인하거나 VITE_SP_HOMOLOGATION_* 환경변수를 확인해주세요.`
      );
    }
    if (/\b40[13]\b/.test(err.message)) {
      throw new Error(
        `SharePoint 인증 자료 폴더에 접근할 권한이 없습니다: '${HOST}${SITE_PATH}'.\n` +
          `다른 테넌트/사이트일 경우 로그인 계정에 해당 사이트 접근권한이 필요합니다.`
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
