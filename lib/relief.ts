// KEEP · Relief Finder: the programs an Orange County homeowner can claim, personalized by rules from the Keep
// profile. Values are conservative yearly estimates (deterministic); Claude only rewrites the "why", "worth" and
// "next step" sentences around them.
import { z } from 'zod';
import type { KeepProfile } from './keep';
import { repairTimeline } from './homeHealth';
import type { Lang } from './types';

export type ReliefId = 'exemption' | 'careFera' | 'wildfire' | 'habitatRepair' | 'oc211';
export const RELIEF_IDS: ReliefId[] = ['exemption', 'careFera', 'wildfire', 'habitatRepair', 'oc211'];
export type Likelihood = 'likely' | 'maybe' | 'unlikely';

/** California Homeowners' Exemption: $7,000 off the assessed value, at the 1% base rate. */
export const EXEMPTION_OFF = 7000;
export const EXEMPTION_VALUE = Math.round(EXEMPTION_OFF * 0.01);
/** CARE: 200% of the 2025 federal poverty guideline (households of 1–2 share a limit); FERA: 250%, 3+ people. */
const FPL_2025 = [0, 15650, 21150, 26650, 32150, 37650, 43150, 48650, 54150];
const FPL_EXTRA = 5500;
const fpl = (n: number) => (n <= 8 ? FPL_2025[Math.max(1, n)] : FPL_2025[8] + (n - 8) * FPL_EXTRA);
export const careLimit = (n: number) => Math.round(2 * fpl(Math.max(2, n)) / 100) * 100;
export const feraLimit = (n: number) => (n >= 3 ? Math.round(2.5 * fpl(n) / 100) * 100 : 0);
/** Conservative yearly savings on a typical OC electric + gas bill. */
export const CARE_VALUE = 420;
export const FERA_VALUE = 220;
/** Wildfire-mitigation discount: insurers must offer one; we count 5% of the premium (many give more). */
export const WILDFIRE_RATE = 0.05;

export const RELIEF_LINKS: Record<ReliefId, string> = {
  exemption: 'https://www.boe.ca.gov/proptaxes/homeowners_exemption.htm',
  careFera: 'https://www.cpuc.ca.gov/industries-and-topics/electrical-energy/electric-costs/care-fera-program',
  wildfire: 'https://www.insurance.ca.gov/01-consumers/200-wrr/Safer-from-Wildfires.cfm',
  habitatRepair: 'https://www.habitatoc.org',
  oc211: 'https://www.211oc.org',
};

export type ReliefFacts = {
  id: ReliefId;
  likelihood: Likelihood;
  /** conservative $ per year, or null when it depends (repairs, emergencies) */
  valuePerYear: number | null;
  link: string;
  /** the inputs behind the rule, for Claude and the UI */
  facts: Record<string, string | number | boolean>;
};

export type ReliefItem = ReliefFacts & { name: string; why: string; worth: string; nextStep: string };

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const usd = (n: number, lang: Lang) => new Intl.NumberFormat(lang === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.round(n || 0));

/** The rules: who likely qualifies and what it's worth. Pure; never NaN. */
export function reliefFacts(p: KeepProfile, now = new Date()): ReliefFacts[] {
  const size = Math.max(1, Math.round(num(p.householdSize, 1)));
  const income = Math.max(0, num(p.income) || num(p.takeHome) * 12 / 0.8);
  const care = careLimit(size);
  const fera = feraLimit(size);
  const careFera: Likelihood = income <= 0 ? 'maybe' : income <= care ? 'likely' : fera && income <= fera ? 'likely' : income <= care * 1.08 ? 'maybe' : 'unlikely';
  const program = income <= care ? 'CARE' : fera && income <= fera ? 'FERA' : 'CARE';
  const premium = Math.max(0, num(p.premium));
  const dueSoon = repairTimeline(p.systems ?? [], now).filter((i) => i.inYears <= 2);
  return [
    { id: 'exemption', likelihood: 'likely', valuePerYear: EXEMPTION_VALUE, link: RELIEF_LINKS.exemption, facts: { exemptionOff: EXEMPTION_OFF, claimed: !!p.homeownersExemption } },
    {
      id: 'careFera',
      likelihood: careFera,
      valuePerYear: careFera === 'unlikely' ? 0 : program === 'FERA' ? FERA_VALUE : CARE_VALUE,
      link: RELIEF_LINKS.careFera,
      facts: { program, householdSize: size, yearlyIncome: Math.round(income), careLimit: care, feraLimit: fera },
    },
    {
      id: 'wildfire',
      likelihood: p.fairPlan || premium > 0 ? 'likely' : 'maybe',
      valuePerYear: Math.round(premium * WILDFIRE_RATE),
      link: RELIEF_LINKS.wildfire,
      facts: { fairPlan: !!p.fairPlan, insurer: p.insurer || '', premium: Math.round(premium) },
    },
    {
      id: 'habitatRepair',
      likelihood: dueSoon.length ? 'likely' : 'maybe',
      valuePerYear: null,
      link: RELIEF_LINKS.habitatRepair,
      facts: { systemsDueSoon: dueSoon.map((d) => d.system.kind).join(', ') },
    },
    { id: 'oc211', likelihood: 'likely', valuePerYear: null, link: RELIEF_LINKS.oc211, facts: {} },
  ];
}

const NAMES: Record<ReliefId, Record<Lang, string>> = {
  exemption: { en: "California Homeowners' Exemption", es: 'Exención para Propietarios de California' },
  careFera: { en: 'CARE and FERA utility discounts', es: 'Descuentos de servicios CARE y FERA' },
  wildfire: { en: 'Wildfire-safety insurance discount (Safer from Wildfires)', es: 'Descuento de seguro por protección contra incendios (Safer from Wildfires)' },
  habitatRepair: { en: 'Habitat OC home repair programs', es: 'Programas de reparación de vivienda de Habitat OC' },
  oc211: { en: '211 Orange County emergency help', es: 'Ayuda de emergencia del 211 del Condado de Orange' },
};
export const reliefName = (id: ReliefId, lang: Lang) => NAMES[id][lang];

/** The deterministic sentences (used as-is when Claude is unavailable). */
export function fallbackRelief(p: KeepProfile, lang: Lang, now = new Date()): ReliefItem[] {
  const es = lang === 'es';
  const $ = (n: number) => usd(n, lang);
  return reliefFacts(p, now).map((f) => {
    const name = NAMES[f.id][lang];
    switch (f.id) {
      case 'exemption':
        return {
          ...f,
          name,
          why: es ? 'Vive en la casa que es suya, así que puede pedirla.' : 'You live in the home you own, so you can claim it.',
          worth: es ? `Quita ${$(EXEMPTION_OFF)} del valor tasado: unos ${$(f.valuePerYear ?? 0)} menos de impuestos al año.` : `Takes ${$(EXEMPTION_OFF)} off your assessed value: about ${$(f.valuePerYear ?? 0)} less tax a year.`,
          nextStep: es ? 'Llene el formulario BOE-266 con la Oficina del Tasador del Condado de Orange. Se pide una sola vez.' : 'File form BOE-266 with the Orange County Assessor. You only file once.',
        };
      case 'careFera': {
        const prog = String(f.facts.program);
        const limit = Number(prog === 'FERA' ? f.facts.feraLimit : f.facts.careLimit);
        const size = Number(f.facts.householdSize);
        const why =
          f.likelihood === 'unlikely'
            ? es
              ? `Para un hogar de ${size}, el límite es ${$(limit)} al año. Su ingreso parece estar arriba, pero revise si cambia.`
              : `For a household of ${size}, the limit is ${$(limit)} a year. Your income looks above it, but check again if it changes.`
            : es
              ? `Para un hogar de ${size}, ${prog} acepta ingresos hasta ${$(limit)} al año (límites de 2025).`
              : `For a household of ${size}, ${prog} takes incomes up to ${$(limit)} a year (2025 limits).`;
        return {
          ...f,
          name,
          why,
          worth:
            f.likelihood === 'unlikely'
              ? es ? 'Probablemente no aplica este año.' : 'Probably not this year.'
              : es ? `Cerca de ${$(f.valuePerYear ?? 0)} al año en su cuenta de luz y gas.` : `About ${$(f.valuePerYear ?? 0)} a year off your electric and gas bills.`,
          nextStep: es ? 'Pídalo en línea con Southern California Edison y SoCalGas. Toma unos 5 minutos.' : 'Apply online with Southern California Edison and SoCalGas. It takes about 5 minutes.',
        };
      }
      case 'wildfire':
        return {
          ...f,
          name,
          why: f.facts.fairPlan
            ? es ? 'El FAIR Plan y las aseguradoras deben ofrecer un descuento si su casa tiene mejoras contra incendios.' : 'The FAIR Plan and insurers must offer a discount when your home has wildfire-safety upgrades.'
            : es ? 'Su aseguradora debe ofrecer un descuento si su casa tiene mejoras contra incendios.' : 'Your insurer must offer a discount when your home has wildfire-safety upgrades.',
          worth: f.valuePerYear
            ? es ? `Al menos ${$(f.valuePerYear)} al año (5% de su prima); muchas dan más.` : `At least ${$(f.valuePerYear)} a year (5% of your premium); many give more.`
            : es ? 'Un porcentaje de su prima.' : 'A share of your premium.',
          nextStep: es ? 'Limpie 1.5 metros alrededor de la casa, tape las rejillas con malla fina y pida el descuento a su aseguradora.' : 'Clear 5 feet around the house, screen your vents with fine mesh, then ask your insurer for the discount.',
        };
      case 'habitatRepair':
        return {
          ...f,
          name,
          why: f.likelihood === 'likely'
            ? es ? 'Algo en su casa puede necesitar reemplazo pronto. Habitat OC ayuda a sus propietarios con reparaciones.' : 'Something in your home may need replacing soon. Habitat OC helps its homeowners with repairs.'
            : es ? 'Como propietario de Habitat, puede pedir ayuda cuando algo se descomponga.' : 'As a Habitat homeowner, you can ask for help when something breaks.',
          worth: es ? 'Reparaciones a bajo costo o sin costo, según el programa.' : 'Repairs at low or no cost, depending on the program.',
          nextStep: es ? 'Llame a Habitat OC y pregunte por los programas de reparación de vivienda.' : 'Call Habitat OC and ask about home repair programs.',
        };
      case 'oc211':
        return {
          ...f,
          name,
          why: es ? 'Cualquier persona en el Condado de Orange puede llamar, a cualquier hora.' : 'Anyone in Orange County can call, any time.',
          worth: es ? 'Ayuda con renta o hipoteca, servicios y comida cuando algo inesperado pasa.' : 'Help with mortgage, utilities and food when something unexpected happens.',
          nextStep: es ? 'Marque 211 o visite 211oc.org. Hablan español.' : 'Dial 211 or visit 211oc.org. Help is available in many languages.',
        };
    }
  });
}

/** Yearly total of the items not yet done (the headline number). */
export function reliefWorth(items: Pick<ReliefFacts, 'id' | 'valuePerYear' | 'likelihood'>[], done: string[]): number {
  return items.filter((i) => !done.includes(i.id) && i.likelihood !== 'unlikely').reduce((a, i) => a + Math.max(0, num(i.valuePerYear)), 0);
}

/* ------------------------------------------------------------------ */
/* Claude: personalized sentences                                       */
/* ------------------------------------------------------------------ */

export const ReliefTextSchema = z.object({
  items: z.array(z.object({ id: z.enum(['exemption', 'careFera', 'wildfire', 'habitatRepair', 'oc211']), why: z.string().min(1).max(260), worth: z.string().min(1).max(200), nextStep: z.string().min(1).max(260) })).min(1).max(5),
});
export type ReliefText = z.infer<typeof ReliefTextSchema>;

export const RELIEF_SYSTEM = `You help a Habitat for Humanity homeowner in Orange County, California, claim money-saving programs.
For each program you're given, write three short sentences in plain words (6th-grade reading level), in the language asked for:
- why: why this family likely qualifies (or what to check), using their facts.
- worth: what it's worth per year. Use ONLY the dollar amounts given (valuePerYear, limits). Never invent or change a number. If valuePerYear is null, describe the help without a dollar amount.
- nextStep: the one concrete next thing to do this week.
Return ONLY JSON: {"items":[{"id": string, "why": string, "worth": string, "nextStep": string}]} with one entry per program id given.`;

/** Merge Claude's sentences onto the rules (any id it skipped keeps the fallback text). */
export function mergeRelief(base: ReliefItem[], text: ReliefText | null): ReliefItem[] {
  if (!text) return base;
  return base.map((b) => {
    const t = text.items.find((x) => x.id === b.id);
    return t ? { ...b, why: t.why, worth: t.worth, nextStep: t.nextStep } : b;
  });
}
