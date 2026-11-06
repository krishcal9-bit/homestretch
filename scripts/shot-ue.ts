import { chromium } from 'playwright';
const draft = { householdSize: 4, inOC: true, residentOrCitizen: true, grossMonthlyIncome: 5200, otherIncomeOn: false, otherMonthlyIncome: null, rent: 2350, bedrooms: 1, occupants: 4, unsafeConditions: false,
  debts: { car: { payment: 342, balance: null }, card: { payment: 65, balance: 2100 }, student: { payment: null, balance: null }, collection: { payment: null, balance: 1900 }, other: { payment: 120, balance: null } },
  savings: 3100, creditBand: 'building', levers: { extraDebt: 0, monthlySavings: 150, coApplicantIncome: 0 },
  statement: { recurringDebts: [{ name: 'Coastline Auto Finance', amount: 342, kind: 'car' }, { name: 'QuickCash Lending', amount: 120, kind: 'other' }], rentPaymentDetected: true, avgMonthlyDeposits: 5310, overdraftOrNsfCount: 2, largeUnexplainedDeposits: [{ date: '2026-09-14', amount: 1500, description: 'Cash deposit' }] } };
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(process.argv[2] ?? 'http://localhost:3100/');
  await p.evaluate((d) => { localStorage.clear(); localStorage.setItem('hs.draft', JSON.stringify(d)); localStorage.setItem('hs.step', '5'); }, draft);
  await p.reload(); await p.waitForSelector('[data-testid=underwriters-eye]', { timeout: 30000 });
  await p.getByTestId('write-letter').nth(1).click(); await p.waitForTimeout(2500);
  const el = p.locator('#ue-title').locator('..').locator('..');
  await el.screenshot({ path: 'docs/screenshots/step6-underwriters-eye-mobile.png' });
  await b.close();
})();
