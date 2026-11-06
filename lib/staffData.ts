// Server-side loaders for the staff console. Readiness always comes from lib/engine.ts.
import { prisma } from './db';
import { computeReadiness, isEligible, stageOf, type Stage } from './engine';
import { SEED_HOMES } from './seedData';
import type { Home, Lang, Profile, ReadinessResult } from './types';

export type FamilyRow = {
  code: string;
  surname: string;
  givenName: string;
  city: string;
  language: Lang;
  householdSize: number;
  stage: Stage;
  eligible: boolean;
  result: ReadinessResult;
  profile: Profile;
  blockerType: string | null;
  lastActivity: string; // ISO
  checklistDone: number;
  checklistTotal: number | null;
};

export const BLOCKER_LABEL: Record<string, string> = {
  collections: 'Collections',
  credit: 'Credit',
  credit_unknown: 'Credit unknown',
  savings: 'Savings',
  dti: 'Debt load',
  income_high: 'Income above limit',
  income_low: 'Income below minimum',
  residency: 'Residency',
  need: 'Housing need',
};

function countTotal(planJson: string | null): number | null {
  if (!planJson) return null;
  try {
    const p = JSON.parse(planJson);
    for (const k of ['actions', 'checklist', 'steps', 'days90']) if (Array.isArray(p?.[k])) return p[k].length;
  } catch {}
  return null;
}

export async function loadFamilies(): Promise<FamilyRow[]> {
  let plans: Awaited<ReturnType<typeof prisma.plan.findMany>> = [];
  try {
    plans = await prisma.plan.findMany({ where: { sharedWithStaff: true }, orderBy: { surname: 'asc' } });
  } catch (e) {
    console.warn('[staff] could not load plans', (e as Error).message);
  }
  const rows: FamilyRow[] = [];
  for (const p of plans) {
    let profile: Profile;
    try {
      profile = JSON.parse(p.profileJson) as Profile;
    } catch {
      continue;
    }
    const result = computeReadiness(profile);
    let checklist: Record<string, boolean> = {};
    try {
      checklist = JSON.parse(p.checklistJson || '{}');
    } catch {}
    const top = result.blockers[0];
    rows.push({
      code: p.code,
      surname: p.surname ?? 'Family',
      givenName: p.givenName ?? '',
      city: p.city ?? '',
      language: p.language === 'es' ? 'es' : 'en',
      householdSize: profile.householdSize,
      stage: stageOf(result),
      eligible: isEligible(result),
      result,
      profile,
      blockerType: top ? (BLOCKER_LABEL[top.key] ?? top.key) : null,
      lastActivity: p.lastActivity.toISOString(),
      checklistDone: Object.values(checklist).filter(Boolean).length,
      checklistTotal: countTotal(p.planJson),
    });
  }
  return rows;
}

export async function loadHomes(): Promise<Home[]> {
  try {
    const homes = await prisma.home.findMany({ orderBy: { completion: 'asc' } });
    return homes.length ? homes : SEED_HOMES;
  } catch {
    return SEED_HOMES;
  }
}
