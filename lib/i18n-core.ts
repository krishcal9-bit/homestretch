import en from '@/messages/en.json';
import es from '@/messages/es.json';
import type { Lang } from './types';

export const dictionaries = { en, es } as const;

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
