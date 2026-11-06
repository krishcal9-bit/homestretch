import { NextResponse } from 'next/server';
import { parseBody } from '@/lib/api';
import { claudeJson } from '@/lib/claude';
import { monthName } from '@/lib/format';
import { MatchReasonInput, MatchReasons } from '@/lib/outreach';

const SYSTEM = `You help Habitat for Humanity of Orange County staff match families to an upcoming home.
For each candidate, write ONE plain sentence (under 25 words) on why they fit this home, or what stands in the way. Use only the facts given; never invent numbers or dates. No names are given; do not invent any.
Return only JSON: {"reasons": [{"code": string, "reason": string}]} with one entry per candidate code.`;

export async function POST(req: Request) {
  const parsed = await parseBody(req, MatchReasonInput);
  if ('error' in parsed) return parsed.error;
  const { home, candidates } = parsed.data;
  if (candidates.length === 0) return NextResponse.json({ reasons: [], source: 'fallback' });
  const fallback = () => ({ reasons: candidates.map((c) => ({ code: c.code, reason: c.fallback })) });
  const { data, source } = await claudeJson({
    purpose: 'match-reason',
    system: SYSTEM,
    // Strip the rules sentence and send only the facts.
    content: JSON.stringify({
      home: { ...home, completion: monthName(home.completion) },
      candidates: candidates.map((c) => ({ ...c, readyDate: monthName(c.readyDate), fallback: undefined })),
    }),
    schema: MatchReasons,
    fallback,
    fixture: 'match-reason',
    maxTokens: 900,
  });
  // Every candidate gets a sentence: fill gaps (or mock codes that don't match) from the rules.
  const byCode = new Map(data.reasons.map((r) => [r.code, r.reason]));
  const reasons = candidates.map((c) => ({ code: c.code, reason: byCode.get(c.code) ?? c.fallback }));
  return NextResponse.json({ reasons, source });
}
