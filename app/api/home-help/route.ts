// KEEP · "Something is breaking": safe first steps and how urgent it is. Claude tailors the steps to what the
// family wrote; the static checklist in lib/homeHealth.ts answers when Claude is unavailable.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody } from '@/lib/api';
import { claudeJson } from '@/lib/claude';
import { fallbackHelp, HELP_SYSTEM, HelpSchema } from '@/lib/homeHealth';
import { LangSchema, SystemKindSchema } from '@/lib/keepSchema';

export const maxDuration = 30;

const Body = z.object({
  kind: SystemKindSchema,
  problem: z.string().max(400).optional(),
  ageYears: z.number().min(0).max(150).nullable().optional(),
  lang: LangSchema,
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, Body);
  if ('error' in parsed) return parsed.error;
  const { kind, problem, ageYears, lang } = parsed.data;
  const out = await claudeJson({
    purpose: `home-help/${kind}`,
    system: HELP_SYSTEM,
    content: JSON.stringify({ language: lang === 'es' ? 'Spanish' : 'English', system: kind, ageYears: ageYears ?? null, whatTheySaid: problem || (kind === 'water_heater' ? 'My water heater is leaking' : `My ${kind.replace('_', ' ')} is broken`) }),
    schema: HelpSchema,
    fallback: () => fallbackHelp(kind, lang),
    // the mock fixture is the leaking water heater, in the family's language
    fixture: kind === 'water_heater' ? (lang === 'es' ? 'home-help-es' : 'home-help') : undefined,
    maxTokens: 600,
  });
  // safety floor: a gas or water-heater problem is never "can wait"
  const data = kind === 'water_heater' && out.data.urgency === 'can_wait' ? { ...out.data, urgency: 'soon' as const } : out.data;
  return NextResponse.json({ ...data, source: out.source });
}
