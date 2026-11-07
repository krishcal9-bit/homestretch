// KEEP · Monthly check-in: how each tap answer changes the profile, and the one-sentence forecast change.
// Pure and deterministic; the conversation UI lives in components/keep/CheckinChat.tsx.
import type { KeepProfile, SystemKind } from './keep';
import { SYSTEM_DEFAULTS } from './keep';
import { forecast, maintenanceSetAside } from './forecast';
import { makeSystem, upsertSystem } from './homeHealth';
import { money, monthName } from './format';
import { translate } from './i18n-core';
import type { Lang } from './types';

export type BillKind = 'escrow' | 'premium' | 'hoa' | 'tax';
export type CheckinAnswer =
  | { q: 'bills'; kind: BillKind; amount: number }
  | { q: 'income'; takeHome: number }
  | { q: 'breaking'; kind: SystemKind };

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clampMoney = (v: number) => Math.min(10_000_000, Math.max(0, Math.round(num(v))));

/** The profile after one answer. */
export function applyAnswer(p: KeepProfile, a: CheckinAnswer): Partial<KeepProfile> {
  switch (a.q) {
    case 'bills':
      if (a.kind === 'escrow') return { escrow: clampMoney(a.amount) };
      if (a.kind === 'premium') {
        // a new premium: escrow is re-analysed to carry it (taxes + the new premium, over 12 months)
        const premium = clampMoney(a.amount);
        return { premium, escrow: Math.max(num(p.escrow), Math.round((num(p.propertyTax) + premium) / 12)) };
      }
      if (a.kind === 'hoa') return { hoa: clampMoney(a.amount) };
      return { supplementalTax: clampMoney(a.amount) };
    case 'income':
      return { takeHome: clampMoney(a.takeHome), income: Math.round((clampMoney(a.takeHome) * 12) / 0.8 / 100) * 100 };
    case 'breaking': {
      // flag it: due within the year (keeps what the family already told us about it)
      const cur = (p.systems ?? []).find((s) => s.kind === a.kind && a.kind !== 'other');
      const d = SYSTEM_DEFAULTS[a.kind];
      const base = cur ?? makeSystem(a.kind, d.lifeYears - 1, { source: 'typed', confidence: 'medium' });
      const flagged = { ...base, ageYears: Math.max(num(base.ageYears), num(base.lifeYears, d.lifeYears) - 1) };
      return { systems: upsertSystem(p.systems ?? [], flagged) };
    }
  }
}

export type ForecastSnapshot = { peak: number; peakMonth: string; now: number; tightest: number; repair: number; nextShock: { month: string; delta: number } | null };

export function snapshot(p: KeepProfile, start?: string): ForecastSnapshot {
  const f = forecast(p, start ? { start } : {});
  const peakM = f.months.reduce((m, x) => (x.total > m.total ? x : m), f.months[0]);
  return {
    peak: Math.round(peakM?.total ?? 0),
    peakMonth: peakM?.month ?? '',
    now: Math.round(f.months[0]?.total ?? 0),
    tightest: Math.round(Number.isFinite(f.minBreathing) ? f.minBreathing : 0),
    repair: maintenanceSetAside(p),
    nextShock: f.first ? { month: f.first.month, delta: f.first.delta } : null,
  };
}

/** One sentence: how this answer moved the forecast. */
export function changeSentence(q: CheckinAnswer['q'], before: ForecastSnapshot, after: ForecastSnapshot, lang: Lang): string {
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, `keepCheckin.change.${k}`, v);
  const $ = (n: number) => money(n, lang);
  if (q === 'breaking') {
    const d = after.repair - before.repair;
    return d > 0 ? t('repairUp', { amount: $(after.repair), delta: $(d) }) : t('repairSame', { amount: $(after.repair) });
  }
  if (q === 'income') {
    const d = after.tightest - before.tightest;
    if (Math.abs(d) < 1) return t('same');
    return after.tightest < 0 ? t('incomeShort', { amount: $(-after.tightest) }) : t(d > 0 ? 'incomeUp' : 'incomeDown', { amount: $(after.tightest) });
  }
  const d = after.peak - before.peak;
  if (Math.abs(d) < 1) return t('same');
  return t(d > 0 ? 'billUp' : 'billDown', { amount: $(after.peak), month: after.peakMonth ? monthName(after.peakMonth, lang) : '', delta: $(Math.abs(d)) });
}
