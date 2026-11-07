import { NextResponse, type NextRequest } from 'next/server';
import { STAFF_COOKIE, isStaffToken } from '@/lib/staffAuth';

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === '/staff/login') return NextResponse.next();
  if (await isStaffToken(req.cookies.get(STAFF_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Sign in to the staff console first.' } }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/staff/login';
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

// Staff pages plus the staff-only APIs. /api/referral stays open: a family downloads its own packet by code.
export const config = { matcher: ['/staff', '/staff/:path*', '/api/outreach', '/api/outreach/:path*', '/api/match-reason', '/api/checkin', '/api/digest'] };
