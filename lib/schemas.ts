import { z } from 'zod';

export const DebtSchema = z.object({
  kind: z.enum(['car', 'card', 'student', 'collection', 'other']),
  balance: z.number().min(0),
  minPayment: z.number().min(0),
  apr: z.number().min(0).max(1).optional(),
});

export const StatementSchema = z.object({
  recurringDebts: z.array(z.object({ name: z.string(), amount: z.number(), kind: z.enum(['car', 'card', 'student', 'collection', 'other']).optional() })),
  rentPaymentDetected: z.boolean(),
  avgMonthlyDeposits: z.number(),
  overdraftOrNsfCount: z.number(),
  largeUnexplainedDeposits: z.array(z.object({ date: z.string(), amount: z.number(), description: z.string().optional() })),
});

export const ProfileSchema = z.object({
  householdSize: z.number(),
  inOC: z.boolean(),
  residentOrCitizen: z.boolean(),
  grossMonthlyIncome: z.number(),
  otherMonthlyIncome: z.number(),
  rent: z.number(),
  bedrooms: z.number(),
  occupants: z.number(),
  unsafeConditions: z.boolean(),
  debts: z.array(DebtSchema),
  savings: z.number(),
  creditBand: z.enum(['good', 'building', 'needs_work', 'unknown']),
  creditScore: z.number().optional(),
  openCollections: z.number().optional(),
  levers: z.object({ extraDebt: z.number(), monthlySavings: z.number(), coApplicantIncome: z.number() }),
  statement: StatementSchema.optional(),
});

export const LangSchema = z.enum(['en', 'es']);
