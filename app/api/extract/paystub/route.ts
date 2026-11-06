import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/api';
import { claudeJson } from '@/lib/claude';
import { fileToContent, monthlyFromPay } from '@/lib/upload';

export const maxDuration = 30;

const Out = z.object({
  isPaystub: z.boolean(),
  employer: z.string().nullable(),
  payFrequency: z.enum(['weekly', 'biweekly', 'semimonthly', 'monthly']).nullable(),
  grossPerPeriod: z.number().nullable(),
  ytdGross: z.number().nullable(),
  payDate: z.string().nullable(),
});

const SYSTEM = `You read pay stubs. Return ONLY a JSON object, no prose:
{"isPaystub": boolean, "employer": string|null, "payFrequency": "weekly"|"biweekly"|"semimonthly"|"monthly"|null, "grossPerPeriod": number|null, "ytdGross": number|null, "payDate": "YYYY-MM-DD"|null}
grossPerPeriod is GROSS pay (before taxes and deductions) for this pay period. Use null for anything you cannot read clearly. Never guess. If the document is not a pay stub, set isPaystub to false and everything else to null.`;

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError('bad_form', 'Upload a file as form data.');
  }
  const lang = form.get('lang') === 'es' ? 'es' : 'en';
  const content = await fileToContent(form.get('file') as File | null);
  if ('error' in content) return apiError(content.error.code, content.error.message[lang]);
  // Process in memory only; the file is discarded when this request ends.
  const out = await claudeJson({
    purpose: 'extract/paystub',
    system: SYSTEM,
    content: [content.block, { type: 'text', text: 'Extract the pay stub fields as JSON.' }],
    schema: Out,
    fallback: () => ({ isPaystub: false, employer: null, payFrequency: null, grossPerPeriod: null, ytdGross: null, payDate: null }),
    fixture: 'paystub-extract',
    maxTokens: 400,
  });
  const d = out.data;
  if (!d.isPaystub || !d.grossPerPeriod) {
    return apiError(
      out.source === 'fallback' ? 'unreadable' : 'not_paystub',
      lang === 'es'
        ? 'No pudimos leer un talón de pago en ese archivo. Pruebe con una foto más clara, o escriba su ingreso.'
        : "We couldn't read a pay stub in that file. Try a clearer photo, or type your income in.",
      422,
    );
  }
  const monthly = Math.round(monthlyFromPay(d.grossPerPeriod, d.payFrequency));
  return NextResponse.json({ ...d, monthlyGross: monthly });
}
