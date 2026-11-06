import { NextResponse } from 'next/server';
import { parseBody } from '@/lib/api';
import { claudeJson } from '@/lib/claude';
import { monthName } from '@/lib/format';
import { OutreachDraft, OutreachInput, fillPlaceholders, outreachTemplate } from '@/lib/outreach';

const SYSTEM = `You write short check-in messages from Habitat for Humanity of Orange County staff to a family working toward a Habitat home.
Voice: warm, plain, respectful, no jargon, no exclamation marks, no emoji. Write entirely in the requested language (Spanish uses the "usted" form).
Rules: under 120 words; mention the family surname; mention the upcoming home (city, bedrooms, completion month); give EXACTLY ONE next action, taken from the provided next action; never invent numbers or dates beyond those provided; do not promise the home.
Return only JSON: {"subject": string, "body": string}.`;

export async function POST(req: Request) {
  const parsed = await parseBody(req, OutreachInput);
  if ('error' in parsed) return parsed.error;
  const input = parsed.data;
  const { data, source } = await claudeJson({
    purpose: 'outreach',
    system: SYSTEM,
    content: JSON.stringify({
      language: input.lang === 'es' ? 'Spanish' : 'English',
      family: { ...input.family, readyDate: monthName(input.family.readyDate, input.lang) },
      home: { ...input.home, completion: monthName(input.home.completion, input.lang) },
    }),
    schema: OutreachDraft,
    fallback: () => outreachTemplate(input),
    fixture: input.lang === 'es' ? 'outreach-es' : 'outreach',
    maxTokens: 600,
  });
  let draft = { subject: fillPlaceholders(data.subject, input), body: fillPlaceholders(data.body, input) };
  // The family surname must appear; if the model dropped it, use the template.
  if (!draft.body.includes(input.family.surname) || draft.body.split(/\s+/).length > 140) draft = outreachTemplate(input);
  return NextResponse.json({ ...draft, source });
}
