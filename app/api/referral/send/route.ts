import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody } from '@/lib/api';
import { ORG_NAME } from '@/lib/referral';
import { LangSchema, ProfileSchema } from '@/lib/schemas';

/** Mock send (D5): logs the referral; nothing leaves the server. */
export async function POST(req: Request) {
  const parsed = await parseBody(
    req,
    z.object({ org: z.enum(['sparkpoint', 'hope']), lang: LangSchema, code: z.string().max(12).optional(), profile: ProfileSchema.optional() }),
  );
  if ('error' in parsed) return parsed.error;
  const { org, lang, code } = parsed.data;
  console.log(`[referral:send] to ${ORG_NAME[org]} · lang ${lang} · ${code ? `plan ${code}` : 'unsaved profile'}`);
  return NextResponse.json({ ok: true, org: ORG_NAME[org] });
}
