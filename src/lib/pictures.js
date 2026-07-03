/**
 * pictures.js — SharePoint 모델 사진 폴더 조회
 *
 * 모델 상세 화면에서 해당 모델의 사진을 SharePoint 공유폴더에서 조회해 보여준다.
 * 폴더 경로는 모델 정보로부터 자동 매칭한다 (별도 등록/연결 작업 없음).
 *
 * 폴더 구조 (예):
 *   mbtruck-spec/Pictures/
 *     └── MY26/
 *         └── Actros 2863LS 6x2 G5F/   *.jpg, *.png ...
 *
 * - 폴더/파일 목록은 Microsoft Graph `children` 로 조회한다.
 * - 그리드 썸네일은 `thumbnails`(medium/large), 원본은
 *   `@microsoft.graph.downloadUrl`(사전 인증 임시 URL)을 사용한다.
 */

import { graphGet } from './graph';

// ─── SharePoint 위치 (env 로 덮어쓰기 가능) ──────────────────────────
const HOST = import.meta.env.VITE_SP_HOSTNAME || 'startruckkorea.sharepoint.com';
const SITE_PATH = import.meta.env.VITE_SP_SITE_PATH || '/sites/STK-PMM';
// 사진 원본이 들어 있는 루트 폴더 (하위에 MY·모델명 폴더가 있음)
const PICTURES_PATH = (
  import.meta.env.VITE_SP_PICTURES_PATH || 'mbtruck-spec/Pictures'
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

/**
 * 모델 정보로부터 사진 폴더 상대경로를 자동 생성한다.
 *   예: { series:'Actros', code:'2863LS', axle:'6x2', cabin:'G5F', model_year:'MY26' }
 *       → 'MY26/Actros 2863LS 6x2 G5F'
 * 폴더명은 상세 헤더에 표시되는 모델명과 동일한 규칙으로 조립한다.
 */
export function modelPictureFolder(model) {
  if (!model) return null;
  const my = String(model.model_year || '').trim();
  if (!my) return null;
  // 'MY26' 형태 보정 — 숫자만 있으면 접두사 부착
  const myFolder = /^my/i.test(my) ? my.toUpperCase() : `MY${my}`;
  const name = [model.series, model.code, model.axle, model.cabin]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(' ');
  if (!name) return null;
  return `${myFolder}/${name}`;
}

/**
 * 모델의 사진 목록을 조회한다.
 * @returns {{ name, id, thumbUrl, fullUrl }[]}  폴더 없음(404)이면 빈 배열
 */
export async function listModelPictures(model) {
  const rel = modelPictureFolder(model);
  if (!rel) return [];

  const siteId = await resolveSiteId();
  const fullPath = `${PICTURES_PATH}/${rel}`;

  let r;
  try {
    r = await graphGet(
      `/sites/${siteId}/drive/root:/${encodeURI(fullPath)}:/children` +
        `?$top=200&$expand=thumbnails&$select=name,id,file,thumbnails,@microsoft.graph.downloadUrl`
    );
  } catch (err) {
    // 폴더가 아직 없는 모델은 사진 없음으로 취급
    if (/\b404\b/.test(err.message)) return [];
    throw err;
  }

  return (r?.value || [])
    .filter((it) => it.file && IMAGE_RE.test(it.name || ''))
    .map((it) => {
      const thumb = it.thumbnails?.[0];
      return {
        name: it.name,
        id: it.id,
        thumbUrl:
          thumb?.large?.url ||
          thumb?.medium?.url ||
          it['@microsoft.graph.downloadUrl'] ||
          null,
        fullUrl: it['@microsoft.graph.downloadUrl'] || thumb?.large?.url || null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
