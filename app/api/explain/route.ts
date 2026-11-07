import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody } from '@/lib/api';
import { claudeJson } from '@/lib/claude';
import { LangSchema } from '@/lib/schemas';
import { ExplainFactsSchema } from '@/lib/keepSchemas';
import { explainTemplate, explainVars, numbersAreFacts, wordCount } from '@/lib/shield';

export const maxDuration = 30;

const Body = z.object({ lang: LangSchema, facts: ExplainFactsSchema });
const Out = z.object({ text: z.string().min(1).max(800) });

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (all, k: string) => v[k] ?? all);

/**
 * One plain-language sentence or two about a document the family just uploaded, in their language, under 80 words.
 * Every number comes from the extraction and the forecast engine (passed in); a reply that cites any other number,
 * runs long, or fails falls back to the template.
 */
export async function POST(req: Request) {
  const parsed = await parseBody(req, Body);
  if ('error' in parsed) return parsed.error;
  const { lang, facts } = parsed.data;
  const vars = explainVars(lang, facts);
  const template = explainTemplate(lang, facts);
  const out = await claudeJson({
    purpose: 'keep/explain',
    system: `You explain a homeowner's housing document to a Habitat for Humanity homeowner family in plain, warm, everyday ${lang === 'es' ? 'Spanish (usted)' : 'English'}.
Write one or two short sentences, under 50 words, at a 6th-grade reading level. Say what changed and why their monthly payment changes.
Use ONLY these facts, written exactly as given (do not compute or round anything new, do not add any other number or date):
${Object.entries(vars)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}
No greetings, no advice, no jargon (say "the part of your payment for taxes and insurance" instead of "escrow" when you can).
Return ONLY JSON: {"text": "..."}`,
    content: `Document type: ${facts.documentType}. Example of the tone: "${template}"`,
    schema: Out,
    fallback: () => ({ text: template }),
    fixture: lang === 'es' ? 'explain-es' : 'explain',
    maxTokens: 300,
    temperature: 0.3,
  });
  let text = fill(out.data.text.trim(), vars);
  let source = out.source;
  if (/\{\w+\}/.test(text) || wordCount(text) > 80 || !numbersAreFacts(text, lang, facts)) {
    text = template;
    source = 'fallback';
  }
  return NextResponse.json({ text, source });
}
