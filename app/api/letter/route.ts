import { z } from 'zod';
import { parseBody } from '@/lib/api';
import { claudeTextStream } from '@/lib/claude';
import { LangSchema } from '@/lib/schemas';

const Body = z.object({
  finding: z.object({ finding: z.string().max(400), whatToDo: z.string().max(600).optional(), kind: z.string().optional() }),
  family: z.object({ name: z.string().max(120).optional(), lender: z.string().max(120).optional(), city: z.string().max(80).optional() }).optional(),
  lang: LangSchema,
});

const SYSTEM = `You write letters of explanation (LOE) that mortgage applicants give lenders. Standard format, plain text, no markdown:
<date>
<blank line>
<lender name>
<blank line>
RE: <short subject, e.g. "Cash deposit of $1,500 on September 14, 2026">
<blank line>
To whom it may concern:
<blank line>
<ONE paragraph, 3-5 sentences: what happened, why, and that it is resolved or how it is being handled. Use the exact amounts and dates given. Do not invent facts beyond plausible, neutral placeholders in [brackets] the applicant must fill in, e.g. [source of the cash, such as a family gift or sale of a car].>
<blank line>
Sincerely,
<blank line>
______________________
<applicant name>
Write in the requested language (Spanish uses "usted"-level formality and Spanish date format). Output only the letter.`;

function fallbackLetter(finding: string, lang: 'en' | 'es', name: string, lender: string) {
  const date = new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', { dateStyle: 'long' }).format(new Date());
  if (lang === 'es')
    return `${date}\n\n${lender}\n\nRE: ${finding}\n\nA quien corresponda:\n\nLe escribo para explicar lo siguiente en mi estado de cuenta: ${finding}. [Explique qué pasó y por qué, en una o dos oraciones.] Esto fue un hecho aislado y [explique cómo se resolvió o cómo evitará que se repita]. Con gusto puedo entregar documentos que lo respalden.\n\nAtentamente,\n\n______________________\n${name}`;
  return `${date}\n\n${lender}\n\nRE: ${finding}\n\nTo whom it may concern:\n\nI am writing to explain the following item on my bank statement: ${finding}. [Explain what happened and why in one or two sentences.] This was a one-time event and [explain how it was resolved or how you will prevent it]. I am happy to provide documents that support this explanation.\n\nSincerely,\n\n______________________\n${name}`;
}

/** Streams the letter as plain text so the editor can grow token by token. */
export async function POST(req: Request) {
  const parsed = await parseBody(req, Body);
  if ('error' in parsed) return parsed.error;
  const { finding, family, lang } = parsed.data;
  const name = family?.name?.trim() || (lang === 'es' ? '[Su nombre]' : '[Your name]');
  const lender = family?.lender?.trim() || 'Habitat for Humanity of Orange County';
  const today = new Date().toISOString().slice(0, 10);
  const gen = claudeTextStream({
    purpose: 'letter',
    system: SYSTEM,
    content: `Language: ${lang === 'es' ? 'Spanish' : 'English'}\nToday: ${today}\nLender: ${lender}\nApplicant: ${name}\nItem the lender flagged: ${finding.finding}\nContext: ${finding.whatToDo ?? ''}`,
    fallback: () => fallbackLetter(finding.finding, lang, name, lender),
    fixture: lang === 'es' ? 'letter-es' : 'letter',
  });
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      for await (const chunk of gen) controller.enqueue(enc.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}
