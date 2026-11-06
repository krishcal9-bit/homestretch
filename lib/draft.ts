import type { CreditBand, Debt, DebtKind, Profile, StatementFindings } from './types';

/** What the intake form holds. Numbers are null until the family enters them. */
export type Draft = {
  householdSize: number;
  inOC: boolean | null;
  residentOrCitizen: boolean | null;
  grossMonthlyIncome: number | null;
  otherIncomeOn: boolean;
  otherMonthlyIncome: number | null;
  incomeSource?: 'paystub' | 'voice';
  rent: number | null;
  bedrooms: number;
  occupants: number;
  unsafeConditions: boolean;
  debts: Record<DebtKind, { payment: number | null; balance: number | null }>;
  savings: number | null;
  creditBand: CreditBand | null;
  statement?: StatementFindings;
  levers: { extraDebt: number; monthlySavings: number; coApplicantIncome: number };
};

export const DEBT_KINDS: DebtKind[] = ['car', 'card', 'student', 'collection', 'other'];

export const emptyDraft = (): Draft => ({
  householdSize: 3,
  inOC: null,
  residentOrCitizen: null,
  grossMonthlyIncome: null,
  otherIncomeOn: false,
  otherMonthlyIncome: null,
  rent: null,
  bedrooms: 2,
  occupants: 3,
  unsafeConditions: false,
  debts: { car: { payment: null, balance: null }, card: { payment: null, balance: null }, student: { payment: null, balance: null }, collection: { payment: null, balance: null }, other: { payment: null, balance: null } },
  savings: null,
  creditBand: null,
  // The intake doesn't ask for a monthly savings amount; start the slider at a modest $150.
  levers: { extraDebt: 0, monthlySavings: 150, coApplicantIncome: 0 },
});

/** Balance guesses when only a payment is known (months of payments outstanding). */
const BALANCE_MONTHS: Record<DebtKind, number> = { car: 30, card: 33, student: 96, collection: 0, other: 24 };

export function draftToProfile(d: Draft): Profile {
  const debts: Debt[] = [];
  for (const kind of DEBT_KINDS) {
    const { payment, balance } = d.debts[kind];
    const pay = payment ?? 0;
    const bal = balance ?? (kind === 'collection' ? 0 : pay * BALANCE_MONTHS[kind]);
    if (bal > 0 || pay > 0) debts.push({ kind, balance: Math.max(bal, kind === 'collection' ? 0 : pay), minPayment: pay });
  }
  return {
    householdSize: d.householdSize,
    inOC: d.inOC ?? true,
    residentOrCitizen: d.residentOrCitizen ?? true,
    grossMonthlyIncome: d.grossMonthlyIncome ?? 0,
    otherMonthlyIncome: d.otherIncomeOn ? d.otherMonthlyIncome ?? 0 : 0,
    rent: d.rent ?? 0,
    bedrooms: d.bedrooms,
    occupants: d.occupants,
    unsafeConditions: d.unsafeConditions,
    debts,
    savings: d.savings ?? 0,
    creditBand: d.creditBand ?? 'unknown',
    openCollections: (d.debts.collection.balance ?? 0) > 0 ? 1 : 0,
    levers: d.levers,
    statement: d.statement,
  };
}

/** Accepts "$2,400.00", "2400", "2.400,50"-ish; returns null for empty/garbage. */
export function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.,-]/g, '');
  if (!cleaned) return null;
  const normalized = /,\d{2}$/.test(cleaned) && !cleaned.includes('.') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.max(0, Math.round(n * 100) / 100) : null;
}
