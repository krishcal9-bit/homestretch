// Staff gate (BUILD_SPEC §2.B). The cookie holds an HMAC of STAFF_PASSWORD, so changing the
// password signs everyone out. Web Crypto only, so it runs in middleware (edge) and in routes.
export const STAFF_COOKIE = 'hs_staff';

const enc = new TextEncoder();

export async function staffToken(password: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('keystone-staff-v1'));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

export const staffPassword = () => process.env.STAFF_PASSWORD || '';

export async function isStaffToken(token: string | undefined): Promise<boolean> {
  const pw = staffPassword();
  if (!pw || !token) return false;
  const expected = await staffToken(pw);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
