// Habitat OC 2026 income tiers (habitatoc.org/review-qualifications).
// [min, max] annual gross income per tier, by household size.
export type TierRange = { veryLow: [number, number]; low: [number, number]; moderate: [number, number] };

const published: Record<number, TierRange> = {
  1: { veryLow: [39100, 65150], low: [65150, 104200], moderate: [104200, 116400] },
  2: { veryLow: [44700, 74450], low: [74450, 119100], moderate: [119100, 133050] },
  3: { veryLow: [50300, 83750], low: [83750, 134000], moderate: [134000, 149650] },
  4: { veryLow: [55850, 93050], low: [93050, 148850], moderate: [148850, 166300] },
};

// Sizes 5–8 are ESTIMATED: +7.5% per person compounded from the 4-person row.
// Habitat OC publishes these; replace with the official numbers before adoption.
function estimate(size: number): TierRange {
  const f = Math.pow(1.075, size - 4);
  const r = (n: number) => Math.round((n * f) / 50) * 50;
  const b = published[4];
  return {
    veryLow: [r(b.veryLow[0]), r(b.veryLow[1])],
    low: [r(b.low[0]), r(b.low[1])],
    moderate: [r(b.moderate[0]), r(b.moderate[1])],
  };
}

export const INCOME_TIERS: Record<number, TierRange> = {
  ...published,
  5: estimate(5),
  6: estimate(6),
  7: estimate(7),
  8: estimate(8),
};

export type Tier = 'very_low' | 'low' | 'moderate' | 'below' | 'above';

/** Tier lookup. Lower bound inclusive; a shared boundary goes to the higher tier. */
export function tierFor(householdSize: number, annualIncome: number): Tier {
  const size = Math.min(8, Math.max(1, Math.round(householdSize)));
  const t = INCOME_TIERS[size];
  if (annualIncome < t.veryLow[0]) return 'below';
  if (annualIncome < t.low[0]) return 'very_low';
  if (annualIncome < t.moderate[0]) return 'low';
  if (annualIncome <= t.moderate[1]) return 'moderate';
  return 'above';
}
