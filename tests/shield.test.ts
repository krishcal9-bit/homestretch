import { describe, expect, it } from 'vitest';
import { forecast } from '@/lib/forecast';
import { EMPTY_KEEP } from '@/lib/keep';
import { demoFamily } from '@/lib/seedHomeowners';
import { applyMoves, explainTemplate, numbersAreFacts, setAsideFor, shieldFacts, shieldRules, wordCount, EXEMPTION_TAX } from '@/lib/shield';
import { docFacts, docToPatch } from '@/lib/keepDocs';
import type { DocumentExtract } from '@/lib/keepSchemas';

const START = '2026-11';
const NOW = new Date('2026-11-07T12:00:00Z');
const ramirez = demoFamily(NOW).profile;

describe('Shock Shield rules', () => {
  it('the demo family sees a March 2027 insurance shock of +$69/month', () => {
    const f = forecast(ramirez, { start: START });
    expect(f.first).toMatchObject({ month: '2027-03', delta: 69, cause: 'insurance', premiumChange: 412 });
  });

  it('produces at most four moves, ranked, Habitat last, every effect from the engine', () => {
    const moves = shieldRules(ramirez, 4, 'en', { start: START, family: 'Ramirez' });
    expect(moves.length).toBeLessThanOrEqual(4);
    expect(moves.at(-1)!.key).toBe('habitat');
    const effects = moves.slice(0, -1).map((m) => m.monthlyEffect);
    expect(effects).toEqual([...effects].sort((a, b) => b - a));
    const facts = shieldFacts(ramirez, 4, START)!;
    for (const m of moves) expect(m.monthlyEffect).toBe(facts.effects[m.key]);
    expect(facts.setAside).toBe(forecast(ramirez, { start: START }).recommendedSetAside);
    expect(moves.find((m) => m.key === 'setAside')!.title).toContain(`$${facts.setAside}`);
    expect(moves.at(-1)!.message).toContain('the Ramirez family');
    expect(moves.at(-1)!.message).toContain('$69');
  });

  it('the set-aside for a later shock keeps every rise through 24 months under $5', () => {
    const x = setAsideFor(ramirez, 16, START);
    const jump = (v: number) => {
      const ms = forecast(ramirez, { start: START, setAside: v }).months;
      return Math.max(...ms.slice(1).map((m, k) => m.effective - ms[k].effective));
    };
    expect(jump(x)).toBeLessThanOrEqual(5);
    expect(jump(x - 1)).toBeGreaterThan(5);
    expect(x).toBeGreaterThan(setAsideFor(ramirez, 4, START));
  });

  it('applying moves maps onto engine inputs and softens the shock', () => {
    const both = applyMoves(ramirez, ['insurance', 'claim']);
    expect(both.premium).toBe(Math.round(ramirez.premium * 0.9));
    expect(both.propertyTax).toBe(ramirez.propertyTax - EXEMPTION_TAX);
    expect(ramirez.premium).toBe(1416); // never mutates
    const before = forecast(ramirez, { start: START }).first!.delta;
    const after = forecast(both, { start: START }).first!.delta;
    expect(after).toBeLessThan(before);
  });

  it('works with all-zero inputs: no moves, no NaN', () => {
    expect(shieldFacts(EMPTY_KEEP, 0, START)).toBeNull();
    expect(shieldRules(EMPTY_KEEP, 0, 'es', { start: START })).toEqual([]);
    const f = forecast(EMPTY_KEEP, { start: START });
    for (const m of f.months) expect(Number.isFinite(m.breathing)).toBe(true);
  });

  it('writes Spanish moves in Spanish', () => {
    const moves = shieldRules(ramirez, 4, 'es', { start: START, family: 'Ramirez' });
    expect(moves.find((m) => m.key === 'setAside')!.title).toMatch(/^Aparte/);
    expect(moves.at(-1)!.message).toMatch(/^Hola/);
  });
});

describe('documents', () => {
  const notice: DocumentExtract = {
    documentType: 'insurance_renewal',
    insurer: 'California FAIR Plan Association',
    fairPlan: true,
    currentPremium: 1416,
    renewalPremium: 1828,
    effectiveDate: '2027-03-01',
    currentEscrow: null,
    newEscrow: null,
    escrowShortage: null,
    mortgagePrincipal: null,
    propertyTaxAnnual: null,
    hoaCurrent: null,
    hoaNew: null,
  };

  it('a renewal notice fills premium, renewal month and the exact increase', () => {
    const p = docToPatch(notice);
    expect(p).toMatchObject({ insurer: 'California FAIR Plan', fairPlan: true, premium: 1416, renewalMonth: 3 });
    expect(1416 * (1 + p.insuranceIncrease!)).toBeCloseTo(1828, 0);
  });

  it('the explanation uses only the document and engine numbers', () => {
    const profile = { ...ramirez, ...docToPatch(notice) };
    const facts = docFacts(notice, profile, START)!;
    expect(facts).toMatchObject({ premiumOld: 1416, premiumNew: 1828, monthlyChange: 69, month: '2027-03' });
    const en = explainTemplate('en', facts);
    expect(en).toBe("Your insurance is going up $412 a year, from $1,416 to $1,828. That's why your payment goes up about $69 a month in March.");
    expect(wordCount(en)).toBeLessThan(80);
    expect(numbersAreFacts(en, 'en', facts)).toBe(true);
    expect(numbersAreFacts('Your insurance is going up $500 a year.', 'en', facts)).toBe(false);
    expect(explainTemplate('es', facts)).toMatch(/^Su seguro sube \$412 al año.*marzo\.$/);
  });
});
