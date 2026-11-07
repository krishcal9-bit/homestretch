import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, parseBody } from '@/lib/api';
import { claudeJson } from '@/lib/claude';
import { LangSchema } from '@/lib/schemas';
import { KeepProfileSchema, MonthSchema, ShieldSchema } from '@/lib/keepSchemas';
import { shieldFacts, shieldRules, type Move } from '@/lib/shield';
import { money, monthName } from '@/lib/format';
import type { KeepProfile } from '@/lib/keep';

export const maxDuration = 30;

const Body = z.object({
  lang: LangSchema,
  profile: KeepProfileSchema,
  shockIndex: z.number().int().min(0).max(30),
  start: MonthSchema,
  family: z.string().max(60).optional(),
});

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (all, k: string) => v[k] ?? all);
const numbers = (s: string) => (s.match(/\d[\d.,]*\d|\d/g) ?? []).map((n) => Number(n.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.')));

/**
 * The Shock Shield for one upcoming shock: up to four ranked moves. The engine computes every move and its effect
 * (lib/shield.ts); Claude may reword and re-rank them for this family, in their language. Effects, resources and the
 * set of moves always come from the rules; a reply that cites a number the rules don't contain is not used.
 */
export async function POST(req: Request) {
  const parsed = await parseBody(req, Body);
  if ('error' in parsed) return parsed.error;
  const { lang, shockIndex, start, family } = parsed.data;
  const profile = parsed.data.profile as KeepProfile;
  const facts = shieldFacts(profile, shockIndex, start);
  if (!facts) return apiError('no_shock', lang === 'es' ? 'No hay un aumento próximo que cubrir.' : 'There is no upcoming rise to plan for.', 404);
  const rules = shieldRules(profile, shockIndex, lang, { start, family });
  const byKey = new Map(rules.map((m) => [m.key, m]));
  const vars: Record<string, string> = {
    setAside: money(facts.setAside, lang),
    month: monthName(facts.shock.month, lang),
    rise: money(facts.shock.delta, lang),
    saves: money(facts.deductibleSaves, lang),
    premium: money(facts.newPremium, lang),
    claimDetail: byKey.get('claim')?.detail ?? '',
    habitatMessage: byKey.get('habitat')?.message ?? '',
  };
  // numbers a reply may cite: anything the rules wrote, plus the facts
  const allowed = new Set<number>([...rules.flatMap((m) => numbers(`${m.title} ${m.detail} ${m.message ?? ''}`)), ...Object.values(vars).flatMap(numbers), 5]);

  const out = await claudeJson({
    purpose: 'keep/shield',
    system: `You help a Habitat for Humanity homeowner family in Orange County, California get ready for a rise in their monthly housing payment.
You are given moves computed by a deterministic engine. Reword each move for this family in plain, warm ${lang === 'es' ? 'Spanish (usted)' : 'English'} (sentence case, short, verbs that say what happens) and rank them by what helps most.
Hard rules: keep the same "key" values (use only keys given), copy every dollar amount and date exactly as given, add no new numbers, keep "monthlyEffect" and "effort" as given, keep "message" for the habitat move (you may smooth its wording). At most 4 moves.
Return ONLY JSON: {"moves": [{"key", "title", "detail", "monthlyEffect", "effort", "message"?}]}`,
    content: JSON.stringify({ shock: { month: vars.month, rise: vars.rise, cause: facts.shock.cause }, moves: rules.map((m) => ({ key: m.key, title: m.title, detail: m.detail, monthlyEffect: m.monthlyEffect, effort: m.effort, message: m.message })) }),
    schema: ShieldSchema,
    fallback: () => ({ moves: rules }),
    fixture: lang === 'es' ? 'shield-es' : 'shield',
    maxTokens: 1400,
  });

  const seen = new Set<string>();
  const moves: Move[] = [];
  for (const m of out.data.moves) {
    const rule = byKey.get(m.key);
    if (!rule || seen.has(m.key)) continue;
    seen.add(m.key);
    const title = fill(m.title, vars);
    const detail = fill(m.detail, vars);
    const message = m.key === 'habitat' ? fill(m.message ?? rule.message ?? '', vars) : undefined;
    const text = `${title} ${detail} ${message ?? ''}`;
    const ok = !/\{\w+\}/.test(text) && numbers(text).every((n) => allowed.has(n));
    // the engine's effect, resource and (for Habitat) a message always win
    moves.push(ok ? { ...rule, title, detail, effort: m.effort, ...(message ? { message } : {}) } : rule);
  }
  for (const r of rules) if (moves.length < 4 && !seen.has(r.key)) moves.push(r);
  return NextResponse.json({ moves, source: out.source, shock: facts.shock, setAside: facts.setAside });
}
