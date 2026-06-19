import { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { EventType } from '@azure/msal-browser';
import {
  msalInstance,
  initMsal,
  getMicrosoftAccount,
  signOutMicrosoft,
} from '../lib/msal';
import { readAccessList } from '../lib/accessList';

const AuthContext = createContext(null);

/**
 * 인증 = Microsoft 365(MSAL) 전용.
 * 역할(admin/staff/sales)은 SharePoint `Access/Access_List_*.xlsx` 의
 * G 컬럼(이메일)·H 컬럼(권한)으로 결정한다.
 * 부트스트랩: 목록에 admin 이 한 명도 없으면 로그인한 사용자를 모두 admin 으로 취급.
 */
export function AuthProvider({ children }) {
  const [msAccount, setMsAccount] = useState(null);
  const [msalReady, setMsalReady] = useState(false);
  const [role, setRole] = useState(null); // null = 아직 미확정 또는 권한 없음
  // 접근권한 목록 조회 결과 상태
  //   null         = 아직 확정 안 됨(로딩)
  //   'ok'         = 목록에 등록된 사용자 → role 부여
  //   'bootstrap'  = 목록이 비어 admin 부재 → 임시 admin (경고 표시)
  //   'unregistered' = 목록엔 있으나 본인 미등록 → 콘텐츠 차단
  //   'error'      = 목록 파일을 못 읽음 → 콘텐츠 차단
  const [accessStatus, setAccessStatus] = useState(null);
  const [recheckTick, setRecheckTick] = useState(0);

  // ─── MSAL 초기화 + 이벤트 구독 ─────────────────────────────────
  useEffect(() => {
    let unsubscribe;
    (async () => {
      await initMsal();
      setMsAccount(getMicrosoftAccount());
      setMsalReady(true);
      const callbackId = msalInstance.addEventCallback((event) => {
        switch (event.eventType) {
          // ⚠️ ACQUIRE_TOKEN_SUCCESS 는 처리하지 않는다 — 토큰 획득마다 계정 state 가
          //    갱신되면 효과 재실행 → 재요청 → 무한 루프가 된다.
          case EventType.LOGIN_SUCCESS:
          case EventType.ACCOUNT_ADDED: {
            const acc = event.payload?.account;
            if (acc) {
              msalInstance.setActiveAccount(acc);
              // 같은 계정이면 참조를 유지해 불필요한 재렌더/효과 재실행 방지
              setMsAccount((prev) =>
                prev && prev.homeAccountId === acc.homeAccountId ? prev : acc
              );
            }
            break;
          }
          case EventType.LOGOUT_SUCCESS:
          case EventType.ACCOUNT_REMOVED:
            setMsAccount(null);
            setRole(null);
            setAccessStatus(null);
            break;
          default:
            break;
        }
      });
      unsubscribe = () => callbackId && msalInstance.removeEventCallback(callbackId);
    })();
    return () => unsubscribe && unsubscribe();
  }, []);

  // ─── 역할 결정: Access List(.xlsx) 조회 ─────────────────────────
  useEffect(() => {
    if (!msAccount) { setRole(null); setAccessStatus(null); return; }
    let cancelled = false;
    setRole(null);
    setAccessStatus(null); // 재조회 시 로딩 상태로
    (async () => {
      const email = String(msAccount.username || '').trim().toLowerCase();
      try {
        const access = await readAccessList();
        if (cancelled) return;
        const match = access.find((a) => a.email === email);
        const hasAdmin = access.some((a) => a.role === 'admin');
        if (match && match.role) {
          setRole(match.role); // admin/staff/sales (빈칸/미인식은 role=null 이라 제외)
          setAccessStatus('ok');
        } else if (!hasAdmin) {
          setRole('admin'); // 부트스트랩(목록에 admin 부재) — 락아웃 방지
          setAccessStatus('bootstrap');
        } else {
          setRole(null); // 미등록 사용자 → 권한 없음(콘텐츠 차단)
          setAccessStatus('unregistered');
        }
      } catch {
        // 목록 파일을 못 읽음 → 권한 없음(콘텐츠 차단)
        if (!cancelled) { setRole(null); setAccessStatus('error'); }
      }
    })();
    return () => { cancelled = true; };
  }, [msAccount, recheckTick]);

  // 접근권한 목록을 다시 조회 (읽기 실패 후 재시도 버튼용)
  const recheckAccess = () => setRecheckTick((n) => n + 1);

  async function signOut() {
    try {
      await signOutMicrosoft();
    } catch {
      /* 팝업 차단 등 무시 */
    }
  }

  // 로그인 안 했으면 MSAL 준비 후 바로, 로그인 했으면 권한 상태 확정까지 대기
  const loading = !msalReady || (!!msAccount && accessStatus === null);

  const { user, profile } = useMemo(() => {
    if (!msAccount) return { user: null, profile: null };
    const u = {
      id: msAccount.localAccountId || msAccount.homeAccountId,
      email: msAccount.username,
      name: msAccount.name || msAccount.username,
      provider: 'microsoft',
    };
    return { user: u, profile: { ...u, role } };
  }, [msAccount, role]);

  const isAdmin = profile?.role === 'admin';
  const isStaff = profile?.role === 'staff';
  const isSales = profile?.role === 'sales';
  const canViewCodes = isAdmin || isStaff;
  // 콘텐츠를 막아야 하는 상태 (읽기 실패 / 미등록 사용자)
  const accessDenied = accessStatus === 'error' || accessStatus === 'unregistered';
  const isBootstrap = accessStatus === 'bootstrap';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signOut,
        isAdmin,
        isStaff,
        isSales,
        canViewCodes,
        accessStatus,
        accessDenied,
        isBootstrap,
        recheckAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
