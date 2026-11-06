import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/api';
import { claudeJson } from '@/lib/claude';
import { fileToContent } from '@/lib/upload';
import { StatementSchema } from '@/lib/schemas';

export const maxDuration = 30;

const Out = StatementSchema.extend({ isStatement: z.boolean() });

const SYSTEM = `You read bank statements for a mortgage readiness check. Return ONLY a JSON object, no prose:
{"isStatement": boolean, "recurringDebts": [{"name": string, "amount": number, "kind": "car"|"card"|"student"|"collection"|"other"}], "rentPaymentDetected": boolean, "avgMonthlyDeposits": number, "overdraftOrNsfCount": number, "largeUnexplainedDeposits": [{"date": "YYYY-MM-DD", "amount": number, "description": string}]}
recurringDebts: payments that repeat monthly to lenders (auto loans, card issuers, student loan servicers, collection agencies, personal loans). Not rent, utilities or groceries.
overdraftOrNsfCount: overdraft, NSF or returned-item fees in the statement period.
largeUnexplainedDeposits: deposits of $1,000 or more that are not payroll, government benefits or transfers between the person's own accounts (cash deposits, Zelle/Venmo from people, etc).
Use 0 / [] / false when absent. If the document is not a bank statement, set isStatement to false and leave the rest empty.`;

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError('bad_form', 'Upload a file as form data.');
  }
  const lang = form.get('lang') === 'es' ? 'es' : 'en';
  const content = await fileToContent(form.get('file') as File | null);
  if ('error' in content) return apiError(content.error.code, content.error.message[lang]);
  const empty = { isStatement: false, recurringDebts: [], rentPaymentDetected: false, avgMonthlyDeposits: 0, overdraftOrNsfCount: 0, largeUnexplainedDeposits: [] };
  const out = await claudeJson({
    purpose: 'extract/statement',
    system: SYSTEM,
    content: [content.block, { type: 'text', text: 'Read this bank statement and return the JSON.' }],
    schema: Out,
    fallback: () => empty,
    fixture: 'statement-extract',
    maxTokens: 1200,
  });
  if (!out.data.isStatement) {
    return apiError(
      out.source === 'fallback' ? 'unreadable' : 'not_statement',
      lang === 'es'
        ? 'No pudimos leer un estado de cuenta en ese archivo. Pruebe con un PDF del banco o una foto clara, o siga sin él.'
        : "We couldn't read a bank statement in that file. Try a PDF from your bank or a clear photo, or continue without it.",
      422,
    );
  }
  const { isStatement: _ok, ...findings } = out.data;
  void _ok;
  return NextResponse.json(findings);
}
