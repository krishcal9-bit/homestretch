// READY mode engine (the readiness date, milestones, levers) lives in lib/engine.ts; this module adds the bridge
// into KEEP: what owning will cost in the first year after closing, so families plan for ownership, not just purchase.
import { computeReadiness } from './engine';
import { forecast, type Forecast } from './forecast';
import { EMPTY_KEEP, type KeepProfile } from './keep';
import type { Profile, ReadinessResult } from './types';

export * from './engine';

/** Typical first-year premium for a new Habitat home in Orange County (an estimate; editable later in Keep). */
export const FIRST_YEAR_PREMIUM = 1500;
/** Orange County effective property tax rate on the purchase price (base 1% + local assessments). */
export const OC_TAX_RATE = 0.0106;

export type FirstYear = {
  profile: KeepProfile;
  forecast: Forecast;
  mortgage: number;
  escrow: number;
  setAside: number;
  monthly: number;
};

/** The family's first year of owning, previewed from their readiness result (a new home: low maintenance). */
export function firstYearOwning(p: Profile, r: ReadinessResult = computeReadiness(p), now = new Date()): FirstYear {
  const price = Math.max(0, r.financeableHome);
  const mortgage = Math.round(r.maxPayment);
  const propertyTax = Math.round(price * OC_TAX_RATE);
  const premium = price > 0 ? FIRST_YEAR_PREMIUM : 0;
  const escrow = Math.round((propertyTax + premium) / 12);
  const gross = (p.grossMonthlyIncome || 0) + (p.otherMonthlyIncome || 0) + (p.levers?.coApplicantIncome || 0);
  const profile: KeepProfile = {
    ...EMPTY_KEEP,
    householdSize: p.householdSize,
    mortgage,
    escrow,
    insurer: 'Sample Mutual',
    premium,
    renewalMonth: ((now.getMonth() + 12) % 12) + 1,
    propertyTax,
    yearBuilt: now.getFullYear(),
    income: gross * 12,
    takeHome: Math.round(gross * 0.8),
    savings: 0,
  };
  const f = forecast(profile);
  return { profile, forecast: f, mortgage, escrow, setAside: f.maintenance, monthly: Math.round(f.months[0]?.total ?? 0) };
}
