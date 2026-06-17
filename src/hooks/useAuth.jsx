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
  const [role, setRole] = useState(null); // null = 아직 미확정

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
    if (!msAccount) { setRole(null); return; }
    let cancelled = false;
    (async () => {
      const email = String(msAccount.username || '').trim().toLowerCase();
      try {
        const access = await readAccessList();
        if (cancelled) return;
        const match = access.find((a) => a.email === email);
        const hasAdmin = access.some((a) => a.role === 'admin');
        if (match) setRole(match.role); // 이미 admin/staff/sales 로 정규화됨
        else if (!hasAdmin) setRole('admin'); // 부트스트랩(목록에 admin 부재)
        else setRole('sales'); // 미등록 사용자는 최소 권한
      } catch {
        // 목록을 못 읽으면 최소 권한(sales)로
        if (!cancelled) setRole('sales');
      }
    })();
    return () => { cancelled = true; };
  }, [msAccount]);

  async function signOut() {
    try {
      await signOutMicrosoft();
    } catch {
      /* 팝업 차단 등 무시 */
    }
  }

  // 로그인 안 했으면 MSAL 준비 후 바로, 로그인 했으면 역할 확정까지 대기
  const loading = !msalReady || (!!msAccount && role === null);

  const { user, profile } = useMemo(() => {
    if (!msAccount) return { user: null, profile: null };
    const u = {
      id: msAccount.localAccountId || msAccount.homeAccountId,
      email: msAccount.username,
      name: msAccount.name || msAccount.username,
      provider: 'microsoft',
    };
    return { user: u, profile: { ...u, role: role || 'sales' } };
  }, [msAccount, role]);

  const isAdmin = profile?.role === 'admin';
  const isStaff = profile?.role === 'staff';
  const isSales = profile?.role === 'sales';
  const canViewCodes = isAdmin || isStaff;

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signOut, isAdmin, isStaff, isSales, canViewCodes }}
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
