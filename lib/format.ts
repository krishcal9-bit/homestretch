import type { Lang } from './types';

const loc = (lang: Lang) => (lang === 'es' ? 'es-US' : 'en-US');
export const money = (n: number, lang: Lang = 'en') =>
  new Intl.NumberFormat(loc(lang), { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.round(n || 0));
export const pct = (n: number) => `${Math.round((n || 0) * 100)}%`;

/** "2027-08" → "August 2027" / "agosto de 2027" */
export function monthName(iso: string, lang: Lang = 'en', short = false): string {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat(loc(lang), { month: short ? 'short' : 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}
