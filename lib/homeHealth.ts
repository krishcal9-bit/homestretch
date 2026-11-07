// KEEP · Home Health: the repair timeline (deterministic), the read of a system (Claude reads a data plate, the
// numbers come from SYSTEM_DEFAULTS), and the safe first steps when something breaks (static rules fallback).
import { z } from 'zod';
import { SYSTEM_DEFAULTS, type HomeSystem, type KeepProfile, type SystemKind } from './keep';
import { maintenanceSetAside, remainingYears } from './forecast';
import type { Lang } from './types';
import { SystemKindSchema } from './keepSchema';

export const SYSTEM_KINDS: SystemKind[] = ['water_heater', 'roof', 'hvac', 'appliances', 'other'];
export const HORIZON_YEARS = 5;

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** A new system from its kind and age, with the typical OC life and cost. */
export function makeSystem(kind: SystemKind, ageYears: number, extra: Partial<HomeSystem> = {}): HomeSystem {
  const d = SYSTEM_DEFAULTS[kind];
  return {
    id: extra.id ?? `${kind}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    ageYears: Math.min(150, Math.max(0, Math.round(num(ageYears)))),
    lifeYears: d.lifeYears,
    costLow: d.costLow,
    costHigh: d.costHigh,
    source: 'typed',
    confidence: 'high',
    ...extra,
  };
}

/** Add a system, or replace the one of the same kind (one water heater, one roof…; "other" always adds). */
export function upsertSystem(systems: HomeSystem[], s: HomeSystem): HomeSystem[] {
  const at = s.kind === 'other' ? systems.findIndex((x) => x.id === s.id) : systems.findIndex((x) => x.kind === s.kind);
  if (at < 0) return [...systems, s];
  const out = systems.slice();
  out[at] = { ...s, id: systems[at].id };
  return out;
}

export type TimelineItem = {
  system: HomeSystem;
  /** years until it likely needs replacing (0 = due now) */
  inYears: number;
  /** calendar year it's likely due */
  dueYear: number;
  /** due inside the next five years */
  soon: boolean;
  overdue: boolean;
};

/** Every listed system with when it is likely due, soonest first. */
export function repairTimeline(systems: HomeSystem[], now = new Date()): TimelineItem[] {
  const year = now.getFullYear();
  return (systems ?? [])
    .map((s) => {
      const left = remainingYears(s);
      const inYears = Math.ceil(left);
      return { system: s, inYears, dueYear: year + inYears, soon: inYears <= HORIZON_YEARS, overdue: num(s.ageYears) > num(s.lifeYears) };
    })
    .sort((a, b) => a.inYears - b.inYears);
}

/** The costs of what's due in the next five years (low and high ends) and the one monthly set-aside. */
export function repairSummary(p: Pick<KeepProfile, 'systems' | 'yearBuilt' | 'savings'>, now = new Date()) {
  const items = repairTimeline(p.systems, now);
  const due = items.filter((i) => i.soon);
  const low = due.reduce((a, i) => a + num(i.system.costLow), 0);
  const high = due.reduce((a, i) => a + num(i.system.costHigh), 0);
  const savings = Math.max(0, num(p.savings));
  const nextDue = due[0] ?? null;
  const nextMid = nextDue ? (num(nextDue.system.costLow) + num(nextDue.system.costHigh)) / 2 : 0;
  return { items, due, low, high, monthly: maintenanceSetAside(p, now), savings, nextDue, nextGap: Math.max(0, Math.round(nextMid - savings)) };
}

/* ------------------------------------------------------------------ */
/* Reading a system: Claude reads, the rules fill the numbers           */
/* ------------------------------------------------------------------ */

/** What Claude reads off a data plate or a photo of the system. */
export const PlateReadSchema = z.object({
  isHomeSystem: z.boolean(),
  system: SystemKindSchema.nullable(),
  manufactureYear: z.number().int().min(1950).max(2100).nullable(),
  estimatedAgeYears: z.number().min(0).max(100).nullable(),
  confidence: z.enum(['low', 'medium', 'high']),
  details: z.string().max(200).nullable(),
});
export type PlateRead = z.infer<typeof PlateReadSchema>;

export const PLATE_SYSTEM = `You read photos of home systems for a homeowner: a water heater, roof, furnace/AC (hvac), or an appliance, usually their data plate (rating label).
Return ONLY a JSON object, no prose:
{"isHomeSystem": boolean, "system": "water_heater"|"roof"|"hvac"|"appliances"|"other"|null, "manufactureYear": number|null, "estimatedAgeYears": number|null, "confidence": "low"|"medium"|"high", "details": string|null}
- manufactureYear: read it from a printed manufacture date, or decode it from the serial number only when the label states the format. Never guess a year you cannot read.
- estimatedAgeYears: only when there is no manufacture date but the photo clearly shows age (rust, style); otherwise null.
- confidence: high when a date is printed, medium when decoded from a serial, low when estimated from looks.
- details: a short plain description (brand, model, capacity, fuel), under 120 characters, no personal data.
If the photo is not a home system, set isHomeSystem false and the rest null with confidence "low".`;

export type HomeHealthResult = {
  system: SystemKind;
  estimatedAgeYears: number;
  confidence: 'low' | 'medium' | 'high';
  typicalLifeYears: number;
  replacementCostRange: [number, number];
  manufactureYear: number | null;
  details: string | null;
  /** where the age came from */
  from: 'photo' | 'typed' | 'default';
};

/** Turns a read (or typed facts) into the full answer: life and OC cost range always come from SYSTEM_DEFAULTS. */
export function resolveSystem(o: { kind: SystemKind; read?: PlateRead | null; ageYears?: number | null; installYear?: number | null }, now = new Date()): HomeHealthResult {
  const year = now.getFullYear();
  const kind = o.read?.system ?? o.kind;
  const d = SYSTEM_DEFAULTS[kind];
  let age: number | null = null;
  let confidence: HomeHealthResult['confidence'] = 'low';
  let from: HomeHealthResult['from'] = 'default';
  if (o.read?.manufactureYear) {
    age = Math.max(0, year - o.read.manufactureYear);
    confidence = o.read.confidence;
    from = 'photo';
  } else if (o.read?.estimatedAgeYears !== null && o.read?.estimatedAgeYears !== undefined) {
    age = Math.round(o.read.estimatedAgeYears);
    confidence = o.read.confidence === 'high' ? 'medium' : o.read.confidence;
    from = 'photo';
  } else if (o.ageYears !== null && o.ageYears !== undefined && Number.isFinite(o.ageYears)) {
    age = Math.max(0, Math.round(o.ageYears));
    confidence = 'high';
    from = 'typed';
  } else if (o.installYear) {
    age = Math.max(0, year - o.installYear);
    confidence = 'high';
    from = 'typed';
  }
  if (age === null) {
    // nobody knows: assume it's halfway through its life, and say so
    age = Math.round(d.lifeYears / 2);
    confidence = 'low';
    from = 'default';
  }
  return {
    system: kind,
    estimatedAgeYears: Math.min(100, age),
    confidence,
    typicalLifeYears: d.lifeYears,
    replacementCostRange: [d.costLow, d.costHigh],
    manufactureYear: o.read?.manufactureYear ?? (o.installYear || null),
    details: o.read?.details ?? null,
    from,
  };
}

/* ------------------------------------------------------------------ */
/* Something is breaking: safe first steps                              */
/* ------------------------------------------------------------------ */

export const HelpSchema = z.object({
  urgency: z.enum(['now', 'soon', 'can_wait']),
  headline: z.string().min(1).max(160),
  steps: z.array(z.string().min(1).max(220)).min(1).max(7),
  callWho: z.string().max(220),
});
export type Help = z.infer<typeof HelpSchema>;

export const HELP_SYSTEM = `You help a Habitat for Humanity homeowner in Orange County, California, who says something in their home is breaking.
Give SAFE first steps a non-expert can do in minutes (shut off water, gas, or power at the right place; protect people first; move valuables; take photos for insurance), never repairs that need a licensed pro.
If they smell gas, see sparks, smoke, or water near electrical: urgency "now", and the first step is to leave or call 911 / the gas company.
Return ONLY JSON: {"urgency": "now"|"soon"|"can_wait", "headline": string, "steps": string[3..6], "callWho": string}
Write in the language asked for, plain words, at a 6th-grade reading level. No prices or dollar amounts.`;

type L = Record<Lang, string>;
const S = (en: string, es: string): L => ({ en, es });

/** The static safe checklist per system: used when Claude is unavailable, and as the base for the mock. */
const HELP_RULES: Record<SystemKind, { urgency: Help['urgency']; headline: L; steps: L[]; callWho: L }> = {
  water_heater: {
    urgency: 'now',
    headline: S('A leaking water heater can flood and scald. Shut it off now.', 'Un calentador de agua con fuga puede inundar y quemar. Apáguelo ahora.'),
    steps: [
      S('If you smell gas, leave the house and call SoCalGas at 1-800-427-2200 from outside.', 'Si huele a gas, salga de la casa y llame a SoCalGas al 1-800-427-2200 desde afuera.'),
      S('Turn the cold-water valve on the pipe above the tank clockwise until it stops.', 'Gire la válvula de agua fría del tubo encima del tanque hacia la derecha hasta que pare.'),
      S('Gas heater: turn the gas knob on the tank to "Off". Electric: switch its breaker off.', 'Calentador de gas: gire la perilla de gas del tanque a "Off". Eléctrico: apague su interruptor (breaker).'),
      S('Keep children and pets away. The water may be very hot.', 'Mantenga a niños y mascotas lejos. El agua puede estar muy caliente.'),
      S('Move things off the wet floor and take photos for your records.', 'Quite cosas del piso mojado y tome fotos para sus registros.'),
    ],
    callWho: S('Call a licensed plumber. Habitat OC can tell you about repair help.', 'Llame a un plomero con licencia. Habitat OC puede informarle sobre ayuda para reparaciones.'),
  },
  roof: {
    urgency: 'soon',
    headline: S('A roof leak gets worse with every rain. Protect the inside first.', 'Una gotera en el techo empeora con cada lluvia. Proteja el interior primero.'),
    steps: [
      S('If water is near lights or outlets, switch that circuit off at the breaker.', 'Si el agua está cerca de luces o enchufes, apague ese circuito en el panel eléctrico.'),
      S('Put a bucket under the drip and move furniture and electronics away.', 'Ponga una cubeta bajo la gotera y aleje muebles y aparatos eléctricos.'),
      S('Never climb on a wet roof. Wait for a dry day and a professional.', 'Nunca se suba a un techo mojado. Espere un día seco y a un profesional.'),
      S('Take photos of the stain and the ceiling for your insurance.', 'Tome fotos de la mancha y del techo para su seguro.'),
    ],
    callWho: S('Call a licensed roofer, and your insurer if water damaged the inside.', 'Llame a un techador con licencia, y a su aseguradora si el agua dañó el interior.'),
  },
  hvac: {
    urgency: 'soon',
    headline: S('Turn the system off before it does more damage.', 'Apague el sistema antes de que cause más daño.'),
    steps: [
      S('If you smell gas or burning, leave the house and call 911 from outside.', 'Si huele a gas o a quemado, salga de la casa y llame al 911 desde afuera.'),
      S('Set the thermostat to "Off", then switch off the unit\'s breaker.', 'Ponga el termostato en "Off" y luego apague el interruptor de la unidad.'),
      S('Check the air filter. A clogged filter causes many breakdowns.', 'Revise el filtro de aire. Un filtro tapado causa muchas fallas.'),
      S('In a heat wave, go to a cooling center. Call 211 to find one.', 'En una ola de calor, vaya a un centro de enfriamiento. Llame al 211 para encontrar uno.'),
    ],
    callWho: S('Call a licensed heating and air technician.', 'Llame a un técnico de calefacción y aire con licencia.'),
  },
  appliances: {
    urgency: 'can_wait',
    headline: S('Unplug it and stop the water or gas to it.', 'Desconéctelo y cierre el agua o el gas que llega a él.'),
    steps: [
      S('Unplug the appliance or switch off its breaker.', 'Desconecte el aparato o apague su interruptor.'),
      S('For a washer or dishwasher, close the water valve behind it.', 'Para una lavadora o lavavajillas, cierre la válvula de agua detrás.'),
      S('For a gas stove or dryer that smells of gas, leave and call SoCalGas at 1-800-427-2200.', 'Si una estufa o secadora de gas huele a gas, salga y llame a SoCalGas al 1-800-427-2200.'),
      S('Wipe up water so no one slips.', 'Seque el agua para que nadie se resbale.'),
    ],
    callWho: S('Call an appliance repair shop. Check if it is still under warranty.', 'Llame a un taller de reparación de aparatos. Revise si aún tiene garantía.'),
  },
  other: {
    urgency: 'soon',
    headline: S('Make it safe first, then get help.', 'Primero hágalo seguro, luego busque ayuda.'),
    steps: [
      S('If anyone is in danger, or you smell gas or smoke, leave and call 911.', 'Si alguien está en peligro, o huele a gas o humo, salga y llame al 911.'),
      S('Shut off the water at the main valve if water is leaking.', 'Cierre el agua en la válvula principal si hay una fuga.'),
      S('Switch off power to the area at the breaker if it is wet or sparking.', 'Apague la electricidad de esa zona en el panel si está mojada o saca chispas.'),
      S('Take photos for your records.', 'Tome fotos para sus registros.'),
    ],
    callWho: S('Call a licensed contractor, or 211 Orange County for help finding one.', 'Llame a un contratista con licencia, o al 211 del Condado de Orange para encontrar uno.'),
  },
};

export function fallbackHelp(kind: SystemKind, lang: Lang): Help {
  const r = HELP_RULES[kind] ?? HELP_RULES.other;
  return { urgency: r.urgency, headline: r.headline[lang], steps: r.steps.map((s) => s[lang]), callWho: r.callWho[lang] };
}
