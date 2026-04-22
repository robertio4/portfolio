import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import es from './es.json';
import en from './en.json';

export type Lang = 'es' | 'en';
type Dict = typeof es;

const dicts: Record<Lang, Dict> = { es, en };

interface I18nContextValue {
  lang: Lang;
  t: (key: keyof Dict) => string;
  toggle: () => void;
  setLang: (l: Lang) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'portfolio.lang';

function detectInitialLang(): Lang {
  if (typeof window === 'undefined') return 'es';
  const stored = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (stored === 'es' || stored === 'en') return stored;
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggle = useCallback(() => setLangState((l) => (l === 'es' ? 'en' : 'es')), []);
  const t = useCallback((key: keyof Dict) => dicts[lang][key] ?? String(key), [lang]);

  const value = useMemo(() => ({ lang, t, toggle, setLang }), [lang, t, toggle, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
