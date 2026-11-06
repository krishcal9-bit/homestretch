import { prisma } from './db';
import { computeReadiness } from './engine';
import { fallbackPlan, type PlanOutput } from './plan';
import type { Lang, Profile } from './types';

/** Loads a saved plan by code with its readiness and a plan (stored, or rules-based). */
export async function loadPlanRecord(code: string, lang?: Lang) {
  const row = await prisma.plan.findUnique({ where: { code: code.toUpperCase() } }).catch(() => null);
  if (!row) return null;
  const profile = JSON.parse(row.profileJson) as Profile;
  const language: Lang = lang ?? (row.language === 'es' ? 'es' : 'en');
  const result = computeReadiness(profile);
  const stored = row.planJson ? (JSON.parse(row.planJson) as PlanOutput) : null;
  // A stored plan is in the language it was written in; regenerate the rules plan for another language.
  const plan = stored && row.language === language ? stored : fallbackPlan(profile, result, language);
  return { code: row.code, profile, result, plan, lang: language, checklist: JSON.parse(row.checklistJson) as Record<string, boolean>, createdAt: row.createdAt };
}
