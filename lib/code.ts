import crypto from 'crypto';
// 6 characters, no lookalikes (0/O, 1/I/L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function newCode(): string {
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}
export const isCode = (s: string) => /^[A-Z0-9]{6}$/.test(s);
