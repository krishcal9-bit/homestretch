import { describe, expect, it } from 'vitest';
import { EMPTY_KEEP, SYSTEM_DEFAULTS, type KeepProfile } from '@/lib/keep';
import { maintenanceSetAside } from '@/lib/forecast';
import { fallbackHelp, makeSystem, repairSummary, repairTimeline, resolveSystem, upsertSystem } from '@/lib/homeHealth';
import { careLimit, EXEMPTION_VALUE, fallbackRelief, feraLimit, mergeRelief, reliefFacts, reliefWorth } from '@/lib/relief';
import { applyAnswer, changeSentence, snapshot } from '@/lib/keepCheckin';
import { KeepProfileSchema } from '@/lib/keepSchema';
import { firstYearOwning } from '@/lib/readiness';
import type { Profile } from '@/lib/types';

const NOW = new Date('2026-11-07T12:00:00');
const ramirez: KeepProfile = {
  ...EMPTY_KEEP,
  householdSize: 4,
  mortgage: 1000,
  escrow: 436,
  insurer: 'California FAIR Plan',
  fairPlan: true,
  premium: 1416,
  renewalMonth: 3,
  propertyTax: 3816,
  yearBuilt: 1998,
  zip: '92701',
  income: 68600,
  takeHome: 4570,
  savings: 300,
  systems: [makeSystem('water_heater', 0, { id: 'wh' }), makeSystem('roof', 0, { id: 'rf' })],
};
const finite = (o: unknown): boolean => (typeof o === 'number' ? Number.isFinite(o) : Array.isArray(o) ? o.every(finite) : o && typeof o === 'object' ? Object.values(o).every(finite) : true);

describe('home health', () => {
  it('a data plate read turns into an age; life and cost always come from the defaults', () => {
    const r = resolveSystem({ kind: 'water_heater', read: { isHomeSystem: true, system: 'water_heater', manufactureYear: 2014, estimatedAgeYears: null, confidence: 'high', details: null } }, NOW);
    expect(r).toMatchObject({ system: 'water_heater', estimatedAgeYears: 12, confidence: 'high', typicalLifeYears: 12, replacementCostRange: [1800, 3200], from: 'photo' });
  });
  it('typed age wins over nothing; nothing at all is a low-confidence typical guess', () => {
    expect(resolveSystem({ kind: 'roof', ageYears: 20 }, NOW)).toMatchObject({ estimatedAgeYears: 20, confidence: 'high', from: 'typed' });
    expect(resolveSystem({ kind: 'roof', installYear: 2010 }, NOW)).toMatchObject({ estimatedAgeYears: 16, from: 'typed' });
    expect(resolveSystem({ kind: 'hvac' }, NOW)).toMatchObject({ estimatedAgeYears: 8, confidence: 'low', from: 'default' });
  });
  it('one of each kind: a second water heater replaces the first', () => {
    const s = upsertSystem(ramirez.systems, makeSystem('water_heater', 12, { id: 'new' }));
    expect(s).toHaveLength(2);
    expect(s.find((x) => x.kind === 'water_heater')).toMatchObject({ id: 'wh', ageYears: 12 });
  });
  it('the timeline is soonest first and the set-aside rises when a system ages', () => {
    const old = { ...ramirez, systems: upsertSystem(ramirez.systems, makeSystem('water_heater', 12)) };
    const t = repairTimeline(old.systems, NOW);
    expect(t[0]).toMatchObject({ inYears: 0, dueYear: 2026, soon: true });
    expect(t[1]).toMatchObject({ dueYear: 2051, soon: false });
    expect(maintenanceSetAside(old, NOW)).toBeGreaterThan(maintenanceSetAside(ramirez, NOW));
    const sum = repairSummary(old, NOW);
    expect(sum).toMatchObject({ low: 1800, high: 3200, savings: 300, nextGap: 2200 });
  });
  it('all-zero input never makes NaN', () => {
    expect(finite(repairSummary({ ...EMPTY_KEEP, yearBuilt: NaN as unknown as number }, NOW))).toBe(true);
    const r = repairSummary({ ...EMPTY_KEEP, systems: [{ id: 'x', kind: 'roof', ageYears: NaN, lifeYears: NaN, costLow: NaN, costHigh: NaN }] }, NOW);
    expect(finite([r.monthly, r.low, r.high, r.savings, r.nextGap, ...r.items.flatMap((i) => [i.inYears, i.dueYear])])).toBe(true);
  });
  it('the static safe checklist exists for every system in both languages', () => {
    for (const k of Object.keys(SYSTEM_DEFAULTS) as (keyof typeof SYSTEM_DEFAULTS)[]) {
      for (const l of ['en', 'es'] as const) expect(fallbackHelp(k, l).steps.length).toBeGreaterThanOrEqual(3);
    }
    expect(fallbackHelp('water_heater', 'en').urgency).toBe('now');
  });
});

describe('relief finder', () => {
  it('limits follow 200% / 250% of the poverty guideline', () => {
    expect(careLimit(4)).toBe(64300);
    expect(feraLimit(4)).toBe(80400);
    expect(feraLimit(2)).toBe(0);
  });
  it('personalizes CARE vs FERA by income and household size', () => {
    const f = reliefFacts(ramirez, NOW).find((x) => x.id === 'careFera')!;
    expect(f).toMatchObject({ likelihood: 'likely', valuePerYear: 220 });
    expect(f.facts.program).toBe('FERA');
    const low = reliefFacts({ ...ramirez, income: 40000 }, NOW).find((x) => x.id === 'careFera')!;
    expect(low.facts.program).toBe('CARE');
    const high = reliefFacts({ ...ramirez, income: 150000 }, NOW).find((x) => x.id === 'careFera')!;
    expect(high.likelihood).toBe('unlikely');
  });
  it('worth sums what is not done yet, never NaN', () => {
    const items = fallbackRelief(ramirez, 'en', NOW);
    expect(reliefWorth(items, [])).toBe(EXEMPTION_VALUE + 220 + 71);
    expect(reliefWorth(items, ['exemption'])).toBe(220 + 71);
    expect(finite(reliefFacts(EMPTY_KEEP, NOW).map((x) => x.valuePerYear ?? 0))).toBe(true);
  });
  it("Claude's sentences replace the rules' only for the ids it returned", () => {
    const base = fallbackRelief(ramirez, 'es', NOW);
    const merged = mergeRelief(base, { items: [{ id: 'oc211', why: 'a', worth: 'b', nextStep: 'c' }] });
    expect(merged.find((x) => x.id === 'oc211')!.why).toBe('a');
    expect(merged.find((x) => x.id === 'exemption')!.why).toBe(base[0].why);
  });
});

describe('monthly check-in', () => {
  it('a new premium raises escrow and the peak month, and says so', () => {
    const patch = applyAnswer(ramirez, { q: 'bills', kind: 'premium', amount: 1980 });
    expect(patch.premium).toBe(1980);
    expect(patch.escrow).toBe(Math.round((3816 + 1980) / 12));
    const before = snapshot(ramirez, '2026-11');
    const after = snapshot({ ...ramirez, ...patch }, '2026-11');
    expect(after.peak).toBeGreaterThan(before.peak);
    expect(changeSentence('bills', before, after, 'en')).toMatch(/^Your highest month is now \$[\d,]+, in [A-Z][a-z]+ \d{4}: \$\d+ more than before\.$/);
  });
  it('an income change rewrites take-home; something breaking flags the system due within a year', () => {
    expect(applyAnswer(ramirez, { q: 'income', takeHome: 4000 })).toMatchObject({ takeHome: 4000, income: 60000 });
    const sys = applyAnswer(ramirez, { q: 'breaking', kind: 'water_heater' }).systems!;
    const wh = sys.find((s) => s.kind === 'water_heater')!;
    expect(wh.lifeYears - wh.ageYears).toBe(1);
    const added = applyAnswer(ramirez, { q: 'breaking', kind: 'hvac' }).systems!;
    expect(added).toHaveLength(3);
  });
  it('the Spanish sentence has no English in it', () => {
    const before = snapshot(ramirez, '2026-11');
    const after = snapshot({ ...ramirez, takeHome: 4000 }, '2026-11');
    expect(changeSentence('income', before, after, 'es')).toMatch(/^En su mes más apretado|^Su mes más apretado/);
  });
  it('zero profile: snapshot is finite', () => {
    expect(finite(snapshot(EMPTY_KEEP))).toBe(true);
  });
});

describe('schemas and the Ready bridge', () => {
  it('the Keep profile schema fills gaps and clamps', () => {
    const p = KeepProfileSchema.parse({ mortgage: -5, householdSize: 99, systems: 'nope' });
    expect(p.mortgage).toBe(0);
    expect(p.householdSize).toBe(12);
    expect(p.systems).toEqual([]);
    expect(p.renewalMonth).toBe(EMPTY_KEEP.renewalMonth);
  });
  it('first year of owning = mortgage + escrow + set-aside', () => {
    const profile: Profile = {
      householdSize: 4, inOC: true, residentOrCitizen: true, grossMonthlyIncome: 5200, otherMonthlyIncome: 0, rent: 2350, bedrooms: 1, occupants: 4, unsafeConditions: false,
      debts: [], savings: 3100, creditBand: 'building', levers: { extraDebt: 0, monthlySavings: 150, coApplicantIncome: 0 },
    } as Profile;
    const fy = firstYearOwning(profile);
    expect(fy.monthly).toBe(fy.mortgage + fy.escrow + fy.setAside);
    expect(fy.mortgage).toBe(1560);
  });
});
