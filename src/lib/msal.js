import { PublicClientApplication, InteractionRequiredAuthError } from '@azure/msal-browser';

// ─── Azure AD (Entra ID) 앱 등록 정보 ───────────────────────────────
// 공개 SPA 클라이언트 ID/테넌트 ID는 비밀값이 아니므로 env 미설정 시 기본값 사용.
// Vercel/로컬에서 VITE_MSAL_CLIENT_ID / VITE_MSAL_TENANT_ID 로 덮어쓸 수 있음.
//
// 앱 등록이 두 개다 (테넌트는 동일):
//   internal — 정직원용 (STK 사내 계정)
//   agent    — 세일즈 에이전트용 (STK-Sales-Freelancer)
//              Access 리스트의 company 컬럼이 `agent` 인 인원.
//              1인당 gmail / startruck.kr 두 개의 계정으로 로그인 가능하다.
const TENANT_ID =
  import.meta.env.VITE_MSAL_TENANT_ID || '19cab1f5-21f4-44df-8ac6-96d6ca595203';

const INTERNAL_CLIENT_ID =
  import.meta.env.VITE_MSAL_CLIENT_ID || '9b247088-5afb-4622-9c5e-b5f27142761d';
const AGENT_CLIENT_ID =
  import.meta.env.VITE_MSAL_AGENT_CLIENT_ID || '0346d368-7dc6-41a6-a310-7afa10fa5bd7';

/** 로그인 경로(앱 등록) 정의 */
export const AUTH_APPS = {
  internal: { key: 'internal', clientId: INTERNAL_CLIENT_ID, label: '정직원' },
  agent: { key: 'agent', clientId: AGENT_CLIENT_ID, label: '세일즈 에이전트' },
};

export const AUTH_APP_KEYS = Object.keys(AUTH_APPS);
const DEFAULT_APP = 'internal';
const APP_STORAGE_KEY = 'mbspec.authApp';

function readStoredApp() {
  try {
    const v = window.localStorage.getItem(APP_STORAGE_KEY);
    return AUTH_APPS[v] ? v : DEFAULT_APP;
  } catch {
    return DEFAULT_APP;
  }
}

function storeApp(key) {
  try {
    window.localStorage.setItem(APP_STORAGE_KEY, key);
  } catch {
    /* 프라이빗 모드 등 — 세션 내에서만 유지 */
  }
}

function buildConfig(clientId) {
  return {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${TENANT_ID}`,
      // SPA 리다이렉트 URI = 현재 출처 (로컬: http://localhost:3000,
      // 운영: https://mbtruck-spec.startruckkorea.com)
      // → 두 앱 등록 모두 인증 > SPA 플랫폼에 이 URI 들을 등록해야 한다.
      redirectUri: typeof window !== 'undefined' ? window.location.origin : '/',
    },
    cache: {
      cacheLocation: 'localStorage',
      storeAuthStateInCookie: false,
    },
  };
}

// clientId 가 다르면 MSAL 캐시 키도 분리되므로 두 인스턴스는 서로 간섭하지 않는다.
const instances = {};
for (const key of AUTH_APP_KEYS) {
  instances[key] = new PublicClientApplication(buildConfig(AUTH_APPS[key].clientId));
}

/** 하위 호환 — 기본(정직원) 인스턴스 */
export const msalInstance = instances.internal;

// Graph API 위임 권한 (두 앱 등록 모두 관리자 동의 완료)
//  - User.Read           : 로그인 사용자 프로필
//  - Sites.ReadWrite.All  : SharePoint 사이트/리스트
//  - Files.ReadWrite.All  : SharePoint/OneDrive 파일 (사양 docx·xlsx 저장소)
//  - Mail.Send            : 견적/알림 메일 발송
export const loginRequest = {
  scopes: ['User.Read', 'Sites.ReadWrite.All', 'Files.ReadWrite.All', 'Mail.Send'],
};

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

/**
 * 현재 활성 로그인 경로.
 * 저장된 경로에 로그인 계정이 있으면 그것을, 없으면 계정이 있는 다른 경로를 쓴다.
 */
export function getActiveAuthApp() {
  const stored = readStoredApp();
  if (instances[stored]?.getAllAccounts?.().length) return stored;
  const withAccount = AUTH_APP_KEYS.find((k) => instances[k].getAllAccounts().length > 0);
  return withAccount || stored;
}

/** 활성 경로의 MSAL 인스턴스 */
export function getMsalInstance() {
  return instances[getActiveAuthApp()];
}

/** 두 인스턴스 모두에 이벤트 콜백을 등록한다. 반환값 호출 시 해제. */
export function addAuthEventCallback(cb) {
  const ids = AUTH_APP_KEYS.map((k) => ({ key: k, id: instances[k].addEventCallback(cb) }));
  return () => {
    for (const { key, id } of ids) {
      if (id) instances[key].removeEventCallback(id);
    }
  };
}

/** MSAL 인스턴스 초기화 (v3는 사용 전 initialize() 필수) */
export async function initMsal() {
  if (initialized) return;
  await Promise.all(AUTH_APP_KEYS.map((k) => instances[k].initialize()));
  // 리다이렉트 콜백 처리. 팝업 전용 흐름에서는 보통 no-op 이지만, stale 상태로
  // hash_empty_error 등이 던져질 수 있어 무시한다 — 인스턴스 자체는 정상 사용 가능.
  for (const key of AUTH_APP_KEYS) {
    try {
      await instances[key].handleRedirectPromise();
    } catch (err) {
      if (!isStaleAuthError(err)) {
        console.warn('[msal] handleRedirectPromise:', err?.errorCode || err?.message);
      }
    }
    const accounts = instances[key].getAllAccounts();
    if (accounts.length > 0) instances[key].setActiveAccount(accounts[0]);
  }
  initialized = true;
}

/**
 * Microsoft 365 계정으로 로그인 (팝업). 성공 시 account 반환.
 * @param {'internal'|'agent'} appKey 로그인 경로(앱 등록). 기본값은 정직원.
 */
export async function signInWithMicrosoft(appKey = DEFAULT_APP) {
  const key = AUTH_APPS[appKey] ? appKey : DEFAULT_APP;
  await initMsal();
  const instance = instances[key];
  // 다른 경로로 로그인해 둔 계정이 남아 있으면 활성 경로 판정이 흔들리므로 정리한다.
  for (const other of AUTH_APP_KEYS) {
    if (other === key) continue;
    for (const acc of instances[other].getAllAccounts()) {
      try {
        await instances[other].clearCache({ account: acc });
      } catch {
        /* 정리 실패는 무시 */
      }
    }
  }
  storeApp(key);
  try {
    const result = await instance.loginPopup(loginRequest);
    instance.setActiveAccount(result.account);
    return result.account;
  } catch (err) {
    // stale 인증 상태가 남아 있을 때만 캐시 정리 후 1회 재시도
    if (!isStaleAuthError(err)) throw err;
    console.warn('[msal] stale 인증 상태 감지 → 캐시 정리 후 재시도:', err.errorCode);
    try {
      await instance.clearCache();
    } catch {
      /* clearCache 실패는 무시 */
    }
    const result = await instance.loginPopup(loginRequest);
    instance.setActiveAccount(result.account);
    return result.account;
  }
}

/** Microsoft 365 로그아웃 */
export async function signOutMicrosoft() {
  await initMsal();
  const instance = getMsalInstance();
  const account = instance.getActiveAccount();
  await instance.logoutPopup({ account });
}

/** 현재 로그인된 Microsoft 계정 (없으면 null) */
export function getMicrosoftAccount() {
  const instance = getMsalInstance();
  return instance.getActiveAccount() || instance.getAllAccounts()[0] || null;
}

/**
 * Graph API 호출용 액세스 토큰 획득.
 * 무음(silent) 시도 → 실패 시 팝업으로 재인증.
 */
export async function getGraphToken(scopes = loginRequest.scopes) {
  await initMsal();
  const instance = getMsalInstance();
  const account = getMicrosoftAccount();
  if (!account) throw new Error('Microsoft 계정 로그인이 필요합니다.');
  try {
    const res = await instance.acquireTokenSilent({ account, scopes });
    return res.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const res = await instance.acquireTokenPopup({ account, scopes });
      return res.accessToken;
    }
    throw err;
  }
}
