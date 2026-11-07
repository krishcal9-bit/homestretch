// KEEP · Home Health: what a system is and how old it is, from a photo (Claude vision reads the data plate) or
// typed facts. The typical life and the Orange County replacement range always come from SYSTEM_DEFAULTS.
// Photos are processed in memory and discarded when the request ends: nothing is stored.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, parseBody } from '@/lib/api';
import { claudeJson } from '@/lib/claude';
import { fileToContent } from '@/lib/upload';
import { PLATE_SYSTEM, PlateReadSchema, resolveSystem, type PlateRead } from '@/lib/homeHealth';
import { LangSchema, SystemKindSchema } from '@/lib/keepSchema';

export const maxDuration = 30;

const Typed = z.object({
  kind: SystemKindSchema,
  ageYears: z.number().min(0).max(150).nullable().optional(),
  installYear: z.number().int().min(1900).max(2100).nullable().optional(),
  lang: LangSchema.optional(),
});

const NOT_A_SYSTEM = {
  en: "We couldn't find a water heater, roof, heating unit or appliance in that photo. Try a clear photo of the label, or type the age.",
  es: 'No encontramos un calentador, techo, unidad de calefacción o aparato en esa foto. Pruebe con una foto clara de la etiqueta, o escriba la edad.',
};

export async function POST(req: Request) {
  const type = req.headers.get('content-type') ?? '';
  if (type.includes('multipart/form-data')) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return apiError('bad_form', 'Upload a photo as form data.');
    }
    const lang = form.get('lang') === 'es' ? 'es' : 'en';
    const kind = SystemKindSchema.catch('water_heater').parse(form.get('kind'));
    const content = await fileToContent(form.get('file') as File | null);
    if ('error' in content) return apiError(content.error.code, content.error.message[lang]);
    const out = await claudeJson<PlateRead>({
      purpose: 'home-health/photo',
      system: PLATE_SYSTEM,
      content: [content.block, { type: 'text', text: `The family says this is their ${kind.replace('_', ' ')}. Write "details" in ${lang === 'es' ? 'Spanish' : 'English'}. Read it as JSON.` }],
      schema: PlateReadSchema,
      // without Claude we can't read the photo: fall back to the typical age for that system, low confidence
      fallback: () => ({ isHomeSystem: true, system: kind, manufactureYear: null, estimatedAgeYears: null, confidence: 'low', details: null }),
      fixture: lang === 'es' ? 'home-health-es' : 'home-health',
      maxTokens: 300,
    });
    if (!out.data.isHomeSystem) return apiError('not_a_system', NOT_A_SYSTEM[lang], 422);
    const res = resolveSystem({ kind, read: out.data });
    return NextResponse.json({ ...res, source: out.source });
  }
  const parsed = await parseBody(req, Typed);
  if ('error' in parsed) return parsed.error;
  const { kind, ageYears, installYear } = parsed.data;
  // typed facts need no model: the rules answer directly
  return NextResponse.json({ ...resolveSystem({ kind, ageYears: ageYears ?? null, installYear: installYear ?? null }), source: 'rules' });
}
