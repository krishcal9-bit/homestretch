// Pure staff-console logic shared by server pages, client components and API routes.
import type { Stage } from './engine';
import { homeFits } from './homes';
import type { Tier } from './incomeTiers';
import { monthName } from './format';
import type { Home } from './types';
import type { FamilyRow } from './staffData';

export const TIER_LABEL: Record<Tier, string> = {
  very_low: 'Very low',
  low: 'Low',
  moderate: 'Moderate',
  below: 'Below minimum',
  above: 'Above limit',
};

export const STAGES: { key: Stage; label: string }[] = [
  { key: 'ready_now', label: 'Ready now' },
  { key: 'le6', label: 'Ready in ≤ 6 months' },
  { key: 'six_18', label: 'Ready in 6–18 months' },
  { key: 'gt18', label: '18+ months' },
  { key: 'not_eligible', label: 'Not eligible' },
];

type Fam = Pick<FamilyRow, 'eligible' | 'householdSize' | 'result' | 'stage'>;

/** Eligible families whose household fits the home: projected ready by completion, and ready now. */
export function homeCounts(home: Home, families: Fam[]) {
  const fits = families.filter((f) => f.eligible && homeFits(f.householdSize, home.bedrooms));
  const projected = fits.filter((f) => f.result.readyDate <= home.completion).length;
  const readyNow = fits.filter((f) => f.stage === 'ready_now').length;
  return { projected, readyNow, fitting: fits.length };
}

export const homeTitle = (h: Home) => `${h.city} ${h.bedrooms}BR`;

export function homeInsight(home: Home, families: Fam[]): string {
  const { projected, readyNow } = homeCounts(home, families);
  const fam = (n: number) => `${n} ${n === 1 ? 'family' : 'families'}`;
  return `${homeTitle(home)}, done ${monthName(home.completion)}: ${fam(projected)} projected ready, ${readyNow} ready now.`;
}

const TIER_RANK: Record<Tier, number> = { very_low: 0, low: 1, moderate: 2, below: 3, above: 4 };

export type Candidate<F extends FamilyRow = FamilyRow> = {
  family: F;
  fitScore: number;
  readyByCompletion: boolean;
  monthsSpare: number; // months between ready date and completion (negative = late)
};

const monthIndex = (iso: string) => {
  const [y, m] = iso.split('-').map(Number);
  return y * 12 + (m - 1);
};

/**
 * Rank families for one home. Only eligible families whose size fits the bedrooms are candidates.
 * Readiness by the completion date matters most, then how well the size uses the bedrooms, then
 * tier (lower income first, since Habitat serves the greatest need), then the earliest ready date.
 */
export function rankForHome<F extends FamilyRow>(home: Home, families: F[]): Candidate<F>[] {
  return families
    .filter((f) => f.eligible && homeFits(f.householdSize, home.bedrooms))
    .map((f) => {
      const monthsSpare = monthIndex(home.completion) - monthIndex(f.result.readyDate);
      const ready = monthsSpare >= 0;
      const ideal = Math.ceil(f.householdSize / 2);
      const sizeFit = 1 - Math.min(1, Math.abs(home.bedrooms - ideal) / 2);
      const lateness = ready ? 0 : Math.min(1, -monthsSpare / 24);
      const fitScore = Math.round(100 * (0.55 * (ready ? 1 : 0.5 - 0.5 * lateness) + 0.3 * sizeFit + 0.15 * (1 - TIER_RANK[f.result.tier] / 4)));
      return { family: f, fitScore, readyByCompletion: ready, monthsSpare };
    })
    .sort((a, b) => b.fitScore - a.fitScore || a.family.result.monthsToReady - b.family.result.monthsToReady);
}

/** Rules sentence used when Claude is unavailable. */
export function rulesReason(c: Candidate, home: Home): string {
  const f = c.family;
  const size = `${f.householdSize}-person household fits ${home.bedrooms} bedrooms`;
  if (f.result.monthsToReady === 0) return `${size}, and they are ready now with time to spare before ${monthName(home.completion)}.`;
  if (c.readyByCompletion) return `${size}, projected ready ${monthName(f.result.readyDate)}, ${c.monthsSpare} months before completion.`;
  const blocker = f.result.blockers[0]?.text.replace(/\.$/, '').toLowerCase() ?? 'more time';
  return `${size}, but projected ready ${monthName(f.result.readyDate)}, after completion; first needs ${blocker}.`;
}
