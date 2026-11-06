// The only place the Anthropic client is created (BUILD_SPEC §5, §6).
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import type { z } from 'zod';

export const MODEL = 'claude-sonnet-5-5';
const TIMEOUT_MS = 20_000;

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  const apiKey = process.env.APP_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!client) {
    client = new Anthropic({
      apiKey,
      // Don't inherit a tool-specific ANTHROPIC_BASE_URL from the environment.
      baseURL: process.env.APP_ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com',
      timeout: TIMEOUT_MS,
      maxRetries: 0,
    });
  }
  return client;
}

export const isMock = () => process.env.MOCK_CLAUDE === '1';

export function loadFixture<T = unknown>(name: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures', `${name}.json`), 'utf8')) as T;
  } catch {
    return null;
  }
}

/** Pull the first JSON object/array out of a model reply (tolerates ```json fences). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  if (start < 0) throw new Error('no JSON in reply');
  const open = body[start];
  const close = open === '{' ? '}' : ']';
  const end = body.lastIndexOf(close);
  return JSON.parse(body.slice(start, end + 1));
}

type Content = Anthropic.Messages.ContentBlockParam[] | string;

export type ClaudeJsonArgs<T> = {
  purpose: string;
  system: string;
  content: Content;
  schema: z.ZodType<T>;
  fallback: () => T;
  /** Fixture name in fixtures/ used when MOCK_CLAUDE=1 (falls back to `fallback`). */
  fixture?: string;
  temperature?: number;
  maxTokens?: number;
};

export type ClaudeJsonResult<T> = { data: T; source: 'claude' | 'mock' | 'fallback'; tokens?: { input: number; output: number } };

/**
 * One JSON-returning Claude call with a 20s timeout, one retry, Zod validation and a
 * rules-based fallback so the demo never breaks (§9.3). Logs purpose and tokens.
 */
export async function claudeJson<T>(args: ClaudeJsonArgs<T>): Promise<ClaudeJsonResult<T>> {
  if (isMock()) {
    const fx = args.fixture ? loadFixture(args.fixture) : null;
    const parsed = fx ? args.schema.safeParse(fx) : null;
    console.log(`[claude:mock] ${args.purpose}`);
    return parsed?.success ? { data: parsed.data, source: 'mock' } : { data: args.fallback(), source: 'fallback' };
  }
  const c = getClient();
  if (!c) {
    console.log(`[claude:fallback] ${args.purpose} (no API key)`);
    return { data: args.fallback(), source: 'fallback' };
  }
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await c.messages.create({
        model: MODEL,
        max_tokens: args.maxTokens ?? 1500,
        system: args.system,
        messages: [{ role: 'user', content: args.content }],
      });
      const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      const tokens = { input: res.usage.input_tokens, output: res.usage.output_tokens };
      console.log(`[claude] ${args.purpose} · in ${tokens.input} · out ${tokens.output} tokens`);
      const parsed = args.schema.safeParse(extractJson(text));
      if (parsed.success) return { data: parsed.data, source: 'claude', tokens };
      console.warn(`[claude] ${args.purpose}: invalid JSON shape (attempt ${attempt})`, parsed.error.issues.slice(0, 3));
    } catch (e) {
      console.warn(`[claude] ${args.purpose}: ${(e as Error).message} (attempt ${attempt})`);
    }
  }
  console.log(`[claude:fallback] ${args.purpose}`);
  return { data: args.fallback(), source: 'fallback' };
}

/** Streams plain text (letters, outreach bodies). Yields chunks; falls back to a single chunk. */
export async function* claudeTextStream(args: { purpose: string; system: string; content: Content; fallback: () => string; fixture?: string; maxTokens?: number }): AsyncGenerator<string> {
  const c = isMock() ? null : getClient();
  if (!c) {
    const fx = isMock() && args.fixture ? loadFixture<{ text: string }>(args.fixture)?.text : null;
    const text = fx ?? args.fallback();
    console.log(`[claude:${isMock() ? 'mock' : 'fallback'}] ${args.purpose}`);
    // Emit in small pieces so the UI's streaming path is exercised either way.
    for (const piece of text.match(/[\s\S]{1,24}/g) ?? [text]) yield piece;
    return;
  }
  let yielded = false;
  try {
    const stream = c.messages.stream({ model: MODEL, max_tokens: args.maxTokens ?? 800, system: args.system, messages: [{ role: 'user', content: args.content }] }, { timeout: TIMEOUT_MS });
    for await (const ev of stream) {
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
        yielded = true;
        yield ev.delta.text;
      }
    }
    const final = await stream.finalMessage();
    console.log(`[claude] ${args.purpose} · in ${final.usage.input_tokens} · out ${final.usage.output_tokens} tokens`);
  } catch (e) {
    console.warn(`[claude] ${args.purpose}: ${(e as Error).message}`);
    if (!yielded) yield args.fallback();
  }
}
