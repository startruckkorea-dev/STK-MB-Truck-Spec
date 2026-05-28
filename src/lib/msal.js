import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';

// ─── Azure AD (Entra ID) 앱 등록 정보 ───────────────────────────────
// 공개 SPA 클라이언트 ID/테넌트 ID는 비밀값이 아니므로 env 미설정 시 기본값 사용.
// Vercel/로컬에서 VITE_MSAL_CLIENT_ID / VITE_MSAL_TENANT_ID 로 덮어쓸 수 있음.
const CLIENT_ID =
  import.meta.env.VITE_MSAL_CLIENT_ID || '9b247088-5afb-4622-9c5e-b5f27142761d';
const TENANT_ID =
  import.meta.env.VITE_MSAL_TENANT_ID || '19cab1f5-21f4-44df-8ac6-96d6ca595203';

export const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    // SPA 리다이렉트 URI = 현재 출처 (로컬: http://localhost:3000,
    // 운영: https://mbtruck-spec.startruckkorea.com)
    // → Azure 앱 등록 > 인증 > SPA 플랫폼에 두 URI 모두 등록 필요.
    redirectUri: typeof window !== 'undefined' ? window.location.origin : '/',
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};

// Graph API 위임 권한 (이미 관리자 동의 완료)
//  - User.Read           : 로그인 사용자 프로필
//  - Sites.ReadWrite.All  : SharePoint 사이트/리스트
//  - Files.ReadWrite.All  : SharePoint/OneDrive 파일 (사양 docx·xlsx 저장소)
//  - Mail.Send            : 견적/알림 메일 발송
export const loginRequest = {
  scopes: ['User.Read', 'Sites.ReadWrite.All', 'Files.ReadWrite.All', 'Mail.Send'],
};

export const msalInstance = new PublicClientApplication(msalConfig);

let initialized = false;

// 이전 로그인이 중도 종료(팝업 닫힘·새로고침·탭 경합 등)되면 localStorage 에
// `msal.interaction.status` 같은 상태가 남는다. 그 상태에서 새 로그인을 시도하면
// hash_empty_error / interaction_in_progress / no_token_request_cache_error 등이
// 발생한다. 이런 stale 오류는 모두 캐시 정리 후 재시도하면 정상 복구된다.
const STALE_AUTH_ERRORS = new Set([
  'hash_empty_error',
  'interaction_in_progress',
  'no_token_request_cache_error',
  'no_cached_authority_error',
]);

function isStaleAuthError(err) {
  return !!err && STALE_AUTH_ERRORS.has(err.errorCode);
}

/** MSAL 인스턴스 초기화 (v3는 사용 전 initialize() 필수) */
export async function initMsal() {
  if (initialized) return;
  await msalInstance.initialize();
  // 리다이렉트 콜백 처리. 팝업 전용 흐름에서는 보통 no-op 이지만, stale 상태로
  // hash_empty_error 등이 던져질 수 있어 무시한다 — 인스턴스 자체는 정상 사용 가능.
  try {
    await msalInstance.handleRedirectPromise();
  } catch (err) {
    if (!isStaleAuthError(err)) {
      console.warn('[msal] handleRedirectPromise:', err?.errorCode || err?.message);
    }
  }
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
    msalInstance.setActiveAccount(accounts[0]);
  }
  initialized = true;
}

/** Microsoft 365 계정으로 로그인 (팝업). 성공 시 account 반환 */
export async function signInWithMicrosoft() {
  await initMsal();
  try {
    const result = await msalInstance.loginPopup(loginRequest);
    msalInstance.setActiveAccount(result.account);
    return result.account;
  } catch (err) {
    // stale 인증 상태가 남아 있을 때만 캐시 정리 후 1회 재시도
    if (!isStaleAuthError(err)) throw err;
    console.warn('[msal] stale 인증 상태 감지 → 캐시 정리 후 재시도:', err.errorCode);
    try {
      await msalInstance.clearCache();
    } catch {
      /* clearCache 실패는 무시 */
    }
    const result = await msalInstance.loginPopup(loginRequest);
    msalInstance.setActiveAccount(result.account);
    return result.account;
  }
}

/** Microsoft 365 로그아웃 */
export async function signOutMicrosoft() {
  await initMsal();
  const account = msalInstance.getActiveAccount();
  await msalInstance.logoutPopup({ account });
}

/** 현재 로그인된 Microsoft 계정 (없으면 null) */
export function getMicrosoftAccount() {
  return msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0] || null;
}

/**
 * Graph API 호출용 액세스 토큰 획득.
 * 무음(silent) 시도 → 실패 시 팝업으로 재인증.
 * 추후 SharePoint(Graph) 연동 시 이 함수로 토큰을 받아 사용.
 */
export async function getGraphToken(scopes = loginRequest.scopes) {
  await initMsal();
  const account = getMicrosoftAccount();
  if (!account) throw new Error('Microsoft 계정 로그인이 필요합니다.');
  try {
    const res = await msalInstance.acquireTokenSilent({ account, scopes });
    return res.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const res = await msalInstance.acquireTokenPopup({ account, scopes });
      return res.accessToken;
    }
    throw err;
  }
}
