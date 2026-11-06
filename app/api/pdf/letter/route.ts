import { z } from 'zod';
import { parseBody, apiError } from '@/lib/api';
import { renderLetterPdf } from '@/lib/pdf/letterPdf';

export const runtime = 'nodejs';
const Body = z.object({ text: z.string().min(1).max(6000), lang: z.enum(['en', 'es']) });

export async function POST(req: Request) {
  const parsed = await parseBody(req, Body);
  if ('error' in parsed) return parsed.error;
  try {
    const pdf = await renderLetterPdf(parsed.data.text);
    return new Response(new Uint8Array(pdf), {
      headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="letter-of-explanation-${parsed.data.lang}.pdf"` },
    });
  } catch {
    return apiError('pdf_failed', 'We could not make the PDF. Copy the letter text instead.', 500);
  }
}
