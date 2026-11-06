import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseBody } from '@/lib/api';
import { claudeJson } from '@/lib/claude';
import { parseSpeechRules } from '@/lib/speech';
import { LangSchema } from '@/lib/schemas';

const Body = z.object({ transcript: z.string().min(1).max(2000), lang: LangSchema, screen: z.enum(['household', 'income', 'housing', 'money']) });

// Fields the form understands. Every screen accepts all of them, so a family can say everything at once;
// the current screen's fields are listed first so Claude prioritizes them.
const FIELDS = {
  householdSize: 'integer 1-8, people in the household',
  inOC: 'boolean, lives or works in Orange County (true if they name an Orange County city such as Santa Ana, Anaheim, Garden Grove, Costa Mesa, Westminster, Irvine)',
  residentOrCitizen: 'boolean, US citizen or permanent resident',
  grossMonthlyIncome: 'number, monthly income from work before taxes (convert weekly ×52/12, yearly /12)',
  otherMonthlyIncome: 'number, other monthly income (child support, benefits, second job)',
  rent: 'number, monthly rent',
  bedrooms: 'integer, bedrooms where they live now',
  occupants: 'integer, people sleeping there',
  unsafeConditions: 'boolean, unsafe or unhealthy conditions',
  carPayment: 'number, monthly car payment',
  cardPayment: 'number, monthly credit card payments',
  studentPayment: 'number, monthly student loan payment',
  collectionBalance: 'number, total owed in collections',
  savings: 'number, savings available for a home',
  creditBand: '"good" | "building" | "needs_work" | "unknown"',
};
const ORDER: Record<string, (keyof typeof FIELDS)[]> = {
  household: ['householdSize', 'inOC', 'residentOrCitizen'],
  income: ['grossMonthlyIncome', 'otherMonthlyIncome'],
  housing: ['rent', 'bedrooms', 'occupants', 'unsafeConditions'],
  money: ['carPayment', 'cardPayment', 'studentPayment', 'collectionBalance', 'savings', 'creditBand'],
};

const Out = z.object({
  householdSize: z.number().int().min(1).max(8).optional(),
  inOC: z.boolean().optional(),
  residentOrCitizen: z.boolean().optional(),
  grossMonthlyIncome: z.number().min(0).max(50000).optional(),
  otherMonthlyIncome: z.number().min(0).max(50000).optional(),
  rent: z.number().min(0).max(10000).optional(),
  bedrooms: z.number().int().min(0).max(10).optional(),
  occupants: z.number().int().min(1).max(20).optional(),
  unsafeConditions: z.boolean().optional(),
  carPayment: z.number().min(0).optional(),
  cardPayment: z.number().min(0).optional(),
  studentPayment: z.number().min(0).optional(),
  collectionBalance: z.number().min(0).optional(),
  savings: z.number().min(0).optional(),
  creditBand: z.enum(['good', 'building', 'needs_work', 'unknown']).optional(),
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, Body);
  if ('error' in parsed) return parsed.error;
  const { transcript, lang, screen } = parsed.data;
  const keys = [...ORDER[screen], ...Object.keys(FIELDS).filter((k) => !ORDER[screen].includes(k as keyof typeof FIELDS))] as (keyof typeof FIELDS)[];
  const schemaText = keys.map((k) => `  "${k}": ${FIELDS[k]}`).join('\n');
  const out = await claudeJson({
    purpose: 'parse-speech',
    system: `You turn what a family said out loud (English or Spanish) into form fields for a Habitat for Humanity intake. Return ONLY a JSON object containing just the fields they actually stated; omit anything not said. Numbers must be JSON numbers ("cinco mil doscientos" → 5200, "two grand" → 2000). "Somos cuatro" means householdSize 4. Fields:\n{\n${schemaText}\n}`,
    content: `Language: ${lang}\nTranscript: ${transcript}`,
    schema: Out,
    fallback: () => Out.parse(parseSpeechRules(transcript)),
    maxTokens: 300,
  });
  // Drop nulls and anything outside the schema.
  const fields = Object.fromEntries(Object.entries(out.data).filter(([, v]) => v !== null && v !== undefined));
  return NextResponse.json({ fields, source: out.source });
}
