import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api';
import { claudeJson } from '@/lib/claude';
import { fileToContent } from '@/lib/upload';
import { DocumentExtractSchema, type DocumentExtract } from '@/lib/keepSchemas';

export const maxDuration = 30;

const SYSTEM = `You read a California homeowner's housing documents: a homeowners insurance renewal notice or declarations page, a mortgage escrow analysis statement, a county property tax bill, or an HOA dues notice. Return ONLY a JSON object, no prose:
{"documentType": "insurance_renewal"|"insurance_declarations"|"escrow_analysis"|"property_tax"|"hoa_notice"|"unknown",
 "insurer": string|null, "fairPlan": boolean|null,
 "currentPremium": number|null, "renewalPremium": number|null, "effectiveDate": "YYYY-MM-DD"|null,
 "currentEscrow": number|null, "newEscrow": number|null, "escrowShortage": number|null, "mortgagePrincipal": number|null,
 "propertyTaxAnnual": number|null, "hoaCurrent": number|null, "hoaNew": number|null}
Rules:
- Premiums are ANNUAL dollars. currentPremium is this term's premium; renewalPremium is the next term's.
- effectiveDate: when the renewal, the new escrow payment or the new HOA dues start.
- currentEscrow/newEscrow are the MONTHLY escrow portion (taxes + insurance), not the full payment. mortgagePrincipal is the monthly principal (and interest) portion if shown.
- propertyTaxAnnual: the total annual tax (both installments together).
- hoaCurrent/hoaNew: MONTHLY dues.
- fairPlan is true only if the insurer is the California FAIR Plan Association.
- Use null for anything not on the page or not clearly readable. Never guess or compute a number that isn't printed.
- If the file is not one of these documents, set documentType to "unknown" and everything else to null.`;

const EMPTY: DocumentExtract = {
  documentType: 'unknown',
  insurer: null,
  fairPlan: null,
  currentPremium: null,
  renewalPremium: null,
  effectiveDate: null,
  currentEscrow: null,
  newEscrow: null,
  escrowShortage: null,
  mortgagePrincipal: null,
  propertyTaxAnnual: null,
  hoaCurrent: null,
  hoaNew: null,
};

const readSomething = (d: DocumentExtract) =>
  [d.currentPremium, d.renewalPremium, d.currentEscrow, d.newEscrow, d.mortgagePrincipal, d.propertyTaxAnnual, d.hoaCurrent, d.hoaNew].some((v) => typeof v === 'number' && v > 0);

/**
 * Reads one housing document (image or PDF) with Claude vision and returns typed fields, `null` where unreadable.
 * The file is processed in memory for this request only and never stored.
 */
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
  const out = await claudeJson({
    purpose: 'extract/document',
    system: SYSTEM,
    content: [content.block, { type: 'text', text: 'Read this housing document and return the JSON.' }],
    schema: DocumentExtractSchema,
    fallback: () => EMPTY,
    fixture: 'document-extract',
    maxTokens: 500,
  });
  const d = out.data;
  if (d.documentType === 'unknown' || !readSomething(d)) {
    return apiError(
      out.source === 'fallback' ? 'unreadable' : 'not_housing_document',
      lang === 'es'
        ? 'No pudimos leer un aviso de seguro, estado de escrow, factura de impuestos o aviso de HOA en ese archivo. Pruebe con una foto más clara, o escriba los números.'
        : "We couldn't read an insurance notice, escrow statement, tax bill or HOA notice in that file. Try a clearer photo, or type the numbers in.",
      422,
    );
  }
  return NextResponse.json({ ...d, source: out.source });
}
