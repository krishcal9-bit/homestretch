// KEEP · "My home plan": a one-page PDF from the family's Keep profile (sent from their device; nothing is stored).
import { z } from 'zod';
import { apiError, parseBody } from '@/lib/api';
import { KeepProfileSchema, LangSchema } from '@/lib/keepSchema';
import { renderHomePlanPdf } from '@/lib/pdf/homePlanPdf';

export const runtime = 'nodejs';
export const maxDuration = 30;

const Body = z.object({
  profile: KeepProfileSchema,
  movesDone: z.array(z.string().max(60)).max(30).catch([]).optional(),
  reliefDone: z.array(z.string().max(40)).max(20).catch([]).optional(),
  lang: LangSchema,
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, Body);
  if ('error' in parsed) return parsed.error;
  const { profile, movesDone, reliefDone, lang } = parsed.data;
  try {
    const pdf = await renderHomePlanPdf({ profile, movesDone: movesDone ?? [], reliefDone: reliefDone ?? [], lang });
    return new Response(new Uint8Array(pdf), {
      headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="my-home-plan-${lang}.pdf"`, 'cache-control': 'no-store' },
    });
  } catch (e) {
    console.warn('[pdf/home-plan]', (e as Error).message);
    return apiError('pdf_failed', lang === 'es' ? 'No pudimos crear el PDF. Inténtelo de nuevo.' : 'We could not make the PDF. Try again.', 500);
  }
}
