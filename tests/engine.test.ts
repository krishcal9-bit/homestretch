import { describe, expect, it } from 'vitest';
import { computeReadiness, simulateProgram, solveForDate, stageOf, tenYearComparison, sanitize, MAX_MONTHS } from '@/lib/engine';
import { SEED_FAMILIES } from '@/lib/seedData';
import type { Profile } from '@/lib/types';

const today = new Date(Date.UTC(2026, 10, 6)); // Nov 2026

const base: Profile = {
  householdSize: 4, inOC: true, residentOrCitizen: true,
  grossMonthlyIncome: 5200, otherMonthlyIncome: 0,
  rent: 2350, bedrooms: 2, occupants: 4, unsafeConditions: false,
  debts: [], savings: 0, creditBand: 'good',
  levers: { extraDebt: 0, monthlySavings: 0, coApplicantIncome: 0 },
};
const r = (p: Partial<Profile>) => computeReadiness({ ...base, ...p }, { today });

describe('tier', () => {
  it('uses gross + other + co-applicant income', () => {
    expect(r({ grossMonthlyIncome: 55850 / 12 }).tier).toBe('very_low');
    expect(r({ grossMonthlyIncome: 55849 / 12 }).tier).toBe('below');
    expect(r({ grossMonthlyIncome: 6000, otherMonthlyIncome: 2000 }).tier).toBe('low'); // 96k for 4
    expect(r({ grossMonthlyIncome: 6000, levers: { extraDebt: 0, monthlySavings: 0, coApplicantIncome: 8000 } }).tier).toBe('above');
  });
});

describe('cost burden and need', () => {
  it('computes rent / gross', () => {
    expect(r({ rent: 2080, grossMonthlyIncome: 5200 }).costBurden).toBeCloseTo(0.4);
  });
  it('exactly 30% is not need; above is', () => {
    expect(r({ rent: 1560, grossMonthlyIncome: 5200, bedrooms: 2, occupants: 4 }).eligible.need).toBe(false);
    expect(r({ rent: 1561, grossMonthlyIncome: 5200 }).eligible.need).toBe(true);
  });
  it('overcrowding or unsafe conditions count as need', () => {
    expect(r({ rent: 1000, bedrooms: 1, occupants: 3 }).eligible.need).toBe(true);
    expect(r({ rent: 1000, unsafeConditions: true }).eligible.need).toBe(true);
  });
});

describe('debt timeline', () => {
  it('clears collections first', () => {
    const res = r({
      creditBand: 'needs_work', savings: 50000,
      debts: [{ kind: 'card', balance: 3000, minPayment: 90 }, { kind: 'collection', balance: 1200, minPayment: 0 }],
      levers: { extraDebt: 200, monthlySavings: 0, coApplicantIncome: 0 },
    });
    const col = res.milestones.find((m) => m.key === 'collections')!;
    expect(col.month).toBe(6); // $1,200 at $200/month
    expect(res.milestones.find((m) => m.key === 'credit')!.month).toBeGreaterThanOrEqual(12);
    expect(res.blockers[0].key).toBe('collections');
  });
});

describe('ready now', () => {
  it('good credit, no debt and savings above target → month 0', () => {
    const res = r({ savings: 20000 });
    expect(res.monthsToReady).toBe(0);
    expect(res.readyDate).toBe('2026-11');
    expect(res.milestones.find((m) => m.key === 'keys')!.month).toBe(10); // application at 1, +9 build-and-close
    expect(stageOf(res)).toBe('ready_now');
  });
});

describe('levers', () => {
  it('more extra debt never makes the date later', () => {
    for (const f of SEED_FAMILIES) {
      let prev = Infinity;
      for (let e = 0; e <= 800; e += 25) {
        const m = computeReadiness({ ...f.profile, levers: { ...f.profile.levers, extraDebt: e } }, { today }).monthsToReady;
        expect(m).toBeLessThanOrEqual(prev);
        prev = m;
      }
    }
  });
  it('more savings never makes the date later', () => {
    for (const f of SEED_FAMILIES) {
      let prev = Infinity;
      for (let s = 0; s <= 1000; s += 50) {
        const m = computeReadiness({ ...f.profile, levers: { ...f.profile.levers, monthlySavings: s } }, { today }).monthsToReady;
        expect(m).toBeLessThanOrEqual(prev);
        prev = m;
      }
    }
  });
  it('runs in under 2 ms', () => {
    const p = SEED_FAMILIES[0].profile;
    for (let i = 0; i < 100; i++) computeReadiness(p);
    const t = performance.now();
    for (let i = 0; i < 500; i++) computeReadiness(p);
    expect((performance.now() - t) / 500).toBeLessThan(2);
  });
});

describe('solveForDate', () => {
  const p: Profile = { ...base, creditBand: 'needs_work', savings: 3100, debts: [{ kind: 'collection', balance: 1900, minPayment: 0 }] };
  it('hits the target month', () => {
    const sol = solveForDate(p, 14, { today })!;
    expect(sol).not.toBeNull();
    expect(sol.monthsToReady).toBeLessThanOrEqual(14);
    const check = computeReadiness({ ...p, levers: { ...p.levers, extraDebt: sol.extraDebt, monthlySavings: sol.monthlySavings } }, { today });
    expect(check.monthsToReady).toBe(sol.monthsToReady);
    // $10 less on savings would miss (it's the cheapest split), unless savings is already 0
    if (sol.monthlySavings > 0) {
      const less = computeReadiness({ ...p, levers: { ...p.levers, extraDebt: sol.extraDebt, monthlySavings: sol.monthlySavings - 10 } }, { today });
      expect(less.monthsToReady).toBeGreaterThan(14);
    }
  });
  it('returns null when impossible', () => {
    expect(solveForDate(p, 3, { today })).toBeNull(); // needs_work credit is at least 12 months
  });
});

describe('tenYearComparison', () => {
  it('returns ten yearly points with equity for Habitat and none for renting', () => {
    const t = tenYearComparison({ ...base, savings: 9000 });
    expect(t.points).toHaveLength(10);
    expect(t.points[9].rentCost).toBeGreaterThan(t.points[0].rentCost * 10);
    expect(t.equity10).toBeGreaterThan(0);
  });
});

describe('simulateProgram', () => {
  const fams = SEED_FAMILIES.map((f) => f.profile);
  it('never makes anyone later', () => {
    const base0 = simulateProgram(fams, { matchedSavings: 0, counselingMonths: 0, grant: 0 }, 24, { today });
    const prog = simulateProgram(fams, { matchedSavings: 100, counselingMonths: 3, grant: 1000 }, 24, { today });
    expect(base0.cost).toBe(0);
    prog.months.forEach((m, i) => expect(m).toBeLessThanOrEqual(base0.months[i]));
    expect(prog.moreReadyBy(13)).toBeGreaterThan(0);
    expect(prog.cost).toBeGreaterThan(0);
  });
});

describe('resilience', () => {
  it('zero income never produces NaN', () => {
    const res = computeReadiness({ ...base, grossMonthlyIncome: 0, rent: 0, bedrooms: 0, occupants: 0 }, { today });
    expect(res.noIncome).toBe(true);
    expect(JSON.stringify(res)).not.toMatch(/NaN|Infinity|null/);
  });
  it('clamps absurd inputs', () => {
    const s = sanitize({ ...base, householdSize: 40, grossMonthlyIncome: -5, rent: 1e9 });
    expect(s.householdSize).toBe(8);
    expect(s.grossMonthlyIncome).toBe(0);
    expect(s.rent).toBe(10000);
    expect(computeReadiness({ ...base, savings: 0, levers: { extraDebt: 0, monthlySavings: 0, coApplicantIncome: 0 }, debts: [{ kind: 'collection', balance: 5000, minPayment: 0 }] }).monthsToReady).toBe(MAX_MONTHS);
  });
});
