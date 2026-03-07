import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('.env.local에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해주세요.');
}

const debugFetch = (...args) => {
  console.log('[Supabase fetch 호출]', args[0]);
  return fetch(...args);
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: debugFetch },
  auth: {
    flowType: 'implicit',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
