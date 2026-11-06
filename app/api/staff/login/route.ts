import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, parseBody } from '@/lib/api';
import { STAFF_COOKIE, staffPassword, staffToken } from '@/lib/staffAuth';

export async function POST(req: Request) {
  const parsed = await parseBody(req, z.object({ password: z.string().max(200) }));
  if ('error' in parsed) return parsed.error;
  const pw = staffPassword();
  if (!pw) return apiError('not_configured', 'Set STAFF_PASSWORD on the server to open the staff console.', 503);
  if (parsed.data.password !== pw) return apiError('wrong_password', "That password didn't work. Try again.", 401);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STAFF_COOKIE, await staffToken(pw), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return res;
}
