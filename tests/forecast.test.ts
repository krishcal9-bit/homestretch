import { describe, expect, it } from 'vitest';
import { assessRisk, forecast, maintenanceSetAside, stressTest, INSURANCE_FAIR, INSURANCE_STANDARD, RISK_ORDER } from '@/lib/forecast';
import { EMPTY_KEEP, type KeepProfile } from '@/lib/keep';

const START = '2026-11';
const base: KeepProfile = {
  ...EMPTY_KEEP,
  householdSize: 4,
  mortgage: 1420,
  escrow: 420,
  insurer: 'California FAIR Plan',
  fairPlan: true,
  premium: 1416,
  renewalMonth: 3,
  propertyTax: 3620,
  hoa: 0,
  yearBuilt: 2014,
  income: 78000,
  takeHome: 4600,
  savings: 900,
  setAside: 0,
  systems: [],
};

describe('forecast engine', () => {
  it('re-analyzes escrow at the renewal: new premium / 12 plus the shortage spread over 12 months', () => {
    const f = forecast(base, { start: START });
    const march = f.months.find((m) => m.month === '2027-03')!;
    const feb = f.months.find((m) => m.month === '2027-02')!;
    const newPremium = 1416 * (1 + INSURANCE_FAIR);
    expect(march.escrow).toBeCloseTo((3620 + newPremium) / 12 + (newPremium - 1416) / 12, 1);
    expect(feb.escrow).toBe(420);
  });

  it('takes the FAIR Plan path (29.1%) and the standard path (15%)', () => {
    const fair = forecast(base, { start: START });
    const std = forecast({ ...base, fairPlan: false, insurer: 'Sample Mutual' }, { start: START });
    expect(fair.insuranceRate).toBe(INSURANCE_FAIR);
    expect(std.insuranceRate).toBe(INSURANCE_STANDARD);
    expect(fair.first!.premiumChange).toBe(Math.round(1416 * INSURANCE_FAIR)); // $412 a year
    expect(fair.first!.delta).toBeGreaterThan(std.first!.delta);
  });

  it('detects the March insurance shock and names its cause', () => {
    const f = forecast(base, { start: START });
    expect(f.first?.month).toBe('2027-03');
    expect(f.first?.cause).toBe('insurance');
    expect(f.first!.delta).toBeGreaterThanOrEqual(60);
  });

  it('collects tax growth (2% each July) at the next escrow analysis', () => {
    const f = forecast({ ...base, premium: 0, fairPlan: false }, { start: START });
    const s = f.shocks.find((x) => x.month === '2028-03');
    expect(s?.cause ?? 'tax').toBe('tax');
  });

  it('flattening is monotonic: more set aside never makes the felt jump bigger', () => {
    let prev = Infinity;
    for (let x = 0; x <= 200; x += 5) {
      const f = forecast(base, { start: START, setAside: x });
      const felt = f.shocks[0]?.felt ?? 0;
      expect(felt).toBeLessThanOrEqual(prev);
      prev = felt;
    }
    const f = forecast(base, { start: START });
    const flat = forecast(base, { start: START, setAside: f.recommendedSetAside });
    // the recommendation covers the coming year
    expect(Math.max(0, ...flat.shocks.filter((s) => s.i <= 12).map((s) => s.felt))).toBeLessThanOrEqual(5);
  });

  it('never returns NaN with all-zero inputs', () => {
    const zero: KeepProfile = { ...EMPTY_KEEP, householdSize: 0, renewalMonth: 0, yearBuilt: 0 };
    const f = forecast(zero, { start: START });
    for (const m of f.months) for (const v of [m.total, m.effective, m.breathing, m.escrow, m.jar]) expect(Number.isFinite(v)).toBe(true);
    expect(Number.isFinite(f.recommendedSetAside)).toBe(true);
    expect(Number.isFinite(maintenanceSetAside(zero))).toBe(true);
    const r = assessRisk(zero, { start: START });
    expect(Number.isFinite(r.now) && Number.isFinite(r.in6)).toBe(true);
  });
});

describe('portfolio stress test', () => {
  const homes = Array.from({ length: 12 }, (_, i) => ({
    id: `h${i}`,
    profile: { ...base, fairPlan: i % 3 === 0, takeHome: 3900 + i * 120, renewalMonth: (i % 12) + 1, savings: i * 150 } as KeepProfile,
    lastCheckin: i % 4 === 0 ? '2026-08-01' : '2026-10-25',
  }));
  const today = new Date('2026-11-07');

  it('never makes anyone safer when insurance rises', () => {
    let prev: Record<string, number> | null = null;
    for (let rate = 0; rate <= 0.5; rate += 0.05) {
      const r = stressTest(homes, { insuranceIncrease: rate, supplemental: false, hardshipFund: 0, matchedRepair: 0 }, { start: START, today });
      const now = Object.fromEntries(r.levels.map((l) => [l.id, RISK_ORDER[l.before]]));
      if (prev) for (const id of Object.keys(now)) expect(now[id]).toBeGreaterThanOrEqual(prev[id]);
      prev = now;
    }
  });

  it('programs only help, and the protected dollars follow from the avoided misses', () => {
    const r = stressTest(homes, { insuranceIncrease: 0.29, supplemental: true, hardshipFund: 500, matchedRepair: 150 }, { start: START, today });
    for (const l of r.levels) expect(RISK_ORDER[l.after]).toBeLessThanOrEqual(RISK_ORDER[l.before]);
    expect(r.atRiskAfter).toBeLessThanOrEqual(r.atRiskBefore);
    expect(r.dollarsProtected).toBeGreaterThanOrEqual(0);
  });
});

describe('ready → keep bridge', () => {
  it('previews the first year of owning without NaN, even with no income', async () => {
    const { firstYearOwning } = await import('@/lib/readiness');
    const { SEED_FAMILIES } = await import('@/lib/seedData');
    for (const f of SEED_FAMILIES) {
      const y = firstYearOwning(f.profile);
      expect(Number.isFinite(y.monthly)).toBe(true);
      expect(y.monthly).toBeGreaterThanOrEqual(y.mortgage);
    }
    const zero = firstYearOwning({ ...SEED_FAMILIES[0].profile, grossMonthlyIncome: 0, otherMonthlyIncome: 0 });
    expect(Number.isFinite(zero.monthly)).toBe(true);
  });

  it('seeds 40 fictional homeowners: 6 on the FAIR Plan, 12 Spanish-preferring, renewals across the year', async () => {
    const { seedHomeowners } = await import('@/lib/seedHomeowners');
    const hs = seedHomeowners(new Date('2026-11-07'));
    expect(hs).toHaveLength(40);
    expect(hs.filter((h) => h.profile.fairPlan)).toHaveLength(6);
    expect(hs.filter((h) => h.language === 'es')).toHaveLength(12);
    expect(new Set(hs.map((h) => h.profile.renewalMonth)).size).toBe(12);
    expect(hs.every((h) => /Sample|Example|Demo|Placeholder|Specimen/.test(h.address))).toBe(true);
  });
});
