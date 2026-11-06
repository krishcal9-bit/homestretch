// Engine reasoning as plain sentences ("Why this date"). Deterministic; no LLM.
import { translate } from './i18n-core';
import { money, pct } from './format';
import { sanitize, simulateDebts } from './engine';
import type { Lang, Profile, ReadinessResult } from './types';

export function whyThisDate(input: Profile, r: ReadinessResult, lang: Lang): string[] {
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, `why.${k}`, v);
  const p = sanitize(input);
  const out: string[] = [];
  const m = (k: string) => r.milestones.find((x) => x.key === k)?.month ?? 0;

  if (r.costBurden > 0.3) out.push(t('needRent', { pct: pct(r.costBurden) }));
  else if (r.overcrowded) out.push(t('needCrowded', { occupants: p.occupants, bedrooms: p.bedrooms }));
  else if (p.unsafeConditions) out.push(t('needUnsafe'));
  else out.push(t('noNeed', { pct: pct(r.costBurden) }));

  const collection = p.debts.filter((d) => d.kind === 'collection').reduce((s, d) => s + d.balance, 0);
  if (collection > 0) {
    // Money left for collections each month = budget beyond other debts' minimums.
    const rate = p.levers.extraDebt;
    const sim = simulateDebts(p.debts, p.levers.extraDebt);
    if (sim.collectionsMonth > 0 && sim.collectionsMonth < 120 && rate > 0)
      out.push(t('collectionsFirst', { amount: money(collection, lang), rate: money(rate, lang), n: sim.collectionsMonth }));
    else if (sim.collectionsMonth >= 120 || sim.collectionsMonth < 0) out.push(t('collectionsStuck', { amount: money(collection, lang) }));
    else out.push(t('collectionsLater', { amount: money(collection, lang), n: sim.collectionsMonth }));
  }

  const credit = m('credit');
  if (p.creditBand === 'good' && credit === 0) out.push(t('creditGood'));
  else if (p.creditBand === 'needs_work') out.push(t('creditNeedsWork', { n: credit }));
  else if (p.creditBand === 'unknown') out.push(t('creditUnknown'));
  else if (p.creditBand === 'building') out.push(t('creditBuilding', { n: credit }));

  const savings = m('savings');
  if (savings === 0) out.push(t('savingsHave', { amount: money(r.downPaymentTarget, lang) }));
  else if (p.levers.monthlySavings <= 0 && r.freedPayments <= 0) out.push(t('savingsStuck', { amount: money(r.downPaymentTarget, lang) }));
  else {
    out.push(t('savingsPlan', { amount: money(r.downPaymentTarget, lang), rate: money(p.levers.monthlySavings, lang), n: savings }));
    if (r.freedPayments > 0 && r.debtClearMonth < savings) out.push(t('savingsFreed', { amount: money(r.freedPayments, lang) }));
  }

  if (r.monthsToReady === 0) out.push(t('bottomReady'));
  else if (savings >= credit) out.push(t('bottomSavings'));
  else out.push(t('bottomCredit'));
  return out.slice(0, 6);
}
