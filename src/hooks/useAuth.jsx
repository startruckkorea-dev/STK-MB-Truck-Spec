import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 안전망: 5초 내 응답 없으면 로딩 해제
    const timer = setTimeout(() => setLoading(false), 5000);

    // 초기 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timer);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    }).catch(() => {
      clearTimeout(timer);
      setLoading(false);
    });

    // 인증 상태 변화 감지
    // 주의: onAuthStateChange 콜백 안에서 직접 await로 Supabase API를 호출하면
    // 내부 lock deadlock이 발생함 → setTimeout으로 defer 처리
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
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

    if (!error) setProfile(data);
    setLoading(false);
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp(email, password, name) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    // profiles 테이블에 기본 role 'sales'로 등록
    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: data.user.id, name, role: 'sales' });
      if (profileError) throw profileError;
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const isAdmin = profile?.role === 'admin';
  const isStaff = profile?.role === 'staff';
  const isSales = profile?.role === 'sales';
  // admin + staff 는 영문 코드를 볼 수 있음; sales 는 국문명만 표시
  const canViewCodes = isAdmin || isStaff;

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, isAdmin, isStaff, isSales, canViewCodes }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
