import { describe, expect, it } from 'vitest';
import { INCOME_TIERS, tierFor } from '@/lib/incomeTiers';

describe('income tiers', () => {
  it('uses the published 4-person row', () => {
    expect(INCOME_TIERS[4].veryLow).toEqual([55850, 93050]);
  });
  it('places boundaries in the higher tier', () => {
    expect(tierFor(1, 39099)).toBe('below');
    expect(tierFor(1, 39100)).toBe('very_low');
    expect(tierFor(1, 65150)).toBe('low');
    expect(tierFor(1, 104200)).toBe('moderate');
    expect(tierFor(1, 116400)).toBe('moderate');
    expect(tierFor(1, 116401)).toBe('above');
  });
  it('estimates sizes 5–8 increasing with household size', () => {
    for (let s = 5; s <= 8; s++) expect(INCOME_TIERS[s].moderate[1]).toBeGreaterThan(INCOME_TIERS[s - 1].moderate[1]);
  });
});
