'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import type { Lang } from './types';

export const dictionaries = { en, es } as const;
export type Messages = typeof en;

export function translate(lang: Lang, key: string, vars?: Record<string, string | number>): string {
  const walk = (dict: unknown) =>
    key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), dict);
  let s = walk(dictionaries[lang]);
  if (typeof s !== 'string') s = walk(dictionaries.en);
  if (typeof s !== 'string') return key;
  let out = s;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (key: string, vars?: Record<string, string | number>) => string };
const LangContext = createContext<Ctx | null>(null);

export function LanguageProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.cookie = `hs_lang=${l}; path=/; max-age=31536000; samesite=lax`;
    try {
      localStorage.setItem('hs.lang', l);
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): Ctx {
  const c = useContext(LangContext);
  if (!c) throw new Error('useLang outside LanguageProvider');
  return c;
}
