// Sample Habitat OC homeowners for the staff console and the Keep demo. All names and addresses are fictional.
// Deterministic (no randomness at runtime): the same 40 households every time.
import type { HomeSystem, KeepProfile } from './keep';
import { SYSTEM_DEFAULTS } from './keep';
import { basicLiving, maintenanceSetAside } from './forecast';

export type SeedHomeowner = {
  id: string;
  code: string;
  surname: string;
  givenName: string;
  city: string;
  address: string;
  language: 'en' | 'es';
  profile: KeepProfile;
  /** days since the last monthly check-in, at seed time */
  checkinDaysAgo: number;
  /** Shock Shield moves the family has done (by key) */
  movesDone: string[];
  closedYear: number;
};

const CITIES: [string, string][] = [
  ['Santa Ana', '92701'],
  ['Anaheim', '92805'],
  ['Garden Grove', '92840'],
  ['Costa Mesa', '92627'],
  ['Westminster', '92683'],
  ['Fullerton', '92832'],
];
const STREETS = ['Sample Lane', 'Example Court', 'Demo Avenue', 'Placeholder Way', 'Specimen Street'];
const SURNAMES = ['Ramirez', 'Nguyen', 'Okafor', 'Castillo', 'Pham', 'Delgado', 'Haddad', 'Morales', 'Le', 'Kim', 'Flores', 'Sandoval', 'Vu', 'Ortega', 'Bui', 'Mendoza', 'Park', 'Herrera', 'Soto', 'Do', 'Aguilar', 'Chavez', 'Ibrahim', 'Lopez', 'Hoang', 'Guzman', 'Patel', 'Navarro', 'Cruz', 'Dinh', 'Rios', 'Salazar', 'Jung', 'Vargas', 'Molina', 'Ngo', 'Fuentes', 'Torres', 'Abara', 'Lindqvist'];
const GIVEN = ['Marisol', 'Thanh', 'Chidi', 'Rosa', 'Minh', 'Elena', 'Samir', 'Luis', 'Hoa', 'Jiwoo', 'Ana', 'Carlos', 'Linh', 'Graciela', 'Tuan', 'Patricia', 'Daniel', 'Lucia', 'Ramon', 'Mai', 'Veronica', 'Jorge', 'Amina', 'Sofia', 'Quang', 'Beatriz', 'Priya', 'Hector', 'Isabel', 'Long', 'Teresa', 'Miguel', 'Hana', 'Adriana', 'Ernesto', 'Kim', 'Valeria', 'Ricardo', 'Ngozi', 'Erik'];
const SPANISH = new Set([0, 3, 5, 7, 10, 11, 15, 17, 20, 23, 30, 33]); // 12 Spanish-preferring
const FAIR = new Set([0, 6, 13, 19, 26, 34]); // 6 on the FAIR Plan
const CARRIERS = ['Sample Mutual', 'Harbor Home Insurance', 'Coastline Casualty', 'Orange Grove Insurance', 'Mesa Shield Insurance'];
/** households with an aging water heater or roof (6) */
const AGING: Record<number, Partial<HomeSystem>> = {
  2: { kind: 'water_heater', ageYears: 13 },
  9: { kind: 'roof', ageYears: 24 },
  14: { kind: 'water_heater', ageYears: 12 },
  22: { kind: 'water_heater', ageYears: 14 },
  28: { kind: 'roof', ageYears: 25 },
  37: { kind: 'water_heater', ageYears: 11 },
};
/** breathing room each household starts with ($/month, before any shock): sets how close to the edge they live */
const MARGIN = [60, 640, 210, 820, 300, 520, 200, 700, 380, 260, 900, 450, 330, 120, 560, 760, 240, 610, 410, 95, 680, 350, 290, 800, 470, 250, 230, 540, 330, 870, 620, 400, 720, 340, 240, 940, 500, 360, 660, 580];
/** months to the next renewal (spread across the year) */
const RENEW = [4, 1, 7, 3, 10, 5, 2, 9, 6, 11, 0, 8, 3, 5, 1, 7, 10, 2, 4, 6, 9, 11, 8, 0, 3, 5, 2, 7, 10, 1, 4, 6, 9, 11, 3, 8, 0, 5, 2, 7];
const CHECKIN = [6, 12, 19, 8, 52, 3, 27, 15, 9, 61, 4, 22, 11, 5, 33, 18, 7, 73, 2, 14, 25, 9, 48, 16, 6, 21, 10, 3, 66, 13, 8, 30, 17, 5, 12, 24, 7, 55, 19, 11];

const pick = <T,>(xs: T[], i: number) => xs[i % xs.length];

function system(id: string, s: Partial<HomeSystem>): HomeSystem {
  const kind = s.kind ?? 'water_heater';
  const d = SYSTEM_DEFAULTS[kind];
  return { id, kind, ageYears: s.ageYears ?? 3, lifeYears: s.lifeYears ?? d.lifeYears, costLow: s.costLow ?? d.costLow, costHigh: s.costHigh ?? d.costHigh, source: 'typed', confidence: 'high' };
}

/**
 * The 40 households. `startMonth` (1–12) anchors the renewal spread so the demo reads the same whenever it runs:
 * renewals land RENEW[i] months after the current month.
 */
export function seedHomeowners(now = new Date()): SeedHomeowner[] {
  const cm = now.getMonth() + 1;
  return SURNAMES.map((surname, i) => {
    const [city, zip] = pick(CITIES, i === 0 ? 0 : i);
    const size = 2 + ((i * 7 + 2) % 5); // 2–6 (the Ramirez family: 4)
    const homeType = i % 5 === 3 ? 'condo' : i % 5 === 1 ? 'townhome' : 'single';
    const yearBuilt = 1998 + ((i * 11) % 26);
    const price = 360000 + ((i * 9301) % 120000);
    const mortgage = Math.round(price / 360);
    const propertyTax = Math.round(price * 0.0106);
    const fair = FAIR.has(i);
    const premium = fair ? 1416 + ((i * 131) % 900) : 1250 + ((i * 97) % 800);
    const escrow = Math.round((propertyTax + premium) / 12);
    const hoa = homeType === 'single' ? 0 : 190 + ((i * 37) % 180);
    const systems: HomeSystem[] = [system(`wh${i}`, { kind: 'water_heater', ageYears: (i * 3) % 9 }), system(`rf${i}`, { kind: 'roof', ageYears: (i * 5) % 18 })];
    if (AGING[i]) {
      const k = AGING[i].kind;
      const at = systems.findIndex((s) => s.kind === k);
      systems[at] = system(systems[at].id, AGING[i]);
    }
    const profile: KeepProfile = {
      householdSize: size,
      mortgage,
      escrow,
      insurer: fair ? 'California FAIR Plan' : pick(CARRIERS, i),
      fairPlan: fair,
      premium,
      renewalMonth: ((cm - 1 + RENEW[i]) % 12) + 1,
      propertyTax,
      supplementalTax: 0,
      hoa,
      homeType,
      yearBuilt,
      zip,
      income: 0,
      takeHome: 0,
      savings: 300 + ((i * 433) % 5200),
      setAside: i % 6 === 0 && i !== 0 ? 25 : 0,
      systems,
    };
    const housing = mortgage + escrow + hoa + maintenanceSetAside(profile, now);
    profile.takeHome = Math.round(housing + basicLiving(size) + MARGIN[i]);
    profile.income = Math.round((profile.takeHome * 12) / 0.8 / 100) * 100;
    return {
      id: `ho${String(i + 1).padStart(2, '0')}`,
      code: `${surname.slice(0, 3).toUpperCase()}${(1000 + i * 37).toString(36).toUpperCase().slice(-3)}`,
      surname,
      givenName: GIVEN[i],
      city,
      address: `${120 + i * 14} ${pick(STREETS, i)}, ${city}`,
      language: SPANISH.has(i) ? 'es' : 'en',
      profile,
      checkinDaysAgo: CHECKIN[i],
      movesDone: i % 4 === 1 ? ['setAside'] : [],
      closedYear: 2014 + (i % 11),
    };
  });
}

/** The Keep demo family: the Ramirez family, Santa Ana, on the FAIR Plan, renewal next March. */
export const DEMO_FAMILY_ID = 'ho01';
export function demoFamily(now = new Date()): SeedHomeowner {
  const h = seedHomeowners(now)[0];
  // the demo's renewal is March (the insurance renewal notice in fixtures/ says so), the rest is as seeded
  return { ...h, profile: { ...h.profile, renewalMonth: 3 } };
}
