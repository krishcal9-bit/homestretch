// KEEP: the Payment Forecast engine. Deterministic, pure TypeScript, no LLM — Claude only explains these numbers.
//
// A family's total monthly housing cost for the next 24 months = mortgage + escrow (taxes + insurance) + HOA +
// a maintenance set-aside, and the "breathing room" left after a basic-living estimate.
//  • Insurance renews in the renewal month at a projected increase (15% standard, 29.1% on the FAIR Plan, editable).
//  • Escrow is re-analyzed at each renewal: new monthly escrow = (annual taxes + new premium) / 12, plus the shortage
//    the account ran (the premium jump, tax growth not yet collected, a supplemental bill) spread over 12 months.
//  • Property tax grows 2% each July (Prop 13 cap; the fiscal year starts July 1). A supplemental bill is optional.
//  • HOA grows 5% each January (or the entered rate).
// The Shock Shield's set-aside goes into a savings jar each month; the jar pays any rise above today's cost while it
// has money — so a bigger set-aside always means a smaller jump (monotonic), which the flatten slider shows.
import type { HomeSystem, KeepProfile } from './keep';
import { SYSTEM_DEFAULTS } from './keep';

export const FORECAST_MONTHS = 24;
export const INSURANCE_STANDARD = 0.15;
export const INSURANCE_FAIR = 0.291;
export const TAX_GROWTH = 0.02;
export const HOA_GROWTH = 0.05;
/** A month-over-month rise this large ($/month) is a shock worth a marker. */
export const SHOCK_MIN = 15;
const TAX_MONTH = 7;
const HOA_MONTH = 1;

export type Zone = 'safe' | 'tight' | 'short';
export type ShockCause = 'insurance' | 'tax' | 'supplemental' | 'hoa';

export type ForecastMonth = {
  i: number;
  /** 'YYYY-MM' */
  month: string;
  mortgage: number;
  escrow: number;
  hoa: number;
  maintenance: number;
  /** what the home costs this month */
  total: number;
  /** what the family pays out of pocket: total + set-aside − what the jar covers */
  effective: number;
  jar: number;
  breathing: number;
  zone: Zone;
};

export type Shock = {
  i: number;
  month: string;
  /** rise in the monthly total, $ */
  delta: number;
  cause: ShockCause;
  parts: Record<ShockCause, number>;
  /** the rise the family still feels after the set-aside (effective jump) */
  felt: number;
  /** the annual premium change behind it (insurance shocks) */
  premiumChange: number;
};

export type ForecastOptions = {
  /** first month, 'YYYY-MM' (default: this month) */
  start?: string;
  /** monthly set-aside (default: the profile's) */
  setAside?: number;
  /** money already in the jar (e.g. a hardship fund) */
  jar0?: number;
  /** $/month that someone else puts toward repairs (a matched repair fund) */
  maintenanceCredit?: number;
  insuranceIncrease?: number;
  supplementalTax?: number;
};

export type Forecast = {
  months: ForecastMonth[];
  shocks: Shock[];
  basicLiving: number;
  /** breathing room below this is tight (amber) */
  threshold: number;
  maintenance: number;
  insuranceRate: number;
  minBreathing: number;
  /** the smallest monthly set-aside that keeps every rise in the next 12 months under $5 */
  recommendedSetAside: number;
  first: Shock | null;
};

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r2 = (v: number) => Math.round(v * 100) / 100;

export function thisMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function addMonthsISO(iso: string, k: number) {
  const [y, m] = iso.split('-').map(Number);
  const t = (y * 12 + (m - 1) + k) | 0;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

/** Basic living costs other than housing for an Orange County household (food, transport, utilities, care) — an estimate. */
export function basicLiving(size: number) {
  return 1400 + 520 * (clamp(Math.round(num(size, 1)), 1, 8) - 1);
}

/** Remaining years for a system (never below 0). */
export function remainingYears(s: HomeSystem) {
  return Math.max(0, num(s.lifeYears) - num(s.ageYears));
}

/** The monthly sinking fund that covers every listed system's replacement by the time it is due (+ $40 for small repairs). */
export function maintenanceSetAside(p: Pick<KeepProfile, 'systems' | 'yearBuilt'>, now = new Date()) {
  const systems = p.systems ?? [];
  if (!systems.length) {
    const age = clamp(now.getFullYear() - num(p.yearBuilt, now.getFullYear()), 0, 120);
    return Math.round(60 + Math.min(90, age * 3));
  }
  let sum = 40;
  for (const s of systems) {
    const mid = (num(s.costLow, SYSTEM_DEFAULTS[s.kind]?.costLow ?? 0) + num(s.costHigh, SYSTEM_DEFAULTS[s.kind]?.costHigh ?? 0)) / 2;
    const months = Math.max(12, remainingYears(s) * 12);
    sum += mid / months;
  }
  return Math.round(sum);
}

export function insuranceRate(p: Pick<KeepProfile, 'fairPlan' | 'insuranceIncrease'>, override?: number) {
  if (override !== undefined) return clamp(num(override), 0, 2);
  if (p.insuranceIncrease !== undefined && p.insuranceIncrease !== null) return clamp(num(p.insuranceIncrease), 0, 2);
  return p.fairPlan ? INSURANCE_FAIR : INSURANCE_STANDARD;
}

/** The zone of a breathing-room value. */
export function zoneOf(breathing: number, threshold: number): Zone {
  return breathing < 0 ? 'short' : breathing < threshold ? 'tight' : 'safe';
}

type Raw = { month: string; mortgage: number; escrow: number; hoa: number; total: number; parts: Record<ShockCause, number>; premiumChange: number }[];

function rawTotals(p: KeepProfile, o: ForecastOptions, maintenance: number, rate: number): Raw {
  const start = o.start ?? thisMonth();
  const startMonth = Number(start.split('-')[1]);
  let premium = Math.max(0, num(p.premium));
  let tax = Math.max(0, num(p.propertyTax));
  let hoa = Math.max(0, num(p.hoa));
  const hoaRate = clamp(num(p.hoaGrowth, HOA_GROWTH), 0, 1);
  const mortgage = Math.max(0, num(p.mortgage));
  let escrow = Math.max(0, num(p.escrow)) || (tax + premium) / 12;
  let pendingTax = 0;
  let supplemental = Math.max(0, num(o.supplementalTax ?? p.supplementalTax));
  const renewal = clamp(Math.round(num(p.renewalMonth, 1)), 1, 12);
  const out: Raw = [];
  for (let i = 0; i < FORECAST_MONTHS; i++) {
    const cm = ((startMonth - 1 + i) % 12) + 1;
    const parts: Record<ShockCause, number> = { insurance: 0, tax: 0, supplemental: 0, hoa: 0 };
    let premiumChange = 0;
    if (i > 0 && cm === TAX_MONTH) {
      const next = tax * (1 + TAX_GROWTH);
      pendingTax += next - tax;
      tax = next;
    }
    if (i > 0 && cm === HOA_MONTH && hoa > 0) {
      const next = hoa * (1 + hoaRate);
      parts.hoa = next - hoa;
      hoa = next;
    }
    if (i > 0 && cm === renewal) {
      // renewal + escrow analysis: the new premium is paid out of escrow, the shortage is spread over 12 months
      const old = premium;
      premium = premium * (1 + rate);
      premiumChange = premium - old;
      const shortage = premiumChange + pendingTax + supplemental;
      const next = (tax + premium) / 12 + shortage / 12;
      const prevBase = escrow;
      parts.insurance = (2 * premiumChange) / 12;
      parts.tax = (2 * pendingTax) / 12;
      parts.supplemental = supplemental / 12;
      // anything else in the change (a shortage from last year ending) isn't a new cause
      escrow = next;
      void prevBase;
      pendingTax = 0;
      supplemental = 0;
    }
    out.push({ month: addMonthsISO(start, i), mortgage, escrow, hoa, total: mortgage + escrow + hoa + maintenance, parts, premiumChange });
  }
  return out;
}

/** The 24-month Payment Forecast. Never NaN: every input is clamped. */
export function forecast(p: KeepProfile, o: ForecastOptions = {}): Forecast {
  const rate = insuranceRate(p, o.insuranceIncrease);
  const credit = Math.max(0, num(o.maintenanceCredit));
  const maintenance = Math.max(0, maintenanceSetAside(p) - credit);
  const raw = rawTotals(p, o, maintenance, rate);
  const living = basicLiving(p.householdSize);
  const takeHome = Math.max(0, num(p.takeHome));
  const threshold = Math.round(Math.max(150, 0.04 * takeHome));
  const run = (setAside: number) => {
    const x = Math.max(0, num(setAside));
    let jar = Math.max(0, num(o.jar0));
    const base0 = raw[0]?.total ?? 0;
    return raw.map((r, i) => {
      jar += x;
      const draw = Math.min(jar, Math.max(0, r.total - base0));
      jar -= draw;
      const effective = r.total + x - draw;
      const breathing = takeHome - effective - living;
      return { i, month: r.month, mortgage: r2(r.mortgage), escrow: r2(r.escrow), hoa: r2(r.hoa), maintenance, total: r2(r.total), effective: r2(effective), jar: r2(jar), breathing: r2(breathing), zone: zoneOf(breathing, threshold) } as ForecastMonth;
    });
  };
  const setAside = o.setAside ?? num(p.setAside);
  const months = run(setAside);
  const shocks: Shock[] = [];
  for (let i = 1; i < raw.length; i++) {
    const delta = raw[i].total - raw[i - 1].total;
    if (delta < SHOCK_MIN) continue;
    const parts = raw[i].parts;
    const cause = (Object.keys(parts) as ShockCause[]).reduce((a, b) => (parts[b] > parts[a] ? b : a), 'insurance');
    shocks.push({ i, month: raw[i].month, delta: Math.round(delta), cause, parts, felt: Math.max(0, Math.round(months[i].effective - months[i - 1].effective)), premiumChange: Math.round(raw[i].premiumChange) });
  }
  const maxJump = (ms: ForecastMonth[]) => ms.slice(0, 13).reduce((m, x, i) => (i ? Math.max(m, x.effective - ms[i - 1].effective) : m), 0);
  // smallest set-aside (whole dollars) that keeps every rise in the coming year under $5 — monotonic, so bisect
  let lo = 0;
  let hi = 2000;
  if (maxJump(run(0)) <= 5) hi = 0;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (maxJump(run(mid)) <= 5) hi = mid;
    else lo = mid + 1;
  }
  return {
    months,
    shocks,
    basicLiving: living,
    threshold,
    maintenance,
    insuranceRate: rate,
    minBreathing: months.reduce((m, x) => Math.min(m, x.breathing), Infinity),
    recommendedSetAside: hi,
    first: shocks[0] ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Staff: risk of payment stress in the next 6 months                   */
/* ------------------------------------------------------------------ */
export type RiskLevel = 'stable' | 'watch' | 'act';
export type Risk = {
  level: RiskLevel;
  /** breathing room now and in 6 months */
  now: number;
  in6: number;
  next: Shock | null;
  shortfall: number;
  missedCheckin: boolean;
  reasons: ('short' | 'tight' | 'shock' | 'repair' | 'checkin')[];
};
export const RISK_ORDER: Record<RiskLevel, number> = { stable: 0, watch: 1, act: 2 };

export function assessRisk(p: KeepProfile, o: ForecastOptions & { lastCheckin?: string | null; today?: Date } = {}): Risk {
  const f = forecast(p, o);
  const six = f.months.slice(0, 7);
  const min6 = six.reduce((m, x) => Math.min(m, x.breathing), Infinity);
  const next = f.shocks.find((s) => s.i <= 6) ?? null;
  // a system due within a year that savings (plus any program money for repairs) can't cover
  const due = (p.systems ?? []).filter((s) => remainingYears(s) <= 1).reduce((a, s) => a + (s.costLow + s.costHigh) / 2, 0);
  const shortfall = Math.max(0, Math.round(due - num(p.savings) - 12 * Math.max(0, num(o.maintenanceCredit)) - Math.max(0, num(o.jar0))));
  const today = o.today ?? new Date();
  const missedCheckin = o.lastCheckin ? (today.getTime() - new Date(o.lastCheckin).getTime()) / 86400000 > 45 : false;
  const reasons: Risk['reasons'] = [];
  if (min6 < 0) reasons.push('short');
  else if (min6 < f.threshold) reasons.push('tight');
  // a shock matters when it cuts into the family's cushion
  if (next && next.felt > 0 && f.months[next.i].breathing < f.threshold * 1.5) reasons.push('shock');
  if (shortfall > 0) reasons.push('repair');
  if (missedCheckin) reasons.push('checkin');
  let level: RiskLevel = 'stable';
  const money = reasons.some((r) => r !== 'checkin');
  if (min6 < 0 || (min6 < f.threshold && (shortfall > 0 || missedCheckin))) level = 'act';
  else if (money) level = 'watch';
  return { level, now: Math.round(f.months[0]?.breathing ?? 0), in6: Math.round(f.months[6]?.breathing ?? 0), next, shortfall, missedCheckin, reasons };
}

/* ------------------------------------------------------------------ */
/* Staff: portfolio stress test                                         */
/* ------------------------------------------------------------------ */
export type StressControls = { insuranceIncrease: number; supplemental: boolean; hardshipFund: number; matchedRepair: number };
export type StressHome = { id: string; profile: KeepProfile; lastCheckin?: string | null };
export type Counts = Record<RiskLevel, number>;
export type StressResult = {
  before: Counts;
  after: Counts;
  atRiskBefore: number;
  atRiskAfter: number;
  missedAvoided: number;
  dollarsProtected: number;
  levels: { id: string; before: RiskLevel; after: RiskLevel }[];
};
/** Expected missed payments a year by risk level (a planning assumption, see docs/DECISIONS.md). */
export const MISSED_PER_YEAR: Record<RiskLevel, number> = { stable: 0, watch: 1, act: 3 };

export function stressTest(homes: StressHome[], c: StressControls, o: { start?: string; today?: Date } = {}): StressResult {
  const before: Counts = { stable: 0, watch: 0, act: 0 };
  const after: Counts = { stable: 0, watch: 0, act: 0 };
  let missedAvoided = 0;
  let dollars = 0;
  const levels: StressResult['levels'] = [];
  for (const h of homes) {
    const supp = c.supplemental ? Math.max(num(h.profile.supplementalTax), Math.round(0.15 * num(h.profile.propertyTax))) : num(h.profile.supplementalTax);
    const scenario = { start: o.start, today: o.today, lastCheckin: h.lastCheckin, insuranceIncrease: clamp(num(c.insuranceIncrease), 0, 2), supplementalTax: supp };
    const b = assessRisk(h.profile, scenario).level;
    const a = assessRisk(h.profile, { ...scenario, jar0: Math.max(0, num(c.hardshipFund)), maintenanceCredit: Math.max(0, num(c.matchedRepair)) }).level;
    before[b]++;
    after[a]++;
    const avoided = MISSED_PER_YEAR[b] - MISSED_PER_YEAR[a];
    missedAvoided += avoided;
    dollars += avoided * Math.max(0, num(h.profile.mortgage));
    levels.push({ id: h.id, before: b, after: a });
  }
  return { before, after, atRiskBefore: before.watch + before.act, atRiskAfter: after.watch + after.act, missedAvoided, dollarsProtected: Math.round(dollars), levels };
}
