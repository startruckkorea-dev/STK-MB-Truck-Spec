/**
 * sourceFiles.js — SharePoint 견적서(.docx) 원본 폴더 탐색
 *
 * 모델 등록 시 로컬 PC 업로드 대신, SharePoint 공유폴더에 모아 둔 견적서
 * .docx 를 직접 골라 등록할 수 있게 한다.
 *
 * 폴더 구조 (예):
 *   mbtruck-spec/Quotation/
 *     ├── MY26/
 *     │   ├── 2026-04/  *.docx
 *     │   └── 2026-05/  *.docx
 *     └── MY27/ ...
 *
 * - 폴더 목록/파일 목록은 Microsoft Graph `children` 로 조회한다.
 * - 선택한 파일은 Graph 가 내려주는 `@microsoft.graph.downloadUrl`
 *   (사전 인증된 임시 URL)로 직접 내려받아 ArrayBuffer 로 파싱한다.
 */

import { graphGet } from './graph';

// ─── SharePoint 위치 (env 로 덮어쓰기 가능) ──────────────────────────
const HOST = import.meta.env.VITE_SP_HOSTNAME || 'startruckkorea.sharepoint.com';
const SITE_PATH = import.meta.env.VITE_SP_SITE_PATH || '/sites/STK-PMM';
// 견적서 .docx 가 들어 있는 루트 폴더 (하위에 MY·생산월 폴더가 있음)
const QUOTATION_PATH = (
  import.meta.env.VITE_SP_QUOTATION_PATH || 'mbtruck-spec/Quotation'
).replace(/^\/+|\/+$/g, '');

// 탐색 트리에서 루트로 표시할 이름
export const QUOTATION_ROOT_LABEL = QUOTATION_PATH.split('/').pop() || '견적서';

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
 * 견적서 루트 기준 상대경로(relPath)의 하위 항목을 조회한다.
 *   relPath '' → 루트
 * @returns {{ folders: {name,id}[], files: {name,id,size,downloadUrl}[] }}
 */
export async function listSourceFolder(relPath = '') {
  const siteId = await resolveSiteId();
  const clean = String(relPath || '').replace(/^\/+|\/+$/g, '');
  const fullPath = clean ? `${QUOTATION_PATH}/${clean}` : QUOTATION_PATH;

  let r;
  try {
    r = await graphGet(
      `/sites/${siteId}/drive/root:/${encodeURI(fullPath)}:/children?$top=400`
    );
  } catch (err) {
    if (/\b404\b/.test(err.message)) {
      throw new Error(
        `SharePoint 견적서 폴더를 찾을 수 없습니다: '${fullPath}'.\n` +
          `해당 경로에 폴더를 만들거나 VITE_SP_QUOTATION_PATH 환경변수를 확인해주세요.`
      );
    }
    throw err;
  }

  const items = r?.value || [];
  const folders = items
    .filter((it) => it.folder)
    .map((it) => ({ name: it.name, id: it.id }))
    // 최신 MY·생산월이 위로 오도록 내림차순
    .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
  const files = items
    .filter((it) => it.file && /\.docx$/i.test(it.name || ''))
    .map((it) => ({
      name: it.name,
      id: it.id,
      size: it.size || 0,
      downloadUrl: it['@microsoft.graph.downloadUrl'] || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  return { folders, files };
}

/** 사전 인증 다운로드 URL 로 .docx 를 내려받아 ArrayBuffer 로 반환 */
export async function downloadSourceFile(downloadUrl) {
  if (!downloadUrl) {
    throw new Error('파일 다운로드 URL 을 가져오지 못했습니다.');
  }
  const res = await fetch(downloadUrl);
  if (!res.ok) {
    throw new Error(`견적서 파일 다운로드 실패 (HTTP ${res.status})`);
  }
  return res.arrayBuffer();
}
