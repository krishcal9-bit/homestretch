import { z } from 'zod';
import { apiError } from '@/lib/api';
import { prisma } from '@/lib/db';
import { buildReferral } from '@/lib/referral';
import { pdfResponse, renderReferralPdf } from '@/lib/referralPdf';
import { LangSchema } from '@/lib/schemas';
import type { Profile } from '@/lib/types';

export const runtime = 'nodejs';

const Query = z.object({
  code: z.string().regex(/^[A-Za-z0-9]{4,12}$/),
  org: z.enum(['sparkpoint', 'hope']).default('sparkpoint'),
  lang: LangSchema.optional(),
});

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const url = new URL(req.url);
  const parsed = Query.safeParse({ code: (await ctx.params).code, org: url.searchParams.get('org') ?? undefined, lang: url.searchParams.get('lang') ?? undefined });
  if (!parsed.success) return apiError('invalid_input', 'Use a plan code, org=sparkpoint|hope and lang=en|es.');
  try {
    const plan = await prisma.plan.findUnique({ where: { code: parsed.data.code.toUpperCase() } });
    if (!plan) return apiError('not_found', "We couldn't find that plan. Check the code.", 404);
    const profile = JSON.parse(plan.profileJson) as Profile;
    const lang = parsed.data.lang ?? (plan.language === 'es' ? 'es' : 'en');
    const packet = buildReferral({ profile, org: parsed.data.org, lang, surname: plan.surname, givenName: plan.givenName, code: plan.code });
    return pdfResponse(await renderReferralPdf(packet), `referral-${plan.code}-${parsed.data.org}.pdf`);
  } catch (e) {
    console.error('[referral]', (e as Error).message);
    return apiError('pdf_failed', 'Could not build the packet. Try again in a moment.', 500);
  }
}
