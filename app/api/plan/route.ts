import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { parseBody } from '@/lib/api';
import { claudeJson } from '@/lib/claude';
import { computeReadiness, sanitize } from '@/lib/engine';
import { fallbackPlan, fallbackUnderwriter, PLAN_SYSTEM, PlanOutputSchema, type PlanOutput } from '@/lib/plan';
import { LangSchema, ProfileSchema } from '@/lib/schemas';
import { prisma } from '@/lib/db';
import type { Profile } from '@/lib/types';

const Body = z.object({ profile: ProfileSchema, lang: LangSchema, regenerate: z.boolean().optional() });

/** Cache key: the profile (levers included: the plan is written for that plan) + language. */
const planKey = (p: Profile, lang: string) =>
  crypto.createHash('sha256').update(JSON.stringify({ p: sanitize(p), lang })).digest('hex').slice(0, 32);

export async function POST(req: Request) {
  const parsed = await parseBody(req, Body);
  if ('error' in parsed) return parsed.error;
  const { profile, lang, regenerate } = parsed.data;
  const result = computeReadiness(profile);
  const key = planKey(profile, lang);

  if (!regenerate) {
    try {
      const hit = await prisma.planCache.findUnique({ where: { key } });
      if (hit) return NextResponse.json({ plan: JSON.parse(hit.json) as PlanOutput, result, source: 'cache' });
    } catch {}
  }

  const facts = {
    language: lang === 'es' ? 'Spanish' : 'English',
    household: { size: profile.householdSize, livesOrWorksInOC: profile.inOC, citizenOrResident: profile.residentOrCitizen },
    monthlyIncome: profile.grossMonthlyIncome + profile.otherMonthlyIncome + profile.levers.coApplicantIncome,
    rent: profile.rent,
    debts: profile.debts,
    savings: profile.savings,
    creditBand: profile.creditBand,
    levers: profile.levers,
    statementFindings: profile.statement ?? null,
    engine: {
      tier: result.tier,
      eligible: result.eligible,
      costBurdenPct: Math.round(result.costBurden * 100),
      overcrowded: result.overcrowded,
      maxPayment: Math.round(result.maxPayment),
      downPaymentAndClosingTarget: result.downPaymentTarget,
      monthsToReady: result.monthsToReady,
      readyDate: result.readyDate,
      milestones: result.milestones.map((m) => ({ key: m.key, month: m.month })),
      blockers: result.blockers.map((b) => b.text),
      debtsClearedMonth: result.debtClearMonth,
      monthlyFreedIntoSavingsAfterDebts: Math.round(result.freedPayments),
    },
  };
  const out = await claudeJson({
    purpose: 'plan',
    system: PLAN_SYSTEM,
    content: `Write the 90-day plan for this family in ${facts.language}.\n\n${JSON.stringify(facts, null, 2)}`,
    schema: PlanOutputSchema,
    fallback: () => fallbackPlan(profile, result, lang),
    maxTokens: 4000,
  });
  // Underwriter's eye is only for families who uploaded a statement; make sure it's there when it should be.
  if (profile.statement && !out.data.underwritersEye?.length) out.data.underwritersEye = fallbackUnderwriter(profile, lang);
  if (!profile.statement) out.data.underwritersEye = null;
  if (out.source === 'claude') {
    try {
      await prisma.planCache.upsert({ where: { key }, create: { key, json: JSON.stringify(out.data) }, update: { json: JSON.stringify(out.data) } });
    } catch {}
  }
  return NextResponse.json({ plan: out.data, result, source: out.source });
}
