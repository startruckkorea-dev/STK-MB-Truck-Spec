/**
 * accessList.js — SharePoint 접근권한 목록(Access List) 읽기
 *
 * 회사 계정이면 누구나 로그인되므로, 역할(admin/staff/sales)은 별도의
 * 접근권한 엑셀로 통제한다.
 *
 * 위치: SharePoint `mbtruck-spec/Access/` 폴더 안의 .xlsx (예: Access_List_2026-06.xlsx).
 *       폴더 안에서 `Access_List*` 파일을 우선 선택하고, 없으면 첫 .xlsx 를 쓴다.
 *
 * 시트 구조(위치 기준):
 *   - G 컬럼(index 6) = 이메일 주소 (키 값)
 *   - H 컬럼(index 7) = 부여할 권한 (Admin / Staff / Sales)
 *   1행은 헤더로 보고, 이메일('@' 포함)이 있는 행만 사용한다.
 */

import { graphGet } from './graph';

// ─── SharePoint 위치 (env 로 덮어쓰기 가능) ──────────────────────────
const HOST = import.meta.env.VITE_SP_HOSTNAME || 'startruckkorea.sharepoint.com';
const SITE_PATH = import.meta.env.VITE_SP_SITE_PATH || '/sites/STK-PMM';
const ACCESS_FOLDER = (
  import.meta.env.VITE_SP_ACCESS_PATH || 'mbtruck-spec/Access'
).replace(/^\/+|\/+$/g, '');

// G/H 컬럼 (0-base)
const EMAIL_COL = 6; // G
const ROLE_COL = 7; // H

const VALID_ROLES = new Set(['admin', 'staff-a', 'staff-b', 'sales']);

/**
 * H 컬럼 값 → 역할 키(admin/staff-a/staff-b/sales). 영문/한글 표기를 허용한다.
 *   - 본사직원A (강화): Staff-A / StaffA / 본사직원A / 본사A ...
 *   - 본사직원B (기존 staff 동급): Staff-B / StaffB / 본사직원B / 본사B ...
 *   - A/B 구분 없는 'Staff' / '본사' 단독 표기는 기존 동작(=B)으로 본다.
 * 빈칸이거나 인식할 수 없는 값이면 null 을 반환한다 — "권한 미부여"로 취급하여
 * 임의로 sales 를 부여하지 않는다(빈칸을 영업직원으로 오인하지 않도록).
 */
export function normalizeRole(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v) return null;
  if (VALID_ROLES.has(v)) return v;
  if (/(admin|관리자)/.test(v)) return 'admin';
  if (/(staff|본사)/.test(v)) {
    // 'a' 접미가 있으면 강화(A), 'b' 또는 구분 없는 단독 'staff/본사'는 기존(B)
    if (/a/.test(v.replace(/staff|본사직원|본사/g, ''))) return 'staff-a';
    return 'staff-b';
  }
  if (/(sales|영업)/.test(v)) return 'sales';
  return null;
}

// ─── 파일(워크북) 위치 해석 — 1회 캐시 ───────────────────────────────
let _filePromise = null;

function resolveAccessFile() {
  if (!_filePromise) {
    _filePromise = (async () => {
      const site = await graphGet(`/sites/${HOST}:${SITE_PATH}`);
      const listing = await graphGet(
        `/sites/${site.id}/drive/root:/${encodeURI(
          ACCESS_FOLDER
        )}:/children?$select=name,id,file&$top=200`
      );
      const xlsx = (listing.value || []).filter(
        (it) => it.file && /\.xlsx$/i.test(it.name || '')
      );
      if (xlsx.length === 0) {
        throw new Error(
          `SharePoint '${ACCESS_FOLDER}' 폴더에서 접근권한 .xlsx 파일을 찾지 못했습니다.`
        );
      }
      // Access_List* 우선, 최신(이름 내림차순) 선택
      const named = xlsx
        .filter((f) => /^access_list/i.test(f.name || ''))
        .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
      const item = named[0] || xlsx[0];
      return { siteId: site.id, itemId: item.id };
    })().catch((err) => {
      _filePromise = null; // 실패 시 다음 호출에서 재시도 가능
      throw err;
    });
  }
  return _filePromise;
}

/**
 * 접근권한 목록을 [{ email, role }] 로 반환한다.
 * email 은 소문자로 정규화, role 은 admin/staff/sales 중 하나.
 */
export async function readAccessList() {
  const { siteId, itemId } = await resolveAccessFile();
  const wb = `/sites/${siteId}/drive/items/${itemId}/workbook`;
  // 시트명을 모르므로 첫 워크시트를 사용한다.
  const sheets = await graphGet(`${wb}/worksheets?$select=name,position`);
  const list = (sheets?.value || [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  if (list.length === 0) {
    throw new Error('접근권한 파일에 워크시트가 없습니다.');
  }
  const sheetName = list[0].name;
  const r = await graphGet(
    `${wb}/worksheets('${sheetName}')/usedRange(valuesOnly=true)?$select=values`
  );
  const values = r?.values || [];
  const out = [];
  for (const row of values) {
    const email = String(row?.[EMAIL_COL] ?? '').trim().toLowerCase();
    if (!email.includes('@')) continue; // 헤더/빈 행 제외
    out.push({ email, role: normalizeRole(row?.[ROLE_COL]) });
  }
  return out;
}
