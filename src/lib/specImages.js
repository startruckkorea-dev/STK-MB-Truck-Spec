/**
 * specImages.js — SharePoint 사양 이미지(spec_picture) 폴더 조회
 *
 * 사양 상세의 각 코드에 대응하는 설명 이미지를 SharePoint 공유폴더에서 조회한다.
 * 별도 등록/연결 작업 없이 **파일명 = 코드명** 규칙으로 자동 매칭한다.
 *   예) 코드 `A0A` → `A0A.jpg` / `a0a.png` …  (대소문자·확장자 무관)
 *
 * 폴더 구조 (평면):
 *   mbtruck-spec/spec_picture/
 *     ├── A0A.jpg
 *     ├── W68K96 80.png
 *     └── ...
 *
 * 폴더 전체를 1회 조회해 { 정규화된_코드: { name, thumbUrl, fullUrl } } 인덱스를
 * 만든다. 앱은 이 인덱스로 "해당 코드에 이미지가 있는지" 를 판단해 [보기] 버튼을
 * 노출한다.
 */

import { graphGet } from './graph';
import { normCode } from './codeIndex';

// ─── SharePoint 위치 (env 로 덮어쓰기 가능) ──────────────────────────
const HOST = import.meta.env.VITE_SP_HOSTNAME || 'startruckkorea.sharepoint.com';
const SITE_PATH = import.meta.env.VITE_SP_SITE_PATH || '/sites/STK-PMM';
// 사양 이미지가 들어 있는 평면 폴더
const SPEC_PICTURES_PATH = (
  import.meta.env.VITE_SP_SPEC_PICTURES_PATH || 'mbtruck-spec/spec_picture'
).replace(/^\/+|\/+$/g, '');

const IMAGE_RE = /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i;

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

/** 파일명에서 확장자를 뗀 뒤 코드 정규화 (대문자/trim) */
function fileNameToCode(name) {
  const base = String(name || '').replace(/\.[^.]+$/, '');
  return normCode(base);
}

/**
 * spec_picture 폴더의 이미지 목록 → { 정규화코드: { name, thumbUrl, fullUrl } } 인덱스.
 * 폴더가 없거나(404) 조회 실패 시 빈 객체를 반환한다 (기능만 비활성, 앱은 정상 동작).
 */
export async function listSpecImages() {
  let siteId;
  try {
    siteId = await resolveSiteId();
  } catch {
    return {};
  }

  const fullPath = SPEC_PICTURES_PATH;
  let r;
  try {
    r = await graphGet(
      `/sites/${siteId}/drive/root:/${encodeURI(fullPath)}:/children` +
        `?$top=999&$expand=thumbnails&$select=name,id,file,thumbnails,@microsoft.graph.downloadUrl`
    );
  } catch (err) {
    if (/\b404\b/.test(err.message)) return {}; // 폴더 없음
    return {};
  }

  const index = {};
  for (const it of r?.value || []) {
    if (!it.file || !IMAGE_RE.test(it.name || '')) continue;
    const code = fileNameToCode(it.name);
    if (!code || index[code]) continue; // 첫 파일 우선 (동일 코드 중복 시)
    const thumb = it.thumbnails?.[0];
    index[code] = {
      name: it.name,
      id: it.id,
      thumbUrl:
        thumb?.large?.url ||
        thumb?.medium?.url ||
        it['@microsoft.graph.downloadUrl'] ||
        null,
      fullUrl: it['@microsoft.graph.downloadUrl'] || thumb?.large?.url || null,
    };
  }
  return index;
}

/** 관리자 안내용 — 사양 이미지 폴더의 SharePoint 경로 */
export function specImageFolderPath() {
  return SPEC_PICTURES_PATH;
}
