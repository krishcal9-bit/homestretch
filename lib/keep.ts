// KEEP mode types: what a Habitat homeowner tells Keystone about their home and money.
// The forecast engine (lib/forecast.ts) turns this into numbers; Claude only explains and plans around them.

export type HomeType = 'single' | 'townhome' | 'condo';
export type SystemKind = 'water_heater' | 'roof' | 'hvac' | 'appliances' | 'other';

/** A major home system (Home Health). Costs are a typical Orange County replacement range. */
export type HomeSystem = {
  id: string;
  kind: SystemKind;
  label?: string;
  ageYears: number;
  lifeYears: number;
  costLow: number;
  costHigh: number;
  /** where the age came from */
  source?: 'typed' | 'photo' | 'default';
  confidence?: 'low' | 'medium' | 'high';
};

export type KeepProfile = {
  householdSize: number;
  /** monthly mortgage (Habitat's 0% note: principal only) */
  mortgage: number;
  /** current monthly escrow (property tax + insurance) */
  escrow: number;
  insurer: string;
  fairPlan: boolean;
  /** annual homeowners premium */
  premium: number;
  /** 1–12, when the policy renews */
  renewalMonth: number;
  /** annual property tax */
  propertyTax: number;
  /** a supplemental tax bill is expected (reassessment): its amount, spread through escrow at the next analysis */
  supplementalTax: number;
  /** monthly HOA dues (0 if none) */
  hoa: number;
  /** HOA increase per year (default 5%) */
  hoaGrowth?: number;
  /** override the projected renewal increase (default 15%, 29.1% on the FAIR Plan) */
  insuranceIncrease?: number;
  homeType: HomeType;
  yearBuilt: number;
  zip: string;
  /** annual household income (gross) */
  income: number;
  /** monthly take-home */
  takeHome: number;
  savings: number;
  /** what the family already puts aside each month for the house (the Shock Shield slider) */
  setAside: number;
  systems: HomeSystem[];
  /** claimed reliefs (Relief Finder ids) */
  homeownersExemption?: boolean;
  careFera?: boolean;
};

export const EMPTY_KEEP: KeepProfile = {
  householdSize: 4,
  mortgage: 0,
  escrow: 0,
  insurer: '',
  fairPlan: false,
  premium: 0,
  renewalMonth: 3,
  propertyTax: 0,
  supplementalTax: 0,
  hoa: 0,
  homeType: 'single',
  yearBuilt: 2015,
  zip: '',
  income: 0,
  takeHome: 0,
  savings: 0,
  setAside: 0,
  systems: [],
};

/** Typical life and OC replacement cost by system (used when the family doesn't know). */
export const SYSTEM_DEFAULTS: Record<SystemKind, { lifeYears: number; costLow: number; costHigh: number }> = {
  water_heater: { lifeYears: 12, costLow: 1800, costHigh: 3200 },
  roof: { lifeYears: 25, costLow: 12000, costHigh: 22000 },
  hvac: { lifeYears: 16, costLow: 7000, costHigh: 12000 },
  appliances: { lifeYears: 13, costLow: 900, costHigh: 2500 },
  other: { lifeYears: 15, costLow: 500, costHigh: 2000 },
};
