// Outreach drafts and match reasons (§5). Templates are the rules fallback when Claude is unavailable.
import { z } from 'zod';
import { money, monthName } from './format';
import { LangSchema } from './schemas';
import type { Lang, ReadinessResult } from './types';

const ACTION_ES: Record<string, (target: string) => string> = {
  collections: () => 'Ponga cada dólar extra en las cuentas en cobranza primero y pida a la agencia una carta de "pay-for-delete".',
  credit: () => 'Mantenga los saldos de sus tarjetas por debajo del 30% del límite y pague todas sus cuentas a tiempo.',
  savings: (t) => `Siga ahorrando hasta llegar a ${t} para el enganche y los gastos de cierre.`,
  orientation: () => 'Inscríbase en una orientación para compradores de vivienda de Habitat OC.',
};

/** The family's single next action: the earliest unfinished money milestone, else orientation. */
export function nextActionFor(r: ReadinessResult, lang: Lang): string {
  const m =
    r.milestones.find((x) => x.month > 0 && (x.key === 'collections' || x.key === 'credit' || x.key === 'savings')) ?? r.milestones.find((x) => x.key === 'orientation');
  const key = m?.key ?? 'orientation';
  if (lang === 'es') return (ACTION_ES[key] ?? ACTION_ES.orientation)(money(r.downPaymentTarget, 'es'));
  return m?.action ?? 'Sign up for a Habitat OC homeownership orientation.';
}

export const HomeInputSchema = z.object({
  id: z.string().max(20),
  address: z.string().max(120),
  city: z.string().max(60),
  bedrooms: z.number().int().min(0).max(10),
  completion: z.string().regex(/^\d{4}-\d{2}$/),
});

export const OutreachInput = z.object({
  family: z.object({
    surname: z.string().min(1).max(60),
    givenName: z.string().max(60).optional().default(''),
    householdSize: z.number().int().min(1).max(8),
    readyDate: z.string().regex(/^\d{4}-\d{2}$/),
    monthsToReady: z.number().int().min(0).max(120),
    nextAction: z.string().max(300),
  }),
  home: HomeInputSchema,
  lang: LangSchema,
});
export type OutreachInput = z.infer<typeof OutreachInput>;

export const OutreachDraft = z.object({ subject: z.string().min(1).max(200), body: z.string().min(1).max(1500) });
export type OutreachDraft = z.infer<typeof OutreachDraft>;

export function outreachTemplate({ family: f, home, lang }: OutreachInput): OutreachDraft {
  const when = monthName(home.completion, lang);
  const ready = monthName(f.readyDate, lang);
  const hi = f.givenName ? `${f.givenName}` : '';
  if (lang === 'es') {
    return {
      subject: `Una casa de Habitat en ${home.city} para la familia ${f.surname}`,
      body: `Hola${hi ? ` ${hi}` : ''}, familia ${f.surname}:\n\nLe escribe el equipo de Habitat OC. Estamos construyendo una casa de ${home.bedrooms} recámaras en ${home.city} que estará lista en ${when}. ${
        f.monthsToReady === 0 ? 'Según su plan, ustedes ya están listos para solicitar.' : `Según su plan, podrían estar listos para ${ready}.`
      }\n\nSu siguiente paso: ${f.nextAction}\n\nResponda a este mensaje si tiene preguntas. Estamos para ayudarle.\n\nHabitat for Humanity of Orange County`,
    };
  }
  return {
    subject: `A Habitat home in ${home.city} for the ${f.surname} family`,
    body: `Hi${hi ? ` ${hi}` : ''} and the ${f.surname} family,\n\nThis is the Habitat OC team. We're building a ${home.bedrooms}-bedroom home in ${home.city} that will be done in ${when}. ${
      f.monthsToReady === 0 ? 'Your plan says you are ready to apply now.' : `Your plan says you could be ready by ${ready}.`
    }\n\nYour next step: ${f.nextAction}\n\nReply to this message with any questions. We're glad to help.\n\nHabitat for Humanity of Orange County`,
  };
}

/** Fill {surname}, {givenName}, {city}, {bedrooms}, {completion}, {readyDate}, {nextAction} placeholders (fixtures). */
export function fillPlaceholders(text: string, input: OutreachInput): string {
  const { family: f, home, lang } = input;
  const vars: Record<string, string> = {
    surname: f.surname,
    givenName: f.givenName || f.surname,
    city: home.city,
    bedrooms: String(home.bedrooms),
    completion: monthName(home.completion, lang as Lang),
    readyDate: monthName(f.readyDate, lang as Lang),
    nextAction: f.nextAction,
  };
  return text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

export const MatchReasonInput = z.object({
  home: HomeInputSchema,
  candidates: z
    .array(
      z.object({
        code: z.string().max(12),
        householdSize: z.number().int().min(1).max(8),
        tier: z.string().max(20),
        readyDate: z.string().regex(/^\d{4}-\d{2}$/),
        monthsToReady: z.number().int().min(0).max(120),
        monthsSpare: z.number().int().min(-200).max(200),
        topBlocker: z.string().max(200).optional(),
        fallback: z.string().max(300),
      }),
    )
    .max(30),
});
export type MatchReasonInput = z.infer<typeof MatchReasonInput>;
export const MatchReasons = z.object({ reasons: z.array(z.object({ code: z.string(), reason: z.string().min(1).max(240) })) });
