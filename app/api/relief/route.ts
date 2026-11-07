// KEEP · Relief Finder: the five programs, personalized. The rules (lib/relief.ts) decide who likely qualifies and
// what it's worth; Claude rewrites "why", "worth" and "next step" for this family. Any sentence carrying a dollar
// amount the rules didn't give is replaced by the rules' sentence (Claude never produces numbers).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody } from '@/lib/api';
import { claudeJson } from '@/lib/claude';
import { KeepProfileSchema, LangSchema } from '@/lib/keepSchema';
import { EXEMPTION_OFF, fallbackRelief, mergeRelief, RELIEF_SYSTEM, ReliefTextSchema, type ReliefItem, type ReliefText } from '@/lib/relief';

export const maxDuration = 30;

const Body = z.object({ profile: KeepProfileSchema, lang: LangSchema, reliefDone: z.array(z.string().max(40)).max(20).optional() });

const dollars = (s: string) => [...s.matchAll(/\$\s?([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, '')));

/** Drop any sentence whose dollar amounts aren't among the item's own numbers. */
function guard(base: ReliefItem[], text: ReliefText): ReliefText {
  return {
    items: text.items.filter((t) => {
      const b = base.find((x) => x.id === t.id);
      if (!b) return false;
      const allowed = new Set<number>([EXEMPTION_OFF, Math.round(b.valuePerYear ?? 0), ...Object.values(b.facts).filter((v): v is number => typeof v === 'number').map(Math.round)]);
      return [t.why, t.worth, t.nextStep].every((s) => dollars(s).every((n) => allowed.has(n)));
    }),
  };
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, Body);
  if ('error' in parsed) return parsed.error;
  const { profile, lang } = parsed.data;
  const base = fallbackRelief(profile, lang);
  const facts = base.map(({ id, name, likelihood, valuePerYear, facts }) => ({ id, name, likelihood, valuePerYear, facts }));
  const out = await claudeJson<ReliefText>({
    purpose: 'relief',
    system: RELIEF_SYSTEM,
    content: JSON.stringify({ language: lang === 'es' ? 'Spanish' : 'English', household: { size: profile.householdSize, homeType: profile.homeType, zip: profile.zip, insurer: profile.insurer, fairPlan: profile.fairPlan }, programs: facts }),
    schema: ReliefTextSchema,
    fallback: () => ({ items: [] }),
    fixture: lang === 'es' ? 'relief-es' : 'relief',
    maxTokens: 1400,
  });
  const items = mergeRelief(base, guard(base, out.data));
  return NextResponse.json({ items, source: out.source });
}
