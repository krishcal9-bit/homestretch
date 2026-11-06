import { describe, expect, it } from 'vitest';
import { computeReadiness, isEligible, simulateProgram, stageOf } from '@/lib/engine';
import { fillPlaceholders, outreachTemplate, type OutreachInput } from '@/lib/outreach';
import { buildReferral } from '@/lib/referral';
import { SEED_FAMILIES, SEED_HOMES } from '@/lib/seedData';
import type { FamilyRow } from '@/lib/staffData';
import { homeCounts, rankForHome } from '@/lib/staffLogic';

const today = new Date(Date.UTC(2026, 10, 6));
const rows = SEED_FAMILIES.map((f) => {
  const result = computeReadiness(f.profile, { today });
  return { code: f.code, surname: f.surname, householdSize: f.profile.householdSize, result, eligible: isEligible(result), stage: stageOf(result) } as FamilyRow;
});

describe('staff logic', () => {
  it('at least one home has families projected ready', () => {
    expect(SEED_HOMES.some((h) => homeCounts(h, rows).projected > 0)).toBe(true);
  });
  it('ranks only eligible, fitting families', () => {
    const ranked = rankForHome(SEED_HOMES[0], rows);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((c) => c.family.eligible)).toBe(true);
  });
  it('outreach fixtures and template contain the surname', () => {
    const input: OutreachInput = {
      lang: 'es',
      home: { id: 'h1', address: 'x', city: 'Costa Mesa', bedrooms: 3, completion: '2027-03' },
      family: { surname: 'Ramírez', givenName: 'Lucía', householdSize: 4, readyDate: '2027-05', monthsToReady: 6, nextAction: 'Ahorre.' },
    };
    expect(fillPlaceholders('Hola {givenName}, familia {surname}', input)).toBe('Hola Lucía, familia Ramírez');
    expect(outreachTemplate(input).body).toContain('Ramírez');
    expect(outreachTemplate({ ...input, lang: 'en' }).body.split(/\s+/).length).toBeLessThan(120);
  });
  it('referral packet has three blockers at most and no NaN', () => {
    const p = buildReferral({ profile: SEED_FAMILIES[0].profile, org: 'sparkpoint', lang: 'es', today });
    expect(p.blockers.length).toBeLessThanOrEqual(3);
    expect(JSON.stringify(p)).not.toMatch(/NaN|undefined|Infinity/);
  });
  it('program simulator: 0 more with nothing on, > 0 with matched savings', () => {
    const profiles = SEED_FAMILIES.map((f) => f.profile);
    expect(simulateProgram(profiles, { matchedSavings: 0, counselingMonths: 0, grant: 0 }, 24, { today }).moreReadyBy(18)).toBe(0);
    expect(simulateProgram(profiles, { matchedSavings: 100, counselingMonths: 0, grant: 0 }, 24, { today }).moreReadyBy(18)).toBeGreaterThan(0);
  });
});
