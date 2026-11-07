// Staff KEEP console: the Homeowner Early Warning table, Shock Shield moves, Home Health, the outreach template and
// the Monday digest's change detection. Pure and deterministic: every number comes from lib/forecast.ts; Claude only
// writes the words around them (app/api/outreach/homeowner, app/api/digest).
import { z } from 'zod';
import { assessRisk, forecast, remainingYears, RISK_ORDER, thisMonth, type Forecast, type Risk, type RiskLevel, type Shock, type ShockCause, type StressControls, type StressHome, type StressResult } from './forecast';
import type { HomeSystem, KeepProfile, SystemKind } from './keep';
import { money, monthName } from './format';
import { seedHomeowners, type SeedHomeowner } from './seedHomeowners';
import type { Lang } from './types';

const DAY = 86_400_000;
/** A check-in older than this is missed (lib/forecast.ts assessRisk uses the same 45 days). */
export const CHECKIN_MISSED_DAYS = 45;

export const RISK_LABEL: Record<RiskLevel, string> = { act: 'Act now', watch: 'Watch', stable: 'Stable' };
export const RISK_LABEL_ES: Record<RiskLevel, string> = { act: 'Actuar ya', watch: 'Vigilar', stable: 'Estable' };
export const CAUSE_LABEL: Record<ShockCause, string> = { insurance: 'Insurance renewal', tax: 'Property tax in escrow', supplemental: 'Supplemental tax bill', hoa: 'HOA dues' };
const CAUSE_ES: Record<ShockCause, string> = { insurance: 'la renovación del seguro', tax: 'el impuesto predial en el escrow', supplemental: 'una factura suplementaria de impuestos', hoa: 'las cuotas de la HOA' };
export const HOME_TYPE_LABEL: Record<KeepProfile['homeType'], string> = { single: 'Single-family', townhome: 'Townhome', condo: 'Condo' };
export const SYSTEM_LABEL: Record<SystemKind, string> = { water_heater: 'Water heater', roof: 'Roof', hvac: 'Heating and cooling', appliances: 'Appliances', other: 'Other' };

/** Money with a true minus sign for negative breathing room (−$9, not -$9). */
export const usd = (n: number) => money(n).replace('-', '\u2212');

export const lastCheckinISO = (today: Date, daysAgo: number) => new Date(today.getTime() - Math.max(0, daysAgo) * DAY).toISOString();

export type HomeownerRow = {
  id: string;
  code: string;
  surname: string;
  givenName: string;
  city: string;
  address: string;
  language: Lang;
  householdSize: number;
  homeType: KeepProfile['homeType'];
  insurer: string;
  fairPlan: boolean;
  checkinDaysAgo: number;
  lastCheckin: string;
  movesDone: string[];
  profile: KeepProfile;
  risk: Risk;
  /** the first shock in the 24-month forecast (may be after the 6-month risk window) */
  nextShock: Shock | null;
  /** the lowest breathing room in the next 6 months */
  low6: number;
};

/** Risk-first order: Act now, then Watch, then Stable; within a level the thinnest cushion in 6 months first. */
export function byRisk(a: HomeownerRow, b: HomeownerRow) {
  return RISK_ORDER[b.risk.level] - RISK_ORDER[a.risk.level] || a.low6 - b.low6 || a.surname.localeCompare(b.surname);
}

export function rowFor(h: SeedHomeowner, today: Date): HomeownerRow {
  const start = thisMonth(today);
  const lastCheckin = lastCheckinISO(today, h.checkinDaysAgo);
  const risk = assessRisk(h.profile, { start, today, lastCheckin });
  const f = forecast(h.profile, { start });
  const low6 = f.months.slice(0, 7).reduce((m, x) => Math.min(m, x.breathing), Infinity);
  return {
    id: h.id,
    code: h.code,
    surname: h.surname,
    givenName: h.givenName,
    city: h.city,
    address: h.address,
    language: h.language,
    householdSize: h.profile.householdSize,
    homeType: h.profile.homeType,
    insurer: h.profile.insurer,
    fairPlan: h.profile.fairPlan,
    checkinDaysAgo: h.checkinDaysAgo,
    lastCheckin,
    movesDone: h.movesDone,
    profile: h.profile,
    risk,
    nextShock: f.first,
    low6: Math.round(Number.isFinite(low6) ? low6 : 0),
  };
}

/** Every sample homeowner, assessed as of `today`, sorted by risk of payment stress in the next 6 months. */
export function homeownerRows(today = new Date()): HomeownerRow[] {
  return seedHomeowners(today)
    .map((h) => rowFor(h, today))
    .sort(byRisk);
}

export function findHomeowner(id: string, today = new Date()): HomeownerRow | null {
  const h = seedHomeowners(today).find((x) => x.id === id);
  return h ? rowFor(h, today) : null;
}

export function riskCounts(rows: Pick<HomeownerRow, 'risk'>[]): Record<RiskLevel, number> {
  const c: Record<RiskLevel, number> = { act: 0, watch: 0, stable: 0 };
  for (const r of rows) c[r.risk.level]++;
  return c;
}

/** The homes the stress test runs over (same households, same check-in dates as the Early Warning table). */
export function stressHomes(today = new Date()): StressHome[] {
  return seedHomeowners(today).map((h) => ({ id: h.id, profile: h.profile, lastCheckin: lastCheckinISO(today, h.checkinDaysAgo) }));
}

/** "Insurance renewal in March 2027 adds $69 a month." */
export function shockSentence(s: Shock | null, lang: Lang = 'en'): string {
  if (!s) return lang === 'es' ? 'No se ve ningún aumento grande en los próximos 24 meses.' : 'No big rise in the next 24 months.';
  if (lang === 'es') return `En ${monthName(s.month, 'es')}, ${CAUSE_ES[s.cause]} sube el pago unos ${money(s.delta, 'es')} al mes.`;
  return `${CAUSE_LABEL[s.cause]} in ${monthName(s.month)} adds ${money(s.delta)} a month.`;
}

/* ------------------------------------------------------------------ */
/* Shock Shield moves (derived from the profile, never from Claude)     */
/* ------------------------------------------------------------------ */
export type MoveKey = 'shop' | 'exemption' | 'careFera' | 'setAside' | 'talk';
export type Move = { key: MoveKey; title: string; detail: string; done: boolean; es: string };

/** California CARE income limits (2025–26, annual, by household size): 1–2 people $42,300, +$11,000 per person after 3. */
export function careLimit(size: number) {
  const n = Math.max(1, Math.min(8, Math.round(size || 1)));
  return n <= 2 ? 42300 : 53300 + (n - 3) * 11000;
}
/** FERA: households of 3 or more a little above the CARE limit (up to 250% of the federal poverty line ≈ 1.25× CARE). */
export const feraLimit = (size: number) => (size >= 3 ? Math.round(careLimit(size) * 1.25) : 0);

/** Homeowners' Exemption: $7,000 off the assessed value at about a 1.06% rate. */
export const EXEMPTION_MONTHLY = Math.round((7000 * 0.0106) / 12);

export function shieldMoves(row: Pick<HomeownerRow, 'profile' | 'movesDone' | 'nextShock'>, f?: Forecast): Move[] {
  const p = row.profile;
  const fc = f ?? forecast(p);
  const done = (k: MoveKey) => row.movesDone.includes(k);
  const moves: Move[] = [];
  const renewal = fc.shocks.find((s) => s.cause === 'insurance');
  moves.push({
    key: 'shop',
    title: p.fairPlan ? 'Shop the FAIR Plan renewal and ask for the wildfire discount' : 'Shop the insurance renewal and ask for the wildfire discount',
    detail: `${p.insurer || 'Current insurer'}${renewal ? `, renews ${monthName(renewal.month)} (about ${money(renewal.premiumChange)} more a year)` : ''}. Home-hardening steps can qualify for a Safer from Wildfires discount.`,
    es: 'Comparar el seguro antes de la renovación y pedir el descuento por protección contra incendios',
    done: done('shop'),
  });
  moves.push({
    key: 'exemption',
    title: "File the Homeowners' Exemption",
    detail: `One form with the County Assessor takes $7,000 off the assessed value: about ${money(EXEMPTION_MONTHLY)} a month less in escrow.`,
    es: 'Solicitar la exención para propietarios (Homeowners’ Exemption)',
    done: done('exemption') || !!p.homeownersExemption,
  });
  const income = Math.max(0, p.income || 0);
  if (income > 0 && (income <= careLimit(p.householdSize) || income <= feraLimit(p.householdSize))) {
    const care = income <= careLimit(p.householdSize);
    moves.push({
      key: 'careFera',
      title: care ? 'Enroll in CARE for the utility bill' : 'Enroll in FERA for the utility bill',
      detail: care
        ? `Household income ${money(income)} is under the CARE limit (${money(careLimit(p.householdSize))}): 30–35% off electricity, 20% off gas.`
        : `Household income ${money(income)} is under the FERA limit (${money(feraLimit(p.householdSize))}): 18% off electricity.`,
      es: care ? 'Inscribirse en CARE para bajar la factura de luz y gas' : 'Inscribirse en FERA para bajar la factura de luz',
      done: done('careFera') || !!p.careFera,
    });
  }
  if (fc.recommendedSetAside > 0) {
    moves.push({
      key: 'setAside',
      title: `Set aside ${money(fc.recommendedSetAside)} a month`,
      detail: `The smallest monthly amount that keeps every rise in the next 12 months under $5.${p.setAside > 0 ? ` Setting aside ${money(p.setAside)} now.` : ''}`,
      es: `Apartar ${money(fc.recommendedSetAside, 'es')} al mes`,
      done: done('setAside') || p.setAside >= fc.recommendedSetAside,
    });
  }
  moves.push({
    key: 'talk',
    title: 'Talk with Habitat before the change',
    detail: row.nextShock ? `${shockSentence(row.nextShock)} A short call now beats a missed payment later.` : 'A short call to go over the year ahead.',
    es: 'Hablar con Habitat antes del cambio',
    done: done('talk'),
  });
  return moves;
}

/** The single next step for outreach: the first move not done (never "talk", which is the outreach itself). */
export function nextStep(moves: Move[]): Move {
  return moves.find((m) => !m.done && m.key !== 'talk') ?? moves[moves.length - 1];
}

/* ------------------------------------------------------------------ */
/* Home Health                                                          */
/* ------------------------------------------------------------------ */
export type HealthItem = { id: string; label: string; ageYears: number; lifeYears: number; remaining: number; costLow: number; costHigh: number; dueSoon: boolean };
/** Due soon = 2 years or less of typical life left. */
export function homeHealth(systems: HomeSystem[]): HealthItem[] {
  return systems
    .map((s) => {
      const remaining = remainingYears(s);
      return { id: s.id, label: s.label || SYSTEM_LABEL[s.kind], ageYears: s.ageYears, lifeYears: s.lifeYears, remaining, costLow: s.costLow, costHigh: s.costHigh, dueSoon: remaining <= 2 };
    })
    .sort((a, b) => a.remaining - b.remaining);
}

/* ------------------------------------------------------------------ */
/* Outreach (homeowner)                                                 */
/* ------------------------------------------------------------------ */
export const HomeownerOutreachInput = z.object({ id: z.string().regex(/^ho\d{2}$/), lang: z.enum(['en', 'es']).optional() });
export const HomeownerOutreachDraft = z.object({
  subject: z.string().min(1).max(200),
  /** in the family's language */
  body: z.string().min(1).max(1500),
  /** English translation for staff (only when the body is Spanish) */
  translation: z.string().max(1500).optional(),
});
export type HomeownerOutreachDraft = z.infer<typeof HomeownerOutreachDraft>;

export type OutreachFacts = {
  surname: string;
  givenName: string;
  lang: Lang;
  level: RiskLevel;
  shock: Shock | null;
  now: number;
  in6: number;
  step: Move;
  missedCheckin: boolean;
};

export function outreachFacts(row: HomeownerRow, lang: Lang = row.language): OutreachFacts {
  const moves = shieldMoves(row);
  return { surname: row.surname, givenName: row.givenName, lang, level: row.risk.level, shock: row.nextShock, now: row.risk.now, in6: row.risk.in6, step: nextStep(moves), missedCheckin: row.risk.missedCheckin };
}

function stepText(step: Move, lang: Lang) {
  return lang === 'es' ? step.es : step.title;
}

function bodyEn(x: OutreachFacts) {
  const change = x.shock ? `We see a change coming: ${CAUSE_LABEL[x.shock.cause].toLowerCase()} in ${monthName(x.shock.month)} adds about ${money(x.shock.delta)} a month to the house payment.` : 'We looked at the year ahead for your home together with your numbers.';
  return `Hi ${x.givenName},\n\nThis is the Habitat OC team checking in on the ${x.surname} family home. ${change} Nothing is wrong, and you have time to get ready.\n\nOne step that helps most right now: ${stepText(x.step, 'en').replace(/^./, (c) => c.toLowerCase())}. Reply to this message or call us and we'll do it with you.\n\nHabitat for Humanity of Orange County`;
}
function bodyEs(x: OutreachFacts) {
  const change = x.shock ? `Vemos un cambio que viene: en ${monthName(x.shock.month, 'es')}, ${CAUSE_ES[x.shock.cause]} sube el pago de la casa unos ${money(x.shock.delta, 'es')} al mes.` : 'Revisamos el año que viene para su casa junto con sus números.';
  return `Hola, ${x.givenName}:\n\nLe escribe el equipo de Habitat OC para saber cómo está la casa de la familia ${x.surname}. ${change} No hay ningún problema y hay tiempo para prepararse.\n\nUn paso que ayuda mucho ahora: ${stepText(x.step, 'es').replace(/^./, (c) => c.toLowerCase())}. Responda a este mensaje o llámenos y lo hacemos con usted.\n\nHabitat for Humanity of Orange County`;
}

/** Deterministic outreach note (the rules fallback): warm, under 120 words, one next step. */
export function homeownerOutreachTemplate(x: OutreachFacts): HomeownerOutreachDraft {
  if (x.lang === 'es') return { subject: `La casa de la familia ${x.surname}: el año que viene`, body: bodyEs(x), translation: bodyEn(x) };
  return { subject: `The ${x.surname} family home: the year ahead`, body: bodyEn(x) };
}

/** Fill {surname}, {givenName}, {shock}, {step}, {stepEn} placeholders (fixtures). */
export function fillOutreach(text: string, x: OutreachFacts, lang: Lang = x.lang): string {
  const vars: Record<string, string> = {
    surname: x.surname,
    givenName: x.givenName,
    shock: shockSentence(x.shock, lang),
    shockEn: shockSentence(x.shock, 'en'),
    step: stepText(x.step, lang).replace(/^./, (c) => c.toLowerCase()),
    stepEn: stepText(x.step, 'en').replace(/^./, (c) => c.toLowerCase()),
  };
  return text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** A model draft is usable when it names the family and stays under 120 words (body and translation). */
const fold = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** A usable draft names the family (accents aside: "Ramírez" is "Ramirez") and stays short; a missing translation is filled by the caller. */
export function draftOk(d: HomeownerOutreachDraft, x: OutreachFacts) {
  return fold(d.body).includes(fold(x.surname)) && wordCount(d.body) <= 120 && (!d.translation || wordCount(d.translation) <= 130);
}

/* ------------------------------------------------------------------ */
/* Monday digest: what changed since last week                          */
/* ------------------------------------------------------------------ */
export type DigestChangeKind = 'shock' | 'breathing' | 'checkin' | 'milestone';
export type DigestChange = { kind: DigestChangeKind; text: string };

/**
 * Last week's snapshot is derived, not stored: the same household seven days ago, with this week's known events
 * undone. These events are fixed per household (sample data), so the digest reads the same every run.
 *  - BREATHING: take-home was higher last week (hours cut, a benefit ended) by this many dollars a month.
 *  - MILESTONE: the move the family finished this week.
 */
const WEEK_DIP: Record<string, { amount: number; why: string }> = {
  ho07: { amount: 140, why: 'fewer work hours' },
  ho14: { amount: 90, why: 'a childcare benefit ended' },
  ho27: { amount: 120, why: 'fewer work hours' },
  ho32: { amount: 75, why: 'a second job ended' },
  ho35: { amount: 110, why: 'fewer work hours' },
};
const WEEK_MILESTONE: Record<string, { move: MoveKey; text: string; es: string }> = {
  ho02: { move: 'exemption', text: "Filed the Homeowners' Exemption", es: 'solicitaron la exención para propietarios' },
  ho10: { move: 'shop', text: 'Got two new insurance quotes before the renewal', es: 'consiguieron dos cotizaciones nuevas de seguro antes de la renovación' },
  ho22: { move: 'setAside', text: 'Started the monthly set-aside', es: 'empezaron a apartar dinero cada mes' },
  ho34: { move: 'careFera', text: 'Enrolled in CARE', es: 'se inscribieron en CARE' },
};
/** A drop in breathing room this large ($/month) is worth a line in the digest. */
export const BREATHING_DROP = 50;
const SHOCK_WINDOW_DAYS = 90;

function daysUntilMonth(iso: string, from: Date) {
  const [y, m] = iso.split('-').map(Number);
  return (Date.UTC(y, m - 1, 1) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / DAY;
}

export function digestChanges(row: HomeownerRow, today: Date): DigestChange[] {
  const out: DigestChange[] = [];
  const lastWeek = new Date(today.getTime() - 7 * DAY);
  // a shock that moved inside the 90-day window this week
  const f = forecast(row.profile, { start: thisMonth(today) });
  const soon = f.shocks.find((s) => daysUntilMonth(s.month, today) <= SHOCK_WINDOW_DAYS && daysUntilMonth(s.month, today) >= 0);
  if (soon && daysUntilMonth(soon.month, lastWeek) > SHOCK_WINDOW_DAYS) out.push({ kind: 'shock', text: `${shockSentence(soon)} That is now within 90 days.` });
  // breathing room vs last week's snapshot
  const dip = WEEK_DIP[row.id];
  if (dip) {
    const before = assessRisk({ ...row.profile, takeHome: row.profile.takeHome + dip.amount }, { start: thisMonth(lastWeek), today: lastWeek, lastCheckin: row.lastCheckin });
    const drop = before.now - row.risk.now;
    if (drop >= BREATHING_DROP) out.push({ kind: 'breathing', text: `Breathing room fell from ${money(before.now)} to ${money(row.risk.now)} a month (${dip.why}).` });
  }
  // a check-in that became missed this week
  if (row.checkinDaysAgo > CHECKIN_MISSED_DAYS && row.checkinDaysAgo - 7 <= CHECKIN_MISSED_DAYS) out.push({ kind: 'checkin', text: `Missed the monthly check-in: the last one was ${row.checkinDaysAgo} days ago.` });
  const ms = WEEK_MILESTONE[row.id];
  if (ms) out.push({ kind: 'milestone', text: `${ms.text} this week.` });
  return out;
}

export const DigestDraftSchema = z.object({
  summary: z.string().min(1).max(400),
  draft: z.object({ es: z.string().max(1200).optional(), en: z.string().min(1).max(1200) }),
});
export type DigestDraft = z.infer<typeof DigestDraftSchema>;

export type DigestLine = {
  id: string;
  household: string;
  surname: string;
  language: Lang;
  level: RiskLevel;
  changes: DigestChange[];
  summary: string;
  draft: { es?: string; en: string };
  source: 'claude' | 'mock' | 'fallback';
};

/** Rules fallback for one household's digest entry. */
export function digestTemplate(row: HomeownerRow, changes: DigestChange[]): DigestDraft {
  const x = outreachFacts(row);
  const lead = changes.find((c) => c.kind !== 'milestone') ?? changes[0];
  const milestoneOnly = changes.every((c) => c.kind === 'milestone');
  const summary = milestoneOnly
    ? `${row.surname} (${RISK_LABEL[row.risk.level].toLowerCase()}): ${lead.text} Send a short thank-you.`
    : `${row.surname} (${RISK_LABEL[row.risk.level].toLowerCase()}): ${lead.text} Suggested step: ${x.step.title.toLowerCase()}.`;
  const en = milestoneOnly
    ? `Hi ${row.givenName}, this is the Habitat OC team. We saw that you ${lead.text.replace(/ this week\.$/, '').replace(/^./, (c) => c.toLowerCase())}. Thank you, that protects your home. Reply any time if you'd like help with the next step.`
    : `Hi ${row.givenName}, this is the Habitat OC team checking in on the ${row.surname} family home. ${x.shock ? shockSentence(x.shock) : ''} One step that helps now: ${x.step.title.replace(/^./, (c) => c.toLowerCase())}. Reply and we'll do it with you.`.replace(/\s+/g, ' ');
  if (row.language !== 'es') return { summary, draft: { en } };
  const es = milestoneOnly
    ? `Hola, ${row.givenName}. Le escribe el equipo de Habitat OC. Vimos que esta semana ${WEEK_MILESTONE[row.id]?.es ?? 'dieron un paso importante para su casa'}. Gracias, eso protege su hogar. Responda cuando quiera si desea ayuda con el siguiente paso.`
    : `Hola, ${row.givenName}. Le escribe el equipo de Habitat OC sobre la casa de la familia ${row.surname}. ${x.shock ? shockSentence(x.shock, 'es') : ''} Un paso que ayuda ahora: ${x.step.es.replace(/^./, (c) => c.toLowerCase())}. Responda y lo hacemos con usted.`.replace(/\s+/g, ' ');
  return { summary, draft: { es, en } };
}

export function fillDigest(text: string, row: HomeownerRow, changes: DigestChange[], lang: Lang): string {
  const x = outreachFacts(row);
  const vars: Record<string, string> = {
    surname: row.surname,
    givenName: row.givenName,
    level: RISK_LABEL[row.risk.level].toLowerCase(),
    change: changes[0]?.text ?? '',
    step: (lang === 'es' ? x.step.es : x.step.title).replace(/^./, (c) => c.toLowerCase()),
    stepEn: x.step.title.replace(/^./, (c) => c.toLowerCase()),
  };
  return text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

/* ------------------------------------------------------------------ */
/* Portfolio stress test headline                                       */
/* ------------------------------------------------------------------ */
const round100 = (n: number) => Math.round(n / 100) * 100;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The funder headline, computed from the stress test (never written by hand). */
export function stressHeadline(c: StressControls, r: StressResult, total: number): { shock: string; support: string } {
  const pct = Math.round(c.insuranceIncrease * 100);
  const cause = pct > 0 ? `A ${pct}% insurance jump${c.supplemental ? ' with supplemental tax bills' : ''}` : c.supplemental ? 'Supplemental tax bills' : 'With no insurance increase, today’s costs';
  const shock = `${cause} ${pct > 0 ? 'puts' : 'put'} ${r.atRiskBefore} of ${total} homeowners at risk.`;
  const parts: string[] = [];
  if (c.hardshipFund > 0) parts.push(`a ${money(c.hardshipFund)} interest-free hardship fund per family`);
  if (c.matchedRepair > 0) parts.push(`a ${money(c.matchedRepair)}/month matched repair fund`);
  if (!parts.length) return { shock, support: 'Add a hardship fund or matched repair savings to see how many stay stable.' };
  const what = cap(parts.join(' and '));
  if (r.atRiskAfter >= r.atRiskBefore) return { shock, support: `${what} doesn’t change that count yet.` };
  return { shock, support: `${what} brings that to ${r.atRiskAfter}, protecting about ${money(round100(r.dollarsProtected))} a year in payments that fund the next homes.` };
}

