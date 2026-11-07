// Zod schemas for the KEEP API routes (/api/extract/document, /api/explain, /api/shield).
import { z } from 'zod';

const money = z.number().min(0).max(10_000_000);

export const HomeSystemSchema = z.object({
  id: z.string().max(40),
  kind: z.enum(['water_heater', 'roof', 'hvac', 'appliances', 'other']),
  label: z.string().max(80).optional(),
  ageYears: z.number().min(0).max(200),
  lifeYears: z.number().min(0).max(200),
  costLow: money,
  costHigh: money,
  source: z.enum(['typed', 'photo', 'default']).optional(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
});

export const KeepProfileSchema = z.object({
  householdSize: z.number().min(1).max(20),
  mortgage: money,
  escrow: money,
  insurer: z.string().max(120),
  fairPlan: z.boolean(),
  premium: money,
  renewalMonth: z.number().int().min(1).max(12),
  propertyTax: money,
  supplementalTax: money,
  hoa: money,
  hoaGrowth: z.number().min(0).max(1).optional(),
  insuranceIncrease: z.number().min(0).max(2).optional(),
  homeType: z.enum(['single', 'townhome', 'condo']),
  yearBuilt: z.number().int().min(1800).max(2100),
  zip: z.string().max(10),
  income: money,
  takeHome: money,
  savings: money,
  setAside: money,
  systems: z.array(HomeSystemSchema).max(20),
  homeownersExemption: z.boolean().optional(),
  careFera: z.boolean().optional(),
});

export const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

/** What /api/extract/document reads from a homeowner's document. `null` = not on the page or not readable. */
export const DocumentExtractSchema = z.object({
  documentType: z.enum(['insurance_renewal', 'insurance_declarations', 'escrow_analysis', 'property_tax', 'hoa_notice', 'unknown']),
  insurer: z.string().max(120).nullable(),
  fairPlan: z.boolean().nullable(),
  currentPremium: money.nullable(),
  renewalPremium: money.nullable(),
  /** 'YYYY-MM-DD' the renewal (or new escrow payment, or new HOA dues) takes effect */
  effectiveDate: z.string().max(20).nullable(),
  currentEscrow: money.nullable(),
  newEscrow: money.nullable(),
  escrowShortage: money.nullable(),
  mortgagePrincipal: money.nullable(),
  propertyTaxAnnual: money.nullable(),
  hoaCurrent: money.nullable(),
  hoaNew: money.nullable(),
});
export type DocumentExtract = z.infer<typeof DocumentExtractSchema>;

export const ExplainFactsSchema = z.object({
  documentType: z.enum(['insurance', 'escrow', 'tax', 'hoa']),
  premiumOld: money.optional(),
  premiumNew: money.optional(),
  escrowOld: money.optional(),
  escrowNew: money.optional(),
  propertyTax: money.optional(),
  hoaOld: money.optional(),
  hoaNew: money.optional(),
  monthlyChange: z.number().min(-100_000).max(100_000).optional(),
  month: MonthSchema.optional(),
});

export const MoveSchema = z.object({
  key: z.enum(['insurance', 'claim', 'setAside', 'habitat']),
  title: z.string().min(1).max(120),
  detail: z.string().min(1).max(600),
  monthlyEffect: z.number().min(0).max(100_000),
  effort: z.enum(['low', 'medium', 'high']),
  resource: z.object({ name: z.string().max(120), url: z.string().url().max(300) }).optional(),
  message: z.string().max(1500).optional(),
});
export const ShieldSchema = z.object({ moves: z.array(MoveSchema).min(1).max(4) });
