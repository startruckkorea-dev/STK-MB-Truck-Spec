import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'spec-lang';

const SpecLangContext = createContext(null);

export function SpecLangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    if (typeof window === 'undefined') return 'ko';
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'en' ? 'en' : 'ko';
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  return (
    <SpecLangContext.Provider value={[lang, setLang]}>
      {children}
    </SpecLangContext.Provider>
  );
}

export function useSpecLang() {
  const ctx = useContext(SpecLangContext);
  if (!ctx) throw new Error('useSpecLang must be used within SpecLangProvider');
  return ctx;
}
