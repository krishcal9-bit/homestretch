// D5 counselor handoff: the data on the one-page referral packet. Every number comes from the engine.
import { addMonths, computeReadiness, isEligible } from './engine';
import { money, monthName, pct } from './format';
import type { Lang, MilestoneKey, Profile } from './types';

export type ReferralOrg = 'sparkpoint' | 'hope';
export const ORG_NAME: Record<ReferralOrg, string> = { sparkpoint: 'SparkPoint OC', hope: 'Operation HOPE' };

export type ReferralPacket = {
  lang: Lang;
  org: ReferralOrg;
  orgName: string;
  title: string;
  familyName: string;
  code?: string;
  generated: string;
  readyLabel: string;
  readyDate: string;
  labels: { household: string; blockers: string; timeline: string; habitat: string; footer: string };
  household: { label: string; value: string }[];
  blockers: string[];
  timeline: { label: string; date: string; action: string }[];
  habitatNeeds: string[];
};

const T = {
  en: {
    title: (org: string) => `Referral to ${org}`,
    family: 'Family',
    ready: 'Projected mortgage-ready',
    household: 'Household summary',
    blockers: 'What to work on first',
    timeline: 'Timeline from the Keystone engine',
    habitat: 'What Habitat OC needs to see at the end',
    footer: 'Prepared with Keystone for Habitat for Humanity of Orange County. Estimates only; not a credit decision.',
    size: 'Household size',
    income: 'Gross monthly income',
    rent: 'Monthly rent',
    burden: 'Share of income on rent',
    savings: 'Savings today',
    target: 'Down payment and closing goal',
    debts: 'Monthly debt payments',
    credit: 'Credit standing',
    eligible: 'Habitat OC eligibility',
    yes: 'Meets need, income and residency',
    no: 'Not yet eligible',
    people: (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`,
    now: 'Now',
    noBlockers: 'No blockers on record. Keep paying every bill on time.',
    credits: { good: 'Good', building: 'Building', needs_work: 'Needs work', unknown: 'Not checked yet' },
    milestones: { collections: 'Collections cleared', credit: 'Credit at 640', savings: 'Down payment saved', orientation: 'Orientation', application: 'Application', keys: 'Keys' },
    needs: (target: string) => [
      'Credit score of 640 or higher, with no open collections.',
      `${target} saved for the down payment and closing costs.`,
      'Debt payments under 43% of gross income.',
      'Two months of pay stubs and bank statements, and the last two years of tax returns.',
      'A signed referral note from the counselor confirming the work above.',
    ],
  },
  es: {
    title: (org: string) => `Referencia a ${org}`,
    family: 'Familia',
    ready: 'Lista para la hipoteca, según la proyección',
    household: 'Resumen del hogar',
    blockers: 'Qué trabajar primero',
    timeline: 'Calendario del motor de Keystone',
    habitat: 'Lo que Habitat OC necesita ver al final',
    footer: 'Preparado con Keystone para Habitat for Humanity of Orange County. Solo son estimaciones; no es una decisión de crédito.',
    size: 'Personas en el hogar',
    income: 'Ingreso mensual bruto',
    rent: 'Renta mensual',
    burden: 'Parte del ingreso que va a la renta',
    savings: 'Ahorros hoy',
    target: 'Meta de enganche y gastos de cierre',
    debts: 'Pagos mensuales de deudas',
    credit: 'Situación de crédito',
    eligible: 'Elegibilidad para Habitat OC',
    yes: 'Cumple necesidad, ingresos y residencia',
    no: 'Todavía no es elegible',
    people: (n: number) => `${n} ${n === 1 ? 'persona' : 'personas'}`,
    now: 'Ahora',
    noBlockers: 'No hay obstáculos registrados. Siga pagando todas sus cuentas a tiempo.',
    credits: { good: 'Bueno', building: 'En construcción', needs_work: 'Necesita trabajo', unknown: 'Sin revisar' },
    milestones: { collections: 'Cobranzas saldadas', credit: 'Crédito en 640', savings: 'Enganche ahorrado', orientation: 'Orientación', application: 'Solicitud', keys: 'Llaves' },
    needs: (target: string) => [
      'Puntaje de crédito de 640 o más, sin cuentas en cobranza abiertas.',
      `${target} ahorrados para el enganche y los gastos de cierre.`,
      'Pagos de deudas por debajo del 43% del ingreso bruto.',
      'Dos meses de talones de pago y estados de cuenta, y las declaraciones de impuestos de los últimos dos años.',
      'Una nota de referencia firmada por el consejero que confirme el trabajo anterior.',
    ],
  },
} as const;

const BLOCKER_ES: Record<string, string> = {
  residency: 'Habitat OC requiere vivir o trabajar en el condado de Orange y ser ciudadano o residente permanente.',
  income_high: 'El ingreso está por encima de los límites de Habitat OC.',
  income_low: 'El ingreso está por debajo del mínimo.',
  collections: 'Hay cuentas en cobranza que deben saldarse primero.',
  credit: 'El crédito necesita meses de reconstrucción: saldos de tarjetas bajo el 30% y pagos a tiempo.',
  credit_unknown: 'Revise su reporte de crédito gratis en annualcreditreport.com esta semana.',
  savings: 'Falta ahorrar para el enganche y los gastos de cierre.',
  dti: 'Los pagos de deudas son una parte alta del ingreso; los prestamistas buscan menos del 43%.',
  need: 'Todavía no hay una necesidad de vivienda registrada.',
};

export type ReferralInput = {
  profile: Profile;
  org: ReferralOrg;
  lang: Lang;
  surname?: string | null;
  givenName?: string | null;
  code?: string;
  today?: Date;
};

export function buildReferral({ profile, org, lang, surname, givenName, code, today = new Date() }: ReferralInput): ReferralPacket {
  const t = T[lang];
  const r = computeReadiness(profile, { today });
  const gross = profile.grossMonthlyIncome + profile.otherMonthlyIncome + (profile.levers?.coApplicantIncome ?? 0);
  const minPayments = profile.debts.reduce((s, d) => s + d.minPayment, 0);
  const familyName = [givenName, surname].filter(Boolean).join(' ') || t.family;
  const timeline = r.milestones.map((m) => ({
    label: t.milestones[m.key as MilestoneKey],
    date: m.month === 0 ? t.now : monthName(addMonths(today, m.month), lang),
    action: lang === 'en' ? m.action : '',
  }));
  return {
    lang,
    org,
    orgName: ORG_NAME[org],
    title: t.title(ORG_NAME[org]),
    familyName,
    code,
    generated: new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', { dateStyle: 'long' }).format(today),
    readyLabel: t.ready,
    readyDate: monthName(r.readyDate, lang),
    labels: { household: t.household, blockers: t.blockers, timeline: t.timeline, habitat: t.habitat, footer: t.footer },
    household: [
      { label: t.size, value: t.people(profile.householdSize) },
      { label: t.income, value: money(gross, lang) },
      { label: t.rent, value: money(profile.rent, lang) },
      { label: t.burden, value: pct(r.costBurden) },
      { label: t.savings, value: money(profile.savings, lang) },
      { label: t.target, value: money(r.downPaymentTarget, lang) },
      { label: t.debts, value: money(minPayments, lang) },
      { label: t.credit, value: t.credits[profile.creditBand] },
      { label: t.eligible, value: isEligible(r) ? t.yes : t.no },
    ],
    blockers: r.blockers.length ? r.blockers.slice(0, 3).map((b) => (lang === 'es' ? (BLOCKER_ES[b.key] ?? b.text) : b.text)) : [t.noBlockers],
    timeline,
    habitatNeeds: [...t.needs(money(r.downPaymentTarget, lang))],
  };
}
