import type { Tier } from './incomeTiers';

export type DebtKind = 'car' | 'card' | 'student' | 'collection' | 'other';
export type Debt = { kind: DebtKind; balance: number; minPayment: number; apr?: number };
export type CreditBand = 'good' | 'building' | 'needs_work' | 'unknown';
export type Lang = 'en' | 'es';

export type StatementFindings = {
  recurringDebts: { name: string; amount: number; kind?: DebtKind }[];
  rentPaymentDetected: boolean;
  avgMonthlyDeposits: number;
  overdraftOrNsfCount: number;
  largeUnexplainedDeposits: { date: string; amount: number; description?: string }[];
};

export type Levers = { extraDebt: number; monthlySavings: number; coApplicantIncome: number };

export type Profile = {
  householdSize: number;
  inOC: boolean;
  residentOrCitizen: boolean;
  grossMonthlyIncome: number;
  otherMonthlyIncome: number;
  rent: number;
  bedrooms: number;
  occupants: number;
  unsafeConditions: boolean;
  debts: Debt[];
  savings: number;
  creditBand: CreditBand;
  creditScore?: number;
  openCollections?: number;
  levers: Levers;
  statement?: StatementFindings;
};

export type MilestoneKey = 'collections' | 'credit' | 'savings' | 'orientation' | 'application' | 'keys';
export type Milestone = { key: MilestoneKey; month: number; label: string; action: string };

export type Blocker = { key: string; severity: 1 | 2 | 3; text: string };

export type ReadinessResult = {
  eligible: { need: boolean; income: boolean; residency: boolean; reasons: string[] };
  tier: Tier;
  costBurden: number;
  overcrowded: boolean;
  dti: number;
  maxPayment: number;
  financeableHome: number;
  downPaymentTarget: number;
  monthsToReady: number;
  readyDate: string; // ISO month "YYYY-MM"
  milestones: Milestone[];
  blockers: Blocker[];
  score: number;
  /** Month all debts that block credit are cleared (0 if none). */
  debtClearMonth: number;
  /** Minimum payments freed into savings once debts are paid. */
  freedPayments: number;
  /** True when income is zero: show the "add income" state. */
  noIncome: boolean;
};

export type Home = {
  id: string;
  address: string;
  city: string;
  bedrooms: number;
  completion: string; // ISO month
  status: string;
};
