// Keystone readiness engine. Pure, deterministic TypeScript, no LLM (BUILD_SPEC §3).
// Claude explains and plans around these numbers; it never produces them.
import { tierFor } from './incomeTiers';
import type { Blocker, Debt, DebtKind, Milestone, MilestoneKey, Profile, ReadinessResult } from './types';

export const MAX_MONTHS = 120; // horizon of the simulation; anything later reads as "10+ years"
export const BUILD_AND_CLOSE_MONTHS = 9; // typical Habitat build-and-close window from application to keys
// Cash to close. BUILD_SPEC §3 says 3% down + 2% closing of the max financeable price, which is
// $28k+ for a typical family and makes every family years out (see docs/DECISIONS.md). We use Habitat
// OC's published 1% minimum down payment plus a flat closing-cost estimate. Tune here.
export const DOWN_PAYMENT_RATE = 0.01;
export const CLOSING_COSTS = 1500;
export const HABITAT_TERM_MONTHS = 360; // 30-year, 0% interest Habitat note
export const PAYMENT_SHARE = 0.3; // max affordable payment = 30% of gross monthly income
const DEFAULT_APR: Record<DebtKind, number> = { card: 0.24, car: 0.08, student: 0.06, collection: 0, other: 0.1 };

export type EngineOptions = {
  /** "Today", for deterministic tests. */
  today?: Date;
  /** Program simulator: months a counseling program shortens the credit milestone by. */
  creditReduction?: number;
};

const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);
const round100 = (n: number) => Math.round(n / 100) * 100;

export function addMonths(today: Date, months: number): string {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Whole months from today's month to an ISO month ("2027-03"). */
export function monthsUntil(isoMonth: string, today: Date = new Date()): number {
  const [y, m] = isoMonth.split('-').map(Number);
  return (y - today.getUTCFullYear()) * 12 + (m - 1 - today.getUTCMonth());
}

/** Clamp every input so nothing downstream sees NaN, negatives or absurd values (§9.3). */
export function sanitize(p: Profile): Profile {
  return {
    ...p,
    householdSize: Math.round(clamp(p.householdSize, 1, 8)),
    grossMonthlyIncome: clamp(p.grossMonthlyIncome, 0, 50000),
    otherMonthlyIncome: clamp(p.otherMonthlyIncome, 0, 50000),
    rent: clamp(p.rent, 0, 10000),
    bedrooms: Math.round(clamp(p.bedrooms, 0, 10)),
    occupants: Math.round(clamp(p.occupants, 0, 20)),
    savings: clamp(p.savings, 0, 10_000_000),
    debts: (p.debts ?? [])
      .map((d) => ({ ...d, balance: clamp(d.balance, 0, 1_000_000), minPayment: clamp(d.minPayment, 0, 50000), apr: d.apr === undefined ? undefined : clamp(d.apr, 0, 1) }))
      .filter((d) => d.balance > 0),
    levers: {
      extraDebt: clamp(p.levers?.extraDebt ?? 0, 0, 5000),
      monthlySavings: clamp(p.levers?.monthlySavings ?? 0, 0, 5000),
      coApplicantIncome: clamp(p.levers?.coApplicantIncome ?? 0, 0, 50000),
    },
  };
}

type DebtSim = {
  /** Month collections are fully paid (0 if none / already). -1 if never within horizon. */
  collectionsMonth: number;
  /** Month the credit-blocking debt condition is met (collections 0, cards < 30% util). -1 if never. */
  clearMonth: number;
  /** Debt budget left over each month (index = month) once debts are paid off; rolls into savings. */
  spare: number[];
  /** Spare budget the month after clearMonth (for "Why this date"). */
  freed: number;
  hadCollections: boolean;
  collectionBalance: number;
};

const aprOf = (d: Debt) => d.apr ?? DEFAULT_APR[d.kind];

/**
 * Month-by-month debt simulation. Budget = sum of minPayments + extraDebt.
 * Mins are paid first; the remainder goes to collections first (they block "good standing"),
 * then the highest-APR card, then other debts by APR.
 */
export function simulateDebts(debts: Debt[], extraDebt: number): DebtSim {
  const ds = debts.map((d) => ({ ...d, bal: d.balance, limit: d.kind === 'card' ? d.balance / 0.9 : 0 }));
  const budget = ds.reduce((s, d) => s + d.minPayment, 0) + extraDebt;
  const hadCollections = ds.some((d) => d.kind === 'collection');
  const collectionBalance = ds.filter((d) => d.kind === 'collection').reduce((s, d) => s + d.bal, 0);
  const cardLimit = ds.reduce((s, d) => s + d.limit, 0);
  const done = () =>
    ds.every((d) => d.kind !== 'collection' || d.bal <= 0.005) &&
    (cardLimit === 0 || ds.filter((d) => d.kind === 'card').reduce((s, d) => s + d.bal, 0) < 0.3 * cardLimit);
  const collectionsDone = () => ds.every((d) => d.kind !== 'collection' || d.bal <= 0.005);
  const priority = [...ds].sort((a, b) => {
    const rank = (d: (typeof ds)[number]) => (d.kind === 'collection' ? 0 : d.kind === 'card' ? 1 : 2);
    return rank(a) - rank(b) || aprOf(b) - aprOf(a);
  });

  let collectionsMonth = hadCollections ? -1 : 0;
  let clearMonth = done() ? 0 : -1;
  if (collectionsDone()) collectionsMonth = 0;
  const spare: number[] = [0];
  for (let m = 1; m <= MAX_MONTHS; m++) {
    for (const d of ds) if (d.bal > 0) d.bal *= 1 + aprOf(d) / 12;
    let left = budget;
    for (const d of ds) {
      const pay = Math.min(d.bal, d.minPayment, left);
      d.bal -= pay;
      left -= pay;
    }
    for (const d of priority) {
      if (left <= 0) break;
      const pay = Math.min(d.bal, left);
      d.bal -= pay;
      left -= pay;
    }
    spare.push(left);
    if (collectionsMonth < 0 && collectionsDone()) collectionsMonth = m;
    if (clearMonth < 0 && done()) clearMonth = m;
  }
  const freed = clearMonth >= 0 ? Math.round(spare[Math.min(MAX_MONTHS, clearMonth + 1)] ?? 0) : 0;
  return { collectionsMonth, clearMonth, spare, freed, hadCollections, collectionBalance };
}

const fmt$ = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

/** The core: profile in, readiness out. Runs well under 2 ms. */
export function computeReadiness(input: Profile, opts: EngineOptions = {}): ReadinessResult {
  const p = sanitize(input);
  const today = opts.today ?? new Date();
  const gross = p.grossMonthlyIncome + p.otherMonthlyIncome + p.levers.coApplicantIncome;
  const noIncome = gross <= 0;
  const annual = gross * 12;
  const tier = tierFor(p.householdSize, annual);

  const costBurden = gross > 0 ? p.rent / gross : 0;
  const overcrowded = p.bedrooms > 0 ? p.occupants / p.bedrooms > 2 : p.occupants > 2;
  const minPayments = p.debts.reduce((s, d) => s + d.minPayment, 0);
  const dti = gross > 0 ? minPayments / gross : 0;
  const maxPayment = PAYMENT_SHARE * gross;
  const financeableHome = maxPayment * HABITAT_TERM_MONTHS;
  const downPaymentTarget = financeableHome > 0 ? round100(DOWN_PAYMENT_RATE * financeableHome + CLOSING_COSTS) : 0;

  const need = costBurden > 0.3 || overcrowded || p.unsafeConditions;
  const incomeOk = tier === 'very_low' || tier === 'low' || tier === 'moderate';
  const residency = p.inOC && p.residentOrCitizen;
  const reasons: string[] = [];
  if (!need) reasons.push('Housing costs are under 30% of income and the home is not overcrowded or unsafe.');
  if (tier === 'above') reasons.push('Household income is above the moderate limit for this household size.');
  if (tier === 'below') reasons.push('Household income is below the very-low minimum; Habitat needs steady income to carry a mortgage.');
  if (!p.inOC) reasons.push('Habitat OC requires living or working in Orange County.');
  if (!p.residentOrCitizen) reasons.push('Habitat OC requires US citizenship or permanent residency.');

  // Debts → credit
  const sim = simulateDebts(p.debts, p.levers.extraDebt);
  const debtMonth = sim.clearMonth < 0 ? MAX_MONTHS : sim.clearMonth;
  let credit: number;
  switch (p.creditBand) {
    case 'good':
      credit = sim.hadCollections ? debtMonth : 0;
      break;
    case 'needs_work':
      credit = Math.max(debtMonth + 6, 12);
      break;
    case 'building':
    case 'unknown':
    default:
      credit = Math.max(debtMonth, 6);
  }
  credit = Math.max(0, Math.min(MAX_MONTHS, credit - (opts.creditReduction ?? 0)));

  // Savings: the lever, plus any debt budget left over once debts are paid off (freed minimums + extra).
  const freedPayments = sim.freed;
  let savingsMonth = -1;
  let balance = p.savings;
  if (balance >= downPaymentTarget) savingsMonth = 0;
  for (let m = 1; m <= MAX_MONTHS && savingsMonth < 0; m++) {
    balance += p.levers.monthlySavings + sim.spare[m];
    if (balance >= downPaymentTarget) savingsMonth = m;
  }
  const savings = savingsMonth < 0 ? MAX_MONTHS : savingsMonth;

  const monthsToReady = noIncome ? 0 : Math.max(credit, savings);
  const orientation = Math.max(0, monthsToReady - 2);
  const application = orientation + 1;
  const keys = Math.max(application, credit, savings) + BUILD_AND_CLOSE_MONTHS;

  const milestones: Milestone[] = [];
  const ms = (key: MilestoneKey, month: number, label: string, action: string) => milestones.push({ key, month, label, action });
  if (sim.hadCollections) {
    ms('collections', sim.collectionsMonth < 0 ? MAX_MONTHS : sim.collectionsMonth, 'Collections cleared',
      `Put every extra dollar toward the ${fmt$(sim.collectionBalance)} in collections first; ask the agency for a pay-for-delete letter.`);
  }
  ms('credit', credit, 'Credit at 640', p.creditBand === 'good' && !sim.hadCollections
    ? 'Keep paying every bill on time; your credit already meets the bar.'
    : 'Keep card balances under 30% of limits and pay every bill on time. SparkPoint OC offers free credit coaching.');
  ms('savings', savings, 'Down payment saved', `Build savings to ${fmt$(downPaymentTarget)} for the down payment and closing costs.`);
  ms('orientation', orientation, 'Orientation', 'Sign up for a Habitat OC homeownership orientation.');
  ms('application', application, 'Application', 'Submit your Habitat OC application with pay stubs and bank statements.');
  ms('keys', keys, 'Keys', 'Finish sweat equity hours and close on your Habitat home.');
  milestones.sort((a, b) => a.month - b.month);

  const blockers: Blocker[] = [];
  if (!residency) blockers.push({ key: 'residency', severity: 3, text: reasons.filter((r) => /Orange County|citizenship/.test(r)).join(' ') });
  if (tier === 'above') blockers.push({ key: 'income_high', severity: 3, text: 'Income is above Habitat OC limits.' });
  if (tier === 'below') blockers.push({ key: 'income_low', severity: 3, text: 'Income is below the very-low minimum.' });
  if (sim.hadCollections) blockers.push({ key: 'collections', severity: 3, text: `${fmt$(sim.collectionBalance)} in collections must be cleared.` });
  if (p.creditBand === 'needs_work' || p.creditBand === 'building') {
    blockers.push({ key: 'credit', severity: p.creditBand === 'needs_work' ? 3 : 2, text: `Credit needs about ${credit} months of rebuilding.` });
  }
  if (p.creditBand === 'unknown') blockers.push({ key: 'credit_unknown', severity: 1, text: 'Pull your free report at annualcreditreport.com this week.' });
  if (savings > 0) blockers.push({ key: 'savings', severity: savings > 24 ? 3 : 2, text: `Needs ${fmt$(Math.max(0, downPaymentTarget - p.savings))} more saved for down payment and closing.` });
  if (dti > 0.43) blockers.push({ key: 'dti', severity: 2, text: `Debt payments are ${Math.round(dti * 100)}% of income; lenders look for under 43%.` });
  if (!need) blockers.push({ key: 'need', severity: 1, text: 'No housing need on record yet.' });
  blockers.sort((a, b) => b.severity - a.severity || (a.key === 'collections' ? -1 : 0));

  let score = Math.max(5, 100 - 4 * monthsToReady);
  if (!need || !incomeOk || !residency) score -= 25;
  if (p.statement && p.statement.overdraftOrNsfCount === 0) score += 5;
  score = Math.round(clamp(score, 0, 100));

  return {
    eligible: { need, income: incomeOk, residency, reasons },
    tier,
    costBurden,
    overcrowded,
    dti,
    maxPayment,
    financeableHome,
    downPaymentTarget,
    monthsToReady,
    readyDate: addMonths(today, monthsToReady),
    milestones,
    blockers,
    score,
    debtClearMonth: sim.clearMonth < 0 ? MAX_MONTHS : sim.clearMonth,
    freedPayments,
    noIncome,
  };
}

export const isEligible = (r: ReadinessResult) => r.eligible.need && r.eligible.income && r.eligible.residency;

export type SolveResult = { extraDebt: number; monthlySavings: number; monthsToReady: number; addedPerMonth: number };

/**
 * D1 reverse goal-seek: the cheapest (extraDebt, monthlySavings) pair that makes the family
 * ready by `targetMonth` (months from today). Searches extraDebt 0–800 in $10 steps and, for
 * each, binary-searches the smallest monthlySavings (0–1500, $10 steps). Returns null if even
 * both maxed can't make it.
 */
export function solveForDate(profile: Profile, targetMonth: number, opts: EngineOptions = {}): SolveResult | null {
  const at = (extraDebt: number, monthlySavings: number) =>
    computeReadiness({ ...profile, levers: { ...profile.levers, extraDebt, monthlySavings } }, opts).monthsToReady;
  if (at(800, 1500) > targetMonth) return null;
  let best: SolveResult | null = null;
  for (let e = 0; e <= 800; e += 10) {
    if (best && e >= best.extraDebt + best.monthlySavings) break; // can't beat the best total any more
    if (at(e, 1500) > targetMonth) continue;
    let lo = 0;
    let hi = 150; // in $10 steps
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (at(e, mid * 10) <= targetMonth) hi = mid;
      else lo = mid + 1;
    }
    const s = lo * 10;
    if (!best || e + s < best.extraDebt + best.monthlySavings) {
      best = { extraDebt: e, monthlySavings: s, monthsToReady: at(e, s), addedPerMonth: 0 };
    }
  }
  if (best) best.addedPerMonth = best.extraDebt + best.monthlySavings - (profile.levers.extraDebt + profile.levers.monthlySavings);
  return best;
}

export type TenYearPoint = { year: number; rentCost: number; habitatCost: number; equity: number };
export type TenYearComparison = { points: TenYearPoint[]; rentTotal: number; habitatTotal: number; equity10: number; payment: number };

/** D2: ten years of renting (rent +4%/yr, $0 equity) vs a Habitat home (fixed payment, 0% note, value +3%/yr). */
export function tenYearComparison(input: Profile): TenYearComparison {
  const r = computeReadiness(input);
  const p = sanitize(input);
  const price = r.financeableHome;
  const down = Math.min(r.downPaymentTarget, price);
  const loan = Math.max(0, price - down);
  const payment = loan / HABITAT_TERM_MONTHS;
  const points: TenYearPoint[] = [];
  let rentCost = 0;
  let habitatCost = down;
  for (let y = 1; y <= 10; y++) {
    rentCost += p.rent * 12 * Math.pow(1.04, y - 1);
    habitatCost += payment * 12;
    const paid = Math.min(loan, payment * 12 * y);
    const equity = price * Math.pow(1.03, y) - (loan - paid);
    points.push({ year: y, rentCost: Math.round(rentCost), habitatCost: Math.round(habitatCost), equity: Math.round(equity) });
  }
  return { points, rentTotal: points[9].rentCost, habitatTotal: points[9].habitatCost, equity10: points[9].equity, payment };
}

export type Program = { matchedSavings: number; counselingMonths: number; grant: number };
export const COUNSELING_COST_PER_FAMILY_MONTH = 100; // assumed cost of counseling per month shortened, per family
export type ProgramResult = { baseline: number[]; projected: number[]; cost: number; moreReadyBy: (month: number) => number; months: number[] };

/** D6: apply a program to every family; returns ready-month histograms (0..horizon-1) and cost. Never makes anyone later. */
export function simulateProgram(families: Profile[], program: Program, horizon = 24, opts: EngineOptions = {}): ProgramResult {
  const baseline = new Array(horizon).fill(0);
  const projected = new Array(horizon).fill(0);
  const before: number[] = [];
  const after: number[] = [];
  let cost = 0;
  for (const f of families) {
    const b = computeReadiness(f, opts);
    const boosted: Profile = {
      ...f,
      savings: f.savings + program.grant,
      levers: { ...f.levers, monthlySavings: f.levers.monthlySavings + program.matchedSavings },
    };
    const a = computeReadiness(boosted, { ...opts, creditReduction: program.counselingMonths });
    const bm = isEligible(b) ? b.monthsToReady : Infinity;
    const am = isEligible(b) ? Math.min(bm, a.monthsToReady) : Infinity;
    before.push(bm);
    after.push(am);
    if (bm < horizon) baseline[bm]++;
    if (am < horizon) projected[am]++;
    if (isEligible(b)) {
      cost += program.grant + program.matchedSavings * Math.min(am, horizon) + COUNSELING_COST_PER_FAMILY_MONTH * program.counselingMonths;
    }
  }
  const moreReadyBy = (month: number) => after.filter((m) => m <= month).length - before.filter((m) => m <= month).length;
  return { baseline, projected, cost: Math.round(cost), moreReadyBy, months: after };
}

/** Pipeline stage for staff. */
export type Stage = 'ready_now' | 'le6' | 'six_18' | 'gt18' | 'not_eligible';
export function stageOf(r: ReadinessResult): Stage {
  if (!isEligible(r)) return 'not_eligible';
  if (r.monthsToReady === 0) return 'ready_now';
  if (r.monthsToReady <= 6) return 'le6';
  if (r.monthsToReady <= 18) return 'six_18';
  return 'gt18';
}
