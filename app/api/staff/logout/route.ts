import { NextResponse } from 'next/server';
import { STAFF_COOKIE } from '@/lib/staffAuth';

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL('/staff/login', req.url), 303);
  res.cookies.set(STAFF_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
