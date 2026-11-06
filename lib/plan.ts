import { z } from 'zod';
import { translate } from './i18n-core';
import { money } from './format';
import { whyThisDate } from './explain';
import type { Lang, Profile, ReadinessResult } from './types';

export const RESOURCES = {
  sparkpoint: { name: 'SparkPoint OC', url: 'https://www.unitedwayoc.org/sparkpoint-oc/' },
  hope: { name: 'Operation HOPE', url: 'https://operationhope.org/' },
  orientation: { name: 'Habitat OC orientation', url: 'https://www.habitatoc.org/homeownership' },
  creditReport: { name: 'annualcreditreport.com', url: 'https://www.annualcreditreport.com' },
};

export const PlanActionSchema = z.object({
  title: z.string().min(1).max(140),
  detail: z.string().max(400),
  owner: z.enum(['you', 'habitat', 'counselor']),
  byMonth: z.number().min(0).max(120),
  resource: z.object({ name: z.string(), url: z.string() }).optional().nullable(),
});
export const PlanOutputSchema = z.object({
  whyThisDate: z.array(z.string()).max(6),
  actions: z.array(PlanActionSchema).min(1).max(6),
  underwritersEye: z.array(z.object({ finding: z.string(), whatToDo: z.string(), kind: z.enum(['overdraft', 'cash_deposit', 'unlisted_loan', 'other']).optional() })).optional().nullable(),
});
export type PlanOutput = z.infer<typeof PlanOutputSchema>;
export type PlanAction = z.infer<typeof PlanActionSchema>;

/** Rules-based plan so the demo never breaks (no network, bad JSON, timeouts). */
export function fallbackPlan(p: Profile, r: ReadinessResult, lang: Lang): PlanOutput {
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, `planFallback.${k}`, v);
  const actions: PlanAction[] = [];
  const collections = p.debts.filter((d) => d.kind === 'collection').reduce((s, d) => s + d.balance, 0);
  if (p.creditBand === 'unknown') actions.push({ title: t('pullReport'), detail: t('pullReportDetail'), owner: 'you', byMonth: 0, resource: RESOURCES.creditReport });
  if (collections > 0)
    actions.push({ title: t('callCollector', { amount: money(collections, lang) }), detail: t('callCollectorDetail'), owner: 'you', byMonth: 1, resource: null });
  if (p.creditBand !== 'good' || collections > 0)
    actions.push({ title: t('counseling'), detail: t('counselingDetail'), owner: 'counselor', byMonth: 1, resource: RESOURCES.sparkpoint });
  if (p.levers.monthlySavings > 0 || r.downPaymentTarget > p.savings)
    actions.push({ title: t('autoSave', { amount: money(Math.max(p.levers.monthlySavings, 50), lang) }), detail: t('autoSaveDetail', { target: money(r.downPaymentTarget, lang) }), owner: 'you', byMonth: 0, resource: null });
  actions.push({ title: t('orientation'), detail: t('orientationDetail'), owner: 'habitat', byMonth: Math.min(3, Math.max(0, r.monthsToReady - 2)), resource: RESOURCES.orientation });
  actions.push({ title: t('documents'), detail: t('documentsDetail'), owner: 'you', byMonth: 2, resource: null });
  const underwritersEye = p.statement ? fallbackUnderwriter(p, lang) : null;
  return { whyThisDate: whyThisDate(p, r, lang), actions: actions.slice(0, 6), underwritersEye };
}

export function fallbackUnderwriter(p: Profile, lang: Lang): PlanOutput['underwritersEye'] {
  const s = p.statement;
  if (!s) return null;
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, `planFallback.${k}`, v);
  const out: NonNullable<PlanOutput['underwritersEye']> = [];
  if (s.overdraftOrNsfCount > 0) out.push({ kind: 'overdraft', finding: t('ueOverdraft', { n: s.overdraftOrNsfCount }), whatToDo: t('ueOverdraftDo') });
  for (const d of s.largeUnexplainedDeposits.slice(0, 2))
    out.push({ kind: 'cash_deposit', finding: t('ueDeposit', { amount: money(d.amount, lang), date: d.date }), whatToDo: t('ueDepositDo') });
  const listed = new Set(p.debts.map((d) => d.kind));
  for (const r of s.recurringDebts.filter((d) => d.kind && !listed.has(d.kind)).slice(0, 1))
    out.push({ kind: 'unlisted_loan', finding: t('ueLoan', { name: r.name, amount: money(r.amount, lang) }), whatToDo: t('ueLoanDo') });
  return out;
}

export const PLAN_SYSTEM = `You are a housing counselor for Habitat for Humanity of Orange County (Habitat OC), writing a family's 90-day plan toward an affordable Habitat mortgage.

Habitat OC rules: households need a housing need (rent over 30% of gross income, overcrowding of more than 2 people per bedroom, or unsafe conditions); steady income inside Habitat's very-low/low/moderate tier for their household size; US citizenship or permanent residency; living or working in Orange County; credit in good standing (about 640+ with no open collections); 1% down payment plus closing costs; sweat equity hours and an orientation before applying. Habitat homes carry a 0% interest, 30-year mortgage with payments at 30% of gross income.

Local resources you may cite (use these exact names and URLs only): SparkPoint OC (free credit and financial coaching) https://www.unitedwayoc.org/sparkpoint-oc/ ; Operation HOPE (credit and money coaching) https://operationhope.org/ ; Habitat OC homeownership orientation https://www.habitatoc.org/homeownership ; annualcreditreport.com https://www.annualcreditreport.com

The readiness engine has already computed every number. NEVER invent or change numbers: use only the figures given. Never mention a credit score unless one is given. Write warmly and plainly, at a 6th-grade reading level, in the requested language (Spanish uses "usted"). No emoji, no exclamation marks.

Return ONLY a JSON object, no prose, matching:
{"whyThisDate": string[3..5], "actions": [{"title": string, "detail": string, "owner": "you"|"habitat"|"counselor", "byMonth": number (months from today, 0-3 for a 90-day plan), "resource": {"name": string, "url": string} | null}] (max 6, ordered by when to do them), "underwritersEye": [{"finding": string, "whatToDo": string, "kind": "overdraft"|"cash_deposit"|"unlisted_loan"|"other"}] | null}
Keep it short: each whyThisDate item is one sentence under 30 words tied to a specific engine number (3-5 items); each action title is under 10 words and each detail is one sentence under 25 words. underwritersEye: only if bank statement findings are given; phrase kindly and specifically; otherwise null.`;
