// KEEP · Monthly check-in: the text-message delivery. A mock for now: the message is logged to the server console
// (no SMS provider, no phone number stored). The check-in itself is saved on the family's device (lib/keepStore).
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody } from '@/lib/api';
import { LangSchema } from '@/lib/keepSchema';

const Body = z.object({
  lang: LangSchema,
  /** the messages of this check-in, in order (what the family would receive by text) */
  messages: z.array(z.string().min(1).max(400)).min(1).max(20),
  /** the next check-in reminder, 'YYYY-MM-DD' */
  nextOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, Body);
  if ('error' in parsed) return parsed.error;
  const { lang, messages, nextOn } = parsed.data;
  for (const m of messages) console.log(`[sms:mock] (${lang}) ${m}`);
  if (nextOn) console.log(`[sms:mock] next check-in reminder scheduled for ${nextOn}`);
  return NextResponse.json({ delivered: 'mock', count: messages.length, nextOn: nextOn ?? null });
}
