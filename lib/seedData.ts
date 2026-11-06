import type { Home, Profile, Lang } from './types';

// Fictional households. Names are invented; any resemblance to real people is coincidence.
export type SeedFamily = {
  code: string;
  surname: string;
  givenName: string;
  city: string;
  language: Lang;
  daysSinceActivity: number;
  profile: Profile;
  /** Checklist items ticked (by action index) since last week, for the Monday check-in demo. */
  ticked?: number[];
};

const L = (extraDebt = 0, monthlySavings = 0, coApplicantIncome = 0) => ({ extraDebt, monthlySavings, coApplicantIncome });

const base = {
  inOC: true,
  residentOrCitizen: true,
  otherMonthlyIncome: 0,
  unsafeConditions: false,
};

export const SEED_HOMES: Home[] = [
  { id: 'h1', address: '1847 Placentia Ave', city: 'Costa Mesa', bedrooms: 3, completion: '2027-03', status: 'Framing' },
  { id: 'h2', address: '612 W Camile St', city: 'Santa Ana', bedrooms: 4, completion: '2027-01', status: 'Finishes' },
  { id: 'h3', address: '9921 Bixby Ave', city: 'Garden Grove', bedrooms: 2, completion: '2027-06', status: 'Foundation' },
  { id: 'h4', address: '1420 S Lemon St', city: 'Anaheim', bedrooms: 3, completion: '2027-09', status: 'Permitting' },
  { id: 'h5', address: '14251 Olive St', city: 'Westminster', bedrooms: 4, completion: '2027-12', status: 'Permitting' },
  { id: 'h6', address: '305 E Wilshire Ave', city: 'Santa Ana', bedrooms: 3, completion: '2028-03', status: 'Land acquired' },
  { id: 'h7', address: '8862 Hazard Ave', city: 'Garden Grove', bedrooms: 5, completion: '2028-07', status: 'Design' },
  { id: 'h8', address: '2210 W Ball Rd', city: 'Anaheim', bedrooms: 2, completion: '2028-10', status: 'Design' },
];

export const SEED_FAMILIES: SeedFamily[] = [
  {
    code: 'RAM4K2', surname: 'Ramírez', givenName: 'Lucía', city: 'Santa Ana', language: 'es', daysSinceActivity: 3,
    profile: { ...base, householdSize: 4, grossMonthlyIncome: 5200, rent: 2350, bedrooms: 1, occupants: 4,
      debts: [{ kind: 'collection', balance: 1900, minPayment: 0 }, { kind: 'card', balance: 2100, minPayment: 65 }],
      savings: 3100, creditBand: 'needs_work', openCollections: 1, levers: L(0, 150) },
    ticked: [0],
  },
  {
    code: 'NGU7P3', surname: 'Nguyen', givenName: 'Bao', city: 'Garden Grove', language: 'en', daysSinceActivity: 1,
    profile: { ...base, householdSize: 3, grossMonthlyIncome: 6400, rent: 2200, bedrooms: 2, occupants: 3,
      debts: [], savings: 14000, creditBand: 'good', creditScore: 702, levers: L(0, 400) },
  },
  {
    code: 'GAR2M8', surname: 'García', givenName: 'Miguel', city: 'Anaheim', language: 'es', daysSinceActivity: 12,
    profile: { ...base, householdSize: 5, grossMonthlyIncome: 6100, otherMonthlyIncome: 400, rent: 2600, bedrooms: 2, occupants: 5,
      debts: [{ kind: 'car', balance: 9800, minPayment: 340 }, { kind: 'card', balance: 4300, minPayment: 120 }],
      savings: 2500, creditBand: 'building', levers: L(50, 200) },
    ticked: [1],
  },
  {
    code: 'JOH5T1', surname: 'Johnson', givenName: 'Keisha', city: 'Costa Mesa', language: 'en', daysSinceActivity: 6,
    profile: { ...base, householdSize: 3, grossMonthlyIncome: 5600, rent: 2050, bedrooms: 2, occupants: 3,
      debts: [{ kind: 'card', balance: 2600, minPayment: 80 }], savings: 6200, creditBand: 'building', levers: L(300, 300) },
    ticked: [0, 1],
  },
  {
    code: 'TRA9Q4', surname: 'Tran', givenName: 'Linh', city: 'Westminster', language: 'en', daysSinceActivity: 41,
    profile: { ...base, householdSize: 2, grossMonthlyIncome: 4500, rent: 1750, bedrooms: 1, occupants: 2,
      debts: [{ kind: 'student', balance: 18000, minPayment: 190 }], savings: 5200, creditBand: 'good', creditScore: 668, levers: L(0, 250) },
  },
  {
    code: 'HER3W6', surname: 'Hernández', givenName: 'Rosa', city: 'Santa Ana', language: 'es', daysSinceActivity: 38,
    profile: { ...base, householdSize: 6, grossMonthlyIncome: 5900, otherMonthlyIncome: 600, rent: 2450, bedrooms: 2, occupants: 6,
      unsafeConditions: true,
      debts: [{ kind: 'collection', balance: 3400, minPayment: 0 }, { kind: 'card', balance: 5200, minPayment: 150 }, { kind: 'car', balance: 6000, minPayment: 280 }],
      savings: 800, creditBand: 'needs_work', openCollections: 2, levers: L(0, 50) },
  },
  {
    code: 'PAT6H9', surname: 'Patel', givenName: 'Anjali', city: 'Anaheim', language: 'en', daysSinceActivity: 2,
    profile: { ...base, householdSize: 4, grossMonthlyIncome: 7000, rent: 2500, bedrooms: 2, occupants: 4,
      debts: [{ kind: 'car', balance: 4000, minPayment: 310 }], savings: 7000, creditBand: 'good', creditScore: 690, levers: L(0, 500) },
    ticked: [0],
  },
  {
    code: 'LOP8D2', surname: 'López', givenName: 'Carmen', city: 'Garden Grove', language: 'es', daysSinceActivity: 9,
    profile: { ...base, householdSize: 3, grossMonthlyIncome: 4700, rent: 1950, bedrooms: 1, occupants: 3,
      debts: [{ kind: 'card', balance: 3900, minPayment: 110 }], savings: 1800, creditBand: 'unknown', levers: L(200, 300) },
    ticked: [0, 2],
  },
  {
    code: 'KIM1R7', surname: 'Kim', givenName: 'Daniel', city: 'Costa Mesa', language: 'en', daysSinceActivity: 4,
    profile: { ...base, householdSize: 2, grossMonthlyIncome: 5800, rent: 2100, bedrooms: 1, occupants: 2,
      debts: [], savings: 12500, creditBand: 'good', creditScore: 735, levers: L(0, 300) },
  },
  {
    code: 'MOR4B5', surname: 'Morales', givenName: 'Javier', city: 'Westminster', language: 'es', daysSinceActivity: 52,
    profile: { ...base, householdSize: 5, grossMonthlyIncome: 5300, rent: 2300, bedrooms: 2, occupants: 5,
      debts: [{ kind: 'collection', balance: 6100, minPayment: 0 }, { kind: 'card', balance: 7400, minPayment: 210 }, { kind: 'student', balance: 12000, minPayment: 130 }],
      savings: 400, creditBand: 'needs_work', openCollections: 3, levers: L(0, 0) },
  },
  {
    code: 'WIL2C8', surname: 'Williams', givenName: 'Andre', city: 'Santa Ana', language: 'en', daysSinceActivity: 15,
    profile: { ...base, householdSize: 4, grossMonthlyIncome: 6200, rent: 2400, bedrooms: 2, occupants: 4,
      debts: [{ kind: 'card', balance: 6500, minPayment: 190 }, { kind: 'car', balance: 11000, minPayment: 390 }],
      savings: 4200, creditBand: 'building', creditScore: 612, levers: L(300, 300) },
    ticked: [1],
  },
  {
    code: 'SAN5F3', surname: 'Sánchez', givenName: 'Elena', city: 'Anaheim', language: 'en', daysSinceActivity: 7,
    profile: { ...base, householdSize: 1, grossMonthlyIncome: 4100, rent: 1650, bedrooms: 1, occupants: 1,
      debts: [{ kind: 'card', balance: 1200, minPayment: 40 }], savings: 5200, creditBand: 'building', levers: L(150, 250) },
    ticked: [0],
  },
  // Not eligible: over income.
  {
    code: 'CHE7N1', surname: 'Chen', givenName: 'Wei', city: 'Costa Mesa', language: 'en', daysSinceActivity: 20,
    profile: { ...base, householdSize: 3, grossMonthlyIncome: 13800, rent: 3200, bedrooms: 2, occupants: 3,
      debts: [], savings: 40000, creditBand: 'good', creditScore: 760, levers: L(0, 800) },
  },
  // Not eligible: lives and works outside Orange County.
  {
    code: 'BRO3L4', surname: 'Brooks', givenName: 'Tamara', city: 'Riverside', language: 'en', daysSinceActivity: 26,
    profile: { ...base, inOC: false, householdSize: 4, grossMonthlyIncome: 5500, rent: 2300, bedrooms: 2, occupants: 4,
      debts: [{ kind: 'card', balance: 1500, minPayment: 50 }], savings: 7000, creditBand: 'good', creditScore: 655, levers: L(0, 300) },
  },
];
