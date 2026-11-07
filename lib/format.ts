import type { Lang } from './types';

const loc = (lang: Lang) => (lang === 'es' ? 'es-US' : 'en-US');
// Intl formatters are costly to build and these run on every slider frame: one per language and style.
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();
function fmt<T extends Intl.NumberFormat | Intl.DateTimeFormat>(key: string, make: () => T): T {
  let f = cache.get(key) as T | undefined;
  if (!f) cache.set(key, (f = make()));
  return f;
}
export const money = (n: number, lang: Lang = 'en') =>
  fmt(`m${lang}`, () => new Intl.NumberFormat(loc(lang), { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })).format(Math.round(n || 0));
export const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;

/** "2027-08" → "August 2027" / "agosto de 2027" */
export function monthName(iso: string, lang: Lang = 'en', short = false): string {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return fmt(`d${lang}${short ? 's' : 'l'}`, () => new Intl.DateTimeFormat(loc(lang), { month: short ? 'short' : 'long', year: 'numeric', timeZone: 'UTC' })).format(d);
}
