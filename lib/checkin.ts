// D7 Monday check-in: snapshot each shared family's readiness, diff against last week's, explain changes.
import { z } from 'zod';
import { computeReadiness, isEligible, monthsUntil } from './engine';
import { homeFits } from './homes';
import { money, monthName } from './format';
import type { Home, Lang, Profile } from './types';

export type Snapshot = { monthsToReady: number; reached: string[]; ticked: number; stalled: boolean; homes: string[] };

export function snapshotOf(profile: Profile, checklist: Record<string, boolean>, lastActivity: Date, homes: Home[], now = new Date()): Snapshot {
  const r = computeReadiness(profile, { today: now });
  return {
    monthsToReady: r.monthsToReady,
    reached: r.milestones.filter((m) => m.month === 0 && m.key !== 'orientation' && m.key !== 'application').map((m) => m.key),
    ticked: Object.values(checklist).filter(Boolean).length,
    stalled: now.getTime() - lastActivity.getTime() > 30 * 86400000,
    homes: isEligible(r) ? homes.filter((h) => homeFits(profile.householdSize, h.bedrooms) && r.monthsToReady <= monthsUntil(h.completion, now)).map((h) => h.id) : [],
  };
}

export type Change = { kind: 'milestone' | 'progress' | 'stalled' | 'home' | 'date'; text: string };

export function diff(prev: Snapshot | null, cur: Snapshot, homes: Home[]): Change[] {
  if (!prev) return [];
  const out: Change[] = [];
  for (const k of cur.reached) if (!prev.reached.includes(k)) out.push({ kind: 'milestone', text: `Reached: ${k === 'savings' ? 'down payment saved' : k === 'credit' ? 'credit at 640' : k === 'collections' ? 'collections cleared' : k}` });
  if (cur.ticked > prev.ticked) out.push({ kind: 'progress', text: `Ticked ${cur.ticked - prev.ticked} plan ${cur.ticked - prev.ticked === 1 ? 'item' : 'items'} since last week` });
  if (cur.monthsToReady < prev.monthsToReady) out.push({ kind: 'date', text: `Ready date moved ${prev.monthsToReady - cur.monthsToReady} months earlier` });
  if (cur.stalled && !prev.stalled) out.push({ kind: 'stalled', text: 'No activity in 30+ days' });
  const newHomes = cur.homes.filter((id) => !prev.homes.includes(id)).map((id) => homes.find((x) => x.id === id)).filter((h): h is Home => !!h);
  if (newHomes.length) {
    const h = newHomes.sort((a, b) => a.completion.localeCompare(b.completion))[0];
    const more = newHomes.length > 1 ? ` and ${newHomes.length - 1} more` : '';
    out.push({ kind: 'home', text: `Now on track for the ${h.city} ${h.bedrooms}BR (done ${monthName(h.completion, 'en', true)})${more}` });
  }
  return out;
}

export const DigestSchema = z.object({ digest: z.array(z.string()).min(1).max(3), nudge: z.string().min(1).max(700) });
export type Digest = z.infer<typeof DigestSchema>;

export const CHECKIN_SYSTEM = `You help Habitat for Humanity of Orange County staff do a weekly check-in on families working toward a Habitat mortgage.
Given one family's changes this week and their engine numbers, return ONLY JSON: {"digest": [up to 3 short lines for staff, in English, each under 18 words], "nudge": "a warm text message to the family in THEIR language (Spanish uses usted), under 60 words, with exactly one next action, signed 'Habitat OC'"}.
Never invent numbers; use only those given. No emoji, no exclamation marks.`;

export function fallbackDigest(name: string, lang: Lang, changes: Change[], months: number, nextAction: string): Digest {
  const digest = changes.slice(0, 2).map((c) => c.text);
  digest.push(months === 0 ? 'Mortgage-ready now; invite to apply.' : `Projected ready in ${months} months.`);
  const stalled = changes.some((c) => c.kind === 'stalled');
  const nudge =
    lang === 'es'
      ? stalled
        ? `Hola, familia ${name}. Hace tiempo que no sabemos de ustedes y queremos ayudar. Su siguiente paso: ${nextAction} Responda a este mensaje si necesita algo. Habitat OC`
        : `Hola, familia ${name}. Vimos su avance esta semana, muy bien hecho. Su siguiente paso: ${nextAction} Habitat OC`
      : stalled
        ? `Hi ${name} family, we haven't heard from you in a while and we're here to help. Your next step: ${nextAction} Reply to this text if anything is in the way. Habitat OC`
        : `Hi ${name} family, we saw your progress this week. Nice work. Your next step: ${nextAction} Habitat OC`;
  return { digest: digest.slice(0, 3), nudge };
}

export const nextActionText = (profile: Profile, lang: Lang) => {
  const r = computeReadiness(profile);
  const top = r.milestones.find((m) => m.month > 0 && m.key !== 'keys');
  if (!top) return lang === 'es' ? 'inscríbase a la próxima orientación de Habitat OC.' : 'sign up for the next Habitat OC orientation.';
  if (top.key === 'savings') return lang === 'es' ? `siga ahorrando hacia su meta de ${money(r.downPaymentTarget, 'es')}.` : `keep saving toward your ${money(r.downPaymentTarget)} goal.`;
  if (top.key === 'collections') return lang === 'es' ? 'llame a la agencia de cobranza esta semana.' : 'call the collection agency this week.';
  return lang === 'es' ? 'reserve su asesoría de crédito gratis con SparkPoint OC.' : 'book your free credit coaching session with SparkPoint OC.';
};
