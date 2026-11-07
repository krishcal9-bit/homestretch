import { describe, expect, it } from 'vitest';
import {
  byRisk,
  digestChanges,
  digestTemplate,
  draftOk,
  findHomeowner,
  homeHealth,
  homeownerOutreachTemplate,
  homeownerRows,
  outreachFacts,
  riskCounts,
  shieldMoves,
  stressHeadline,
  stressHomes,
  wordCount,
} from '@/lib/earlyWarning';
import { RISK_ORDER, stressTest, thisMonth } from '@/lib/forecast';

const TODAY = new Date('2026-11-07T12:00:00');
const rows = homeownerRows(TODAY);

describe('early warning', () => {
  it('assesses all 40 homeowners, sorted by risk then the thinnest cushion', () => {
    expect(rows).toHaveLength(40);
    const c = riskCounts(rows);
    expect(c.act + c.watch + c.stable).toBe(40);
    expect(c.act).toBeGreaterThan(0);
    for (let i = 1; i < rows.length; i++) expect(byRisk(rows[i - 1], rows[i])).toBeLessThanOrEqual(0);
    expect(RISK_ORDER[rows[0].risk.level]).toBe(2);
    for (const r of rows) {
      expect(Number.isFinite(r.risk.now)).toBe(true);
      expect(Number.isFinite(r.risk.in6)).toBe(true);
      expect(Number.isFinite(r.low6)).toBe(true);
    }
  });

  it('derives Shock Shield moves from the profile, marking what the family has done', () => {
    const ram = findHomeowner('ho01', TODAY)!;
    const moves = shieldMoves(ram);
    expect(moves.map((m) => m.key)).toEqual(['shop', 'exemption', 'careFera', 'setAside', 'talk']);
    expect(moves.find((m) => m.key === 'shop')!.title).toMatch(/FAIR Plan/);
    const nguyen = findHomeowner('ho02', TODAY)!; // seeded with the set-aside done
    expect(shieldMoves(nguyen).find((m) => m.key === 'setAside')?.done ?? true).toBe(true);
  });

  it('flags systems due soon in Home Health', () => {
    const okafor = findHomeowner('ho03', TODAY)!; // a 13-year-old water heater
    const h = homeHealth(okafor.profile.systems);
    expect(h[0].dueSoon).toBe(true);
    expect(h[0].label).toBe('Water heater');
  });

  it('writes a Spanish note under 120 words with an English translation (rules fallback)', () => {
    const ram = findHomeowner('ho01', TODAY)!;
    const facts = outreachFacts(ram);
    const d = homeownerOutreachTemplate(facts);
    expect(facts.lang).toBe('es');
    expect(d.body).toMatch(/Ramirez/);
    expect(d.body).toMatch(/Hola/);
    expect(wordCount(d.body)).toBeLessThan(120);
    expect(d.translation).toMatch(/Ramirez/);
    expect(draftOk(d, facts)).toBe(true);
    expect(draftOk({ ...d, body: 'Hola' }, facts)).toBe(false);
  });

  it('finds this week’s changes deterministically, with Spanish drafts for Spanish households', () => {
    const changed = rows.map((r) => ({ r, ch: digestChanges(r, TODAY) })).filter((x) => x.ch.length);
    expect(changed.length).toBeGreaterThan(3);
    expect(changed.some((x) => x.ch.some((c) => c.kind === 'breathing'))).toBe(true);
    expect(changed.some((x) => x.ch.some((c) => c.kind === 'checkin'))).toBe(true);
    const es = changed.find((x) => x.r.language === 'es')!;
    expect(digestTemplate(es.r, es.ch).draft.es).toMatch(/Hola/);
    // the same run twice gives the same digest
    expect(rows.map((r) => digestChanges(r, TODAY).length)).toEqual(homeownerRows(TODAY).map((r) => digestChanges(r, TODAY).length));
  });

  it('computes the funder headline from the stress test', () => {
    const homes = stressHomes(TODAY);
    const opts = { start: thisMonth(TODAY), today: TODAY };
    const c = { insuranceIncrease: 0.29, supplemental: false, hardshipFund: 0, matchedRepair: 150 };
    const r = stressTest(homes, c, opts);
    const h = stressHeadline(c, r, homes.length);
    expect(h.shock).toBe(`A 29% insurance jump puts ${r.atRiskBefore} of 40 homeowners at risk.`);
    expect(h.support).toMatch(new RegExp(`brings that to ${r.atRiskAfter}, protecting about \\$[\\d,]+00 a year`));
    expect(r.atRiskAfter).toBeLessThan(r.atRiskBefore);
    const none = stressHeadline({ ...c, matchedRepair: 0 }, stressTest(homes, { ...c, matchedRepair: 0 }, opts), 40);
    expect(none.support).toMatch(/Add a hardship fund/);
  });
});
