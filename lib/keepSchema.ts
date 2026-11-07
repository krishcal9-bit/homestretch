// Zod schemas for KEEP inputs sent to API routes (Home Health, Relief Finder, the home plan PDF). Server-safe.
// Numbers are clamped rather than rejected, so an odd value from an old device never breaks a request.
import { z } from 'zod';
import { EMPTY_KEEP, type KeepProfile } from './keep';

const money = (max = 10_000_000) => z.coerce.number().catch(0).transform((v) => Math.min(max, Math.max(0, Number.isFinite(v) ? v : 0)));

export const SystemKindSchema = z.enum(['water_heater', 'roof', 'hvac', 'appliances', 'other']);

export const HomeSystemSchema = z.object({
  id: z.string().max(64),
  kind: SystemKindSchema,
  label: z.string().max(80).optional(),
  ageYears: money(150),
  lifeYears: money(150),
  costLow: money(1_000_000),
  costHigh: money(1_000_000),
  source: z.enum(['typed', 'photo', 'default']).optional(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
});

export const KeepProfileSchema = z
  .object({
    householdSize: z.coerce.number().catch(4).transform((v) => Math.min(12, Math.max(1, Math.round(v || 1)))),
    mortgage: money(),
    escrow: money(),
    insurer: z.string().max(120).catch(''),
    fairPlan: z.boolean().catch(false),
    premium: money(),
    renewalMonth: z.coerce.number().catch(1).transform((v) => Math.min(12, Math.max(1, Math.round(v || 1)))),
    propertyTax: money(),
    supplementalTax: money(),
    hoa: money(),
    hoaGrowth: z.number().min(0).max(1).optional(),
    insuranceIncrease: z.number().min(0).max(2).optional(),
    homeType: z.enum(['single', 'townhome', 'condo']).catch('single'),
    yearBuilt: z.coerce.number().catch(2015).transform((v) => Math.min(2100, Math.max(1800, Math.round(v || 2015)))),
    zip: z.string().max(10).catch(''),
    income: money(),
    takeHome: money(),
    savings: money(),
    setAside: money(),
    systems: z.array(HomeSystemSchema).max(40).catch([]),
    homeownersExemption: z.boolean().optional(),
    careFera: z.boolean().optional(),
  })
  .partial()
  .transform((p) => ({ ...EMPTY_KEEP, ...p }) as KeepProfile);

export const LangSchema = z.enum(['en', 'es']).catch('en');
