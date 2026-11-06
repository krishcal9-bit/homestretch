import { NextResponse } from 'next/server';
import type { z } from 'zod';

export function apiError(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Parse and validate a JSON body; returns data or a ready error response. */
export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<{ data: T } | { error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: apiError('bad_json', 'Request body must be JSON.') };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: apiError('invalid_input', `${first?.path.join('.') || 'body'}: ${first?.message ?? 'invalid'}`) };
  }
  return { data: parsed.data };
}
