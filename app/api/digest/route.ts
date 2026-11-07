import { z } from 'zod';
import { parseBody } from '@/lib/api';
import { claudeJson, isMock } from '@/lib/claude';
import { DigestDraftSchema, digestChanges, digestTemplate, fillDigest, homeownerRows, outreachFacts, RISK_LABEL, type DigestLine, type HomeownerRow } from '@/lib/earlyWarning';

export const maxDuration = 60;

const Input = z.object({}).strict();
const CONCURRENCY = 4;

const SYSTEM = `You help Habitat for Humanity of Orange County staff with a Monday digest of Habitat homeowners whose payment picture changed this week.
For one household you get the changes (already computed; never invent numbers), the family's language and one suggested next step.
Write:
- "summary": one or two plain sentences for staff (English): what changed and the suggested step. Under 45 words.
- "draft": a short, warm note to the family, under 70 words, no exclamation marks, no emoji, never alarming, exactly one next step (the one provided), inviting a reply. "en" is always English. If the language is Spanish, also write "es" in Spanish (usted form) and make "en" its faithful translation.
Return only JSON: {"summary": string, "draft": {"es"?: string, "en": string}}.`;

/**
 * Streams NDJSON. {type:'start', total}, then per homeowner {type:'progress', done} and, for each one whose payment
 * picture changed since last week's snapshot, {type:'household', ...DigestLine}; finally {type:'done', changed}.
 * Errors arrive as {type:'error', error:{code, message}}. Nothing is sent to any family.
 */
export async function POST(req: Request) {
  // An empty body is fine; anything else must be an empty JSON object.
  const text = await req.text();
  if (text.trim()) {
    const parsed = await parseBody(new Request(req.url, { method: 'POST', body: text }), Input);
    if ('error' in parsed) return parsed.error;
  }
  const today = new Date();
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + '\n'));
      try {
        const rows = homeownerRows(today);
        send({ type: 'start', total: rows.length });
        let done = 0;
        let changed = 0;
        const one = async (row: HomeownerRow) => {
          const changes = digestChanges(row, today);
          if (changes.length) {
            const facts = outreachFacts(row);
            const out = await claudeJson({
              purpose: `digest/${row.id}`,
              system: SYSTEM,
              content: JSON.stringify({
                household: `${row.givenName} ${row.surname}`,
                language: row.language === 'es' ? 'Spanish' : 'English',
                riskLevel: RISK_LABEL[row.risk.level],
                changes: changes.map((c) => c.text),
                breathingRoom: { now: row.risk.now, inSixMonths: row.risk.in6 },
                suggestedStep: facts.step.title,
                suggestedStepSpanish: facts.step.es,
              }),
              schema: DigestDraftSchema,
              fallback: () => digestTemplate(row, changes),
              fixture: 'digest-household',
              maxTokens: 600,
            });
            const d = out.data;
            const draft = {
              en: fillDigest(d.draft.en, row, changes, 'en'),
              ...(row.language === 'es' && d.draft.es ? { es: fillDigest(d.draft.es, row, changes, 'es') } : {}),
            };
            // A Spanish-preferring family must get a Spanish draft; otherwise use the rules template.
            const ok = row.language !== 'es' || !!draft.es;
            const final = ok ? { summary: fillDigest(d.summary, row, changes, 'en'), draft } : digestTemplate(row, changes);
            if (isMock()) await new Promise((r) => setTimeout(r, 140)); // let the UI's streaming path show in demos
            const line: DigestLine = {
              id: row.id,
              household: `${row.givenName} ${row.surname}`,
              surname: row.surname,
              language: row.language,
              level: row.risk.level,
              changes,
              summary: final.summary,
              draft: final.draft,
              source: ok ? out.source : 'fallback',
            };
            changed++;
            send({ type: 'household', ...line });
          }
          done++;
          send({ type: 'progress', done });
        };
        // a small pool: households stream in as each one finishes
        let next = 0;
        await Promise.all(
          Array.from({ length: CONCURRENCY }, async () => {
            while (next < rows.length) await one(rows[next++]);
          }),
        );
        send({ type: 'done', changed });
      } catch (e) {
        send({ type: 'error', error: { code: 'digest_failed', message: (e as Error).message.slice(0, 200) } });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
}
