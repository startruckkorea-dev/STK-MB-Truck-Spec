import { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { EventType } from '@azure/msal-browser';
import { supabase } from '../lib/supabase';
import {
  msalInstance,
  initMsal,
  getMicrosoftAccount,
  signOutMicrosoft,
} from '../lib/msal';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [supaUser, setSupaUser] = useState(null);
  const [supaProfile, setSupaProfile] = useState(null);
  const [msAccount, setMsAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── MSAL: 초기화 + 이벤트 구독 ─────────────────────────────────
  useEffect(() => {
    let unsubscribe;
    (async () => {
      await initMsal();
      setMsAccount(getMicrosoftAccount());
      const callbackId = msalInstance.addEventCallback((event) => {
        switch (event.eventType) {
          case EventType.LOGIN_SUCCESS:
          case EventType.ACQUIRE_TOKEN_SUCCESS:
          case EventType.ACCOUNT_ADDED:
            if (event.payload?.account) {
              msalInstance.setActiveAccount(event.payload.account);
              setMsAccount(event.payload.account);
            }
            break;
          case EventType.LOGOUT_SUCCESS:
          case EventType.ACCOUNT_REMOVED:
            setMsAccount(null);
            break;
          default:
            break;
        }
      });
      unsubscribe = () => callbackId && msalInstance.removeEventCallback(callbackId);
    })();
    return () => unsubscribe && unsubscribe();
  }, []);

  // ─── Supabase: 기존 세션 폴백 (다음 세션에 SharePoint로 대체 예정) ─
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 5000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        clearTimeout(timer);
        setSupaUser(session?.user ?? null);
        if (session?.user) fetchProfile(session.user.id);
        else setLoading(false);
      })
      .catch(() => {
        clearTimeout(timer);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSupaUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setSupaProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error) setSupaProfile(data);
    setLoading(false);
  }

  async function signOut() {
    if (msAccount) {
      try { await signOutMicrosoft(); } catch (_) { /* 팝업 차단 등 무시 */ }
    }
    if (supaUser) {
      await supabase.auth.signOut();
    }
  }

  // ─── 통합 user / profile (MS 우선) ─────────────────────────────
  const { user, profile } = useMemo(() => {
    if (msAccount) {
      const unified = {
        id: msAccount.localAccountId || msAccount.homeAccountId,
        email: msAccount.username,
        name: msAccount.name || msAccount.username,
        provider: 'microsoft',
      };
      // 임시: MS-인증 사용자는 모두 admin. 역할 세분화는 SharePoint 연동 단계에서 재설계.
      return {
        user: unified,
        profile: { ...unified, role: 'admin' },
      };
    }
    return { user: supaUser, profile: supaProfile };
  }, [msAccount, supaUser, supaProfile]);

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
