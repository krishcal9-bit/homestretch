import { z } from 'zod';
import { apiError, parseBody } from '@/lib/api';
import { buildReferral } from '@/lib/referral';
import { pdfResponse, renderReferralPdf } from '@/lib/referralPdf';
import { LangSchema, ProfileSchema } from '@/lib/schemas';

export const runtime = 'nodejs';

/** Packet for a family with no saved code: built from the posted profile. */
export async function POST(req: Request) {
  const parsed = await parseBody(req, z.object({ profile: ProfileSchema, org: z.enum(['sparkpoint', 'hope']), lang: LangSchema }));
  if ('error' in parsed) return parsed.error;
  try {
    const packet = buildReferral(parsed.data);
    return pdfResponse(await renderReferralPdf(packet), `referral-${parsed.data.org}.pdf`);
  } catch (e) {
    console.error('[referral]', (e as Error).message);
    return apiError('pdf_failed', 'Could not build the packet. Try again in a moment.', 500);
  }
}
