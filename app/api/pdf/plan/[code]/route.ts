import { apiError } from '@/lib/api';
import { loadPlanRecord } from '@/lib/planRecord';
import { renderPlanPdf } from '@/lib/pdf/planPdf';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const url = new URL(req.url);
  const l = url.searchParams.get('lang');
  const rec = await loadPlanRecord(code, l === 'es' ? 'es' : l === 'en' ? 'en' : undefined);
  if (!rec) return apiError('not_found', "We couldn't find that plan.", 404);
  try {
    const pdf = await renderPlanPdf({ ...rec, url: `${url.origin}/plan/${rec.code}` });
    return new Response(new Uint8Array(pdf), {
      headers: { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="homestretch-plan-${rec.code}-${rec.lang}.pdf"` },
    });
  } catch {
    return apiError('pdf_failed', 'We could not make the PDF right now.', 500);
  }
}
