import { NextResponse } from 'next/server';
import { apiError, parseBody } from '@/lib/api';
import { claudeJson } from '@/lib/claude';
import { CAUSE_LABEL, HomeownerOutreachDraft, HomeownerOutreachInput, draftOk, fillOutreach, findHomeowner, homeownerOutreachTemplate, outreachFacts, RISK_LABEL } from '@/lib/earlyWarning';
import { monthName } from '@/lib/format';

const SYSTEM = `You write short notes from Habitat for Humanity of Orange County staff to a Habitat homeowner family. They already own their home; Habitat wants to help them absorb a payment increase before it becomes a missed payment.
Voice: warm, plain, respectful, never alarming, no jargon, no exclamation marks, no emoji. Do not mention risk levels or scores.
Rules: under 120 words; greet the given name and mention the family surname; describe the coming change only with the numbers provided; give EXACTLY ONE next step, the one provided; invite a reply or a call. Never invent numbers, dates or programs.
If the language is Spanish, write the body in Spanish (usted form) and put a faithful English translation in "translation". If English, omit "translation".
Return only JSON: {"subject": string, "body": string, "translation"?: string}.`;

/** Draft a note for one sample homeowner (by id). Numbers come from lib/forecast.ts; nothing is sent. */
export async function POST(req: Request) {
  const parsed = await parseBody(req, HomeownerOutreachInput);
  if ('error' in parsed) return parsed.error;
  const row = findHomeowner(parsed.data.id);
  if (!row) return apiError('not_found', 'No homeowner with that id.', 404);
  const lang = parsed.data.lang ?? row.language;
  const facts = outreachFacts(row, lang);
  const fallback = () => homeownerOutreachTemplate(facts);
  const { data, source } = await claudeJson({
    purpose: `outreach/homeowner/${row.id}`,
    system: SYSTEM,
    content: JSON.stringify({
      language: lang === 'es' ? 'Spanish' : 'English',
      family: { surname: row.surname, givenName: row.givenName, householdSize: row.householdSize, city: row.city },
      staffContext: { riskLevel: RISK_LABEL[row.risk.level], missedCheckin: row.risk.missedCheckin },
      comingChange: facts.shock ? { what: CAUSE_LABEL[facts.shock.cause], month: monthName(facts.shock.month, lang), addsPerMonth: facts.shock.delta } : null,
      breathingRoom: { now: facts.now, inSixMonths: facts.in6 },
      nextStep: lang === 'es' ? facts.step.es : facts.step.title,
      nextStepDetail: facts.step.detail,
    }),
    schema: HomeownerOutreachDraft,
    fallback,
    fixture: lang === 'es' ? 'outreach-homeowner-es' : 'outreach-homeowner',
    maxTokens: 900,
  });
  let draft: HomeownerOutreachDraft = {
    subject: fillOutreach(data.subject, facts),
    body: fillOutreach(data.body, facts),
    ...(data.translation ? { translation: fillOutreach(data.translation, facts, 'en') } : {}),
  };
  let used = source;
  if (!draftOk(draft, facts)) {
    draft = fallback();
    used = 'fallback';
  } else if (lang === 'es' && !draft.translation) {
    // staff read the English; when Claude leaves it out, the template's translation stands in
    draft = { ...draft, translation: fallback().translation };
  }
  return NextResponse.json({ ...draft, lang, source: used });
}
