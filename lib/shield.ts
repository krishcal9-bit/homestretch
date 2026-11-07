// KEEP: the Shock Shield. Deterministic moves that soften an upcoming payment shock, with each move's effect taken
// from the forecast engine (lib/forecast.ts). Claude may reword and rank these (POST /api/shield), but every number
// it shows comes from here, and the rules below always produce a sensible set on their own.
import { forecast, type Forecast, type Shock } from './forecast';
import type { KeepProfile } from './keep';
import { translate } from './i18n-core';
import { money, monthName } from './format';
import type { Lang } from './types';

export type MoveKey = 'insurance' | 'claim' | 'setAside' | 'habitat';
export type Effort = 'low' | 'medium' | 'high';
export type Move = {
  key: MoveKey;
  title: string;
  detail: string;
  /** breathing room this move adds in the shock month, $/month (engine) */
  monthlyEffect: number;
  effort: Effort;
  resource?: { name: string; url: string };
  /** habitat: the pre-written message to homeowner services */
  message?: string;
};

/** Raising the deductible (e.g. $1,000 → $2,500) typically trims the premium about 10%. A planning assumption. */
export const DEDUCTIBLE_CUT = 0.1;
/** California Homeowners' Exemption: $7,000 off assessed value at about the 1.1% OC base rate. */
export const EXEMPTION_VALUE = 7000;
export const EXEMPTION_TAX = Math.round(EXEMPTION_VALUE * 0.011);
/** 2025 federal poverty guideline (48 states): CARE ≤ 200%, FERA ≤ 250% (households of 3+). */
const FPL = (size: number) => 15650 + 5500 * (Math.max(1, Math.min(8, Math.round(size || 1))) - 1);
/** Typical monthly savings on an Orange County energy bill (an estimate shown as "about"). */
export const CARE_SAVINGS = 45;
export const FERA_SAVINGS = 18;

/** Where to learn more (names in messages: keep.resource.*). */
export const RESOURCES = {
  wildfire: 'https://www.insurance.ca.gov/01-consumers/200-wrr/Safer-from-Wildfires.cfm',
  exemption: 'https://www.ocassessor.gov',
  care: 'https://www.cpuc.ca.gov/industries-and-topics/electrical-energy/electric-costs/care-fera-program',
} as const;
const resource = (lang: Lang, k: keyof typeof RESOURCES) => ({ name: translate(lang, `keep.resource.${k}`), url: RESOURCES[k] });

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function utilityProgram(p: Pick<KeepProfile, 'income' | 'householdSize' | 'careFera'>): 'care' | 'fera' | null {
  if (p.careFera) return null;
  const income = num(p.income);
  if (income <= 0) return null;
  if (income <= 2 * FPL(p.householdSize)) return 'care';
  if (p.householdSize >= 3 && income <= 2.5 * FPL(p.householdSize)) return 'fera';
  return null;
}

/** The profile with the done moves applied where they map to engine inputs. Never mutates. */
export function applyMoves(p: KeepProfile, done: readonly string[]): KeepProfile {
  let out = p;
  if (done.includes('insurance')) out = { ...out, premium: Math.round(num(out.premium) * (1 - DEDUCTIBLE_CUT)) };
  if (done.includes('claim')) {
    out = { ...out, careFera: true };
    if (!p.homeownersExemption) out = { ...out, homeownersExemption: true, propertyTax: Math.max(0, num(out.propertyTax) - EXEMPTION_TAX) };
  }
  return out;
}

/**
 * The monthly set-aside that gets the family through shock month `i` without feeling it. For a shock in the coming
 * year it is the engine's own recommendation (every rise in the next 12 months under $5); for a later one, the smallest
 * whole-dollar amount that keeps every rise through the 24 months under $5.
 */
export function setAsideFor(p: KeepProfile, i: number, start?: string): number {
  const base = forecast(p, { start, setAside: 0 });
  if (i <= 12) return base.recommendedSetAside;
  const maxJump = (x: number) => {
    const ms = forecast(p, { start, setAside: x }).months;
    let m = 0;
    for (let k = 1; k < ms.length; k++) m = Math.max(m, ms[k].effective - ms[k - 1].effective);
    return m;
  };
  if (maxJump(0) <= 5) return 0;
  let lo = 0;
  let hi = 4000;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (maxJump(mid) <= 5) hi = mid;
    else lo = mid + 1;
  }
  return hi;
}

export type ShieldFacts = {
  shock: Shock;
  setAside: number;
  effects: Record<MoveKey, number>;
  /** the estimated monthly savings from a utility program (not an engine input) */
  utility: 'care' | 'fera' | null;
  utilitySavings: number;
  newPremium: number;
  deductibleSaves: number;
};

/** Each move's engine effect for one shock: breathing room in the shock month, with the move vs. without. */
export function shieldFacts(p: KeepProfile, shockIndex: number, start?: string): ShieldFacts | null {
  const base = forecast(p, { start });
  const shock = base.shocks.find((s) => s.i === shockIndex) ?? base.first;
  if (!shock) return null;
  const at = (f: Forecast) => f.months[shock.i]?.breathing ?? 0;
  const gain = (q: KeepProfile, setAside?: number) => Math.max(0, Math.round(at(forecast(q, { start, setAside })) - at(base)));
  const setAside = setAsideFor(p, shock.i, start);
  const utility = utilityProgram(p);
  const utilitySavings = utility === 'care' ? CARE_SAVINGS : utility === 'fera' ? FERA_SAVINGS : 0;
  const exemption = p.homeownersExemption ? 0 : gain({ ...p, propertyTax: Math.max(0, num(p.propertyTax) - EXEMPTION_TAX) });
  const newPremium = Math.round(num(p.premium) * (1 + base.insuranceRate));
  return {
    shock,
    setAside,
    utility,
    utilitySavings,
    newPremium,
    deductibleSaves: Math.round(newPremium * DEDUCTIBLE_CUT),
    effects: {
      insurance: num(p.premium) > 0 ? gain(applyMoves(p, ['insurance'])) : 0,
      claim: exemption + utilitySavings,
      setAside: setAside > num(p.setAside) ? gain(p, setAside) : 0,
      habitat: 0,
    },
  };
}

const CAUSE_KEYS = ['insurance', 'tax', 'supplemental', 'hoa'] as const;

/** The pre-written note to Habitat homeowner services, in the family's language. */
export function habitatMessage(lang: Lang, p: KeepProfile, shock: Shock, family?: string): string {
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, `keep.shield.${k}`, v);
  return t('habitatMessage', {
    who: family ? t('habitatWhoFamily', { family }) : t('habitatWho'),
    cause: translate(lang, `keep.cause.${CAUSE_KEYS.includes(shock.cause) ? shock.cause : 'insurance'}`),
    month: monthName(shock.month, lang),
    amount: money(shock.delta, lang),
  });
}

/** The deterministic Shock Shield: up to four moves, ranked by the breathing room they add (Habitat last). */
export function shieldRules(p: KeepProfile, shockIndex: number, lang: Lang, o: { start?: string; family?: string } = {}): Move[] {
  const f = shieldFacts(p, shockIndex, o.start);
  if (!f) return [];
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, `keep.shield.${k}`, v);
  const m = (n: number) => money(n, lang);
  const month = monthName(f.shock.month, lang);
  const moves: Move[] = [];
  moves.push({
    key: 'setAside',
    title: t('setAside.title', { amount: m(f.setAside) }),
    detail: t('setAside.detail', { amount: m(f.setAside), month, rise: m(f.shock.delta) }),
    monthlyEffect: f.effects.setAside,
    effort: 'low',
  });
  if (num(p.premium) > 0) {
    moves.push({
      key: 'insurance',
      title: t(p.fairPlan ? 'insurance.titleFair' : 'insurance.title'),
      detail: t('insurance.detail', { saves: m(f.deductibleSaves), premium: m(f.newPremium) }),
      monthlyEffect: f.effects.insurance,
      effort: 'medium',
      resource: resource(lang, 'wildfire'),
    });
  }
  const claims: string[] = [];
  if (!p.homeownersExemption) claims.push(t('claim.exemption', { value: m(EXEMPTION_VALUE), saves: m(EXEMPTION_TAX) }));
  if (f.utility) claims.push(t(`claim.${f.utility}`, { saves: m(f.utilitySavings) }));
  if (claims.length) {
    moves.push({
      key: 'claim',
      title: t('claim.title'),
      detail: claims.join(' '),
      monthlyEffect: f.effects.claim,
      effort: 'low',
      resource: resource(lang, p.homeownersExemption ? 'care' : 'exemption'),
    });
  }
  moves.sort((a, b) => b.monthlyEffect - a.monthlyEffect);
  moves.push({
    key: 'habitat',
    title: t('habitat.title'),
    detail: t('habitat.detail', { month }),
    monthlyEffect: 0,
    effort: 'low',
    message: habitatMessage(lang, p, f.shock, o.family),
  });
  return moves.slice(0, 4);
}

/* ------------------------------------------------------------------ */
/* Plain-language explanations of a document (POST /api/explain)        */
/* ------------------------------------------------------------------ */
export type ExplainFacts = {
  documentType: 'insurance' | 'escrow' | 'tax' | 'hoa';
  /** annual premium before / after (insurance) */
  premiumOld?: number;
  premiumNew?: number;
  /** monthly escrow before / after (escrow analysis) */
  escrowOld?: number;
  escrowNew?: number;
  /** annual property tax (tax bill) */
  propertyTax?: number;
  /** monthly HOA dues before / after */
  hoaOld?: number;
  hoaNew?: number;
  /** the engine's rise in the monthly payment and the month it lands ('YYYY-MM') */
  monthlyChange?: number;
  month?: string;
};

/** Values the explanation may cite, formatted the way the template and Claude write them. */
export function explainVars(lang: Lang, f: ExplainFacts): Record<string, string> {
  const m = (n?: number) => money(Math.abs(num(n)), lang);
  const v: Record<string, string> = {};
  if (f.premiumOld !== undefined) v.premiumOld = m(f.premiumOld);
  if (f.premiumNew !== undefined) v.premiumNew = m(f.premiumNew);
  if (f.premiumOld !== undefined && f.premiumNew !== undefined) v.annualChange = m(f.premiumNew - f.premiumOld);
  if (f.escrowOld !== undefined) v.escrowOld = m(f.escrowOld);
  if (f.escrowNew !== undefined) v.escrowNew = m(f.escrowNew);
  if (f.propertyTax !== undefined) {
    v.propertyTax = m(f.propertyTax);
    v.taxMonthly = m(num(f.propertyTax) / 12);
  }
  if (f.hoaOld !== undefined) v.hoaOld = m(f.hoaOld);
  if (f.hoaNew !== undefined) v.hoaNew = m(f.hoaNew);
  if (f.monthlyChange !== undefined) v.monthlyChange = m(f.monthlyChange);
  if (f.month) {
    v.month = monthName(f.month, lang).replace(/\s*(de\s+)?\d{4}$/, '');
    v.monthYear = monthName(f.month, lang);
  }
  return v;
}

/** The template explanation (also the fallback when Claude is unavailable). */
export function explainTemplate(lang: Lang, f: ExplainFacts): string {
  const v = explainVars(lang, f);
  const t = (k: string) => translate(lang, `keep.explain.${k}`, v);
  switch (f.documentType) {
    case 'insurance':
      if (v.annualChange && f.premiumNew! > f.premiumOld! && v.month) return `${t('insuranceUp')} ${v.monthlyChange && num(f.monthlyChange) > 0 ? t('insuranceWhenMonthly') : t('insuranceWhen')}`;
      if (v.premiumNew) return t('insuranceSame');
      return t('generic');
    case 'escrow':
      if (v.escrowNew && v.escrowOld && f.escrowNew !== f.escrowOld) return t(num(f.escrowNew) > num(f.escrowOld) ? 'escrowUp' : 'escrowDown');
      return t('generic');
    case 'tax':
      return v.propertyTax ? t('tax') : t('generic');
    case 'hoa':
      if (v.hoaNew && v.hoaOld && f.hoaNew !== f.hoaOld) return t('hoaUp');
      return v.hoaNew ? t('hoa') : t('generic');
  }
}

/** Every number written in `text` must be one of the facts (or a year/day in them): Claude never invents numbers. */
export function numbersAreFacts(text: string, lang: Lang, f: ExplainFacts): boolean {
  const allowed = new Set<number>();
  for (const s of Object.values(explainVars(lang, f))) for (const n of s.match(/\d[\d.,]*/g) ?? []) allowed.add(Number(n.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.')));
  for (const n of [12, 1]) allowed.add(n);
  for (const raw of text.match(/\d[\d.,]*\d|\d/g) ?? []) {
    const n = Number(raw.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
    if (!allowed.has(n)) return false;
  }
  return true;
}

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
