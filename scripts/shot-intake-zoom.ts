// Close-ups (3× DPR) of the intake illustrations, for checking line work.
// Usage: npx tsx scripts/shot-intake-zoom.ts <baseUrl> <outDir> [lang]
import { chromium, type Page } from 'playwright';
import path from 'path';

const base = process.argv[2] || 'http://localhost:3401';
const out = process.argv[3] || '.';
const lang = process.argv[4] || 'en';

const draft = (over: Record<string, unknown> = {}) => ({
  householdSize: 4, inOC: true, residentOrCitizen: true, grossMonthlyIncome: 5200, otherIncomeOn: false, otherMonthlyIncome: null, rent: 2350, bedrooms: 1, occupants: 4, unsafeConditions: false,
  debts: { car: { payment: 320, balance: null }, card: { payment: 65, balance: 2100 }, student: { payment: null, balance: null }, collection: { payment: null, balance: 1900 }, other: { payment: null, balance: null } },
  savings: 3100, creditBand: 'needs_work', levers: { extraDebt: 0, monthlySavings: 150, coApplicantIncome: 0 },
  ...over,
});

async function at(page: Page, step: number, d: object) {
  await page.goto(base + '/');
  await page.evaluate(([dd, s, l]) => {
    localStorage.clear();
    sessionStorage.setItem('hs.opened', '1');
    localStorage.setItem('hs.draft', JSON.stringify(dd));
    localStorage.setItem('hs.step', String(s));
    document.cookie = `hs_lang=${l}; path=/`;
  }, [d, step, lang] as const);
  await page.goto(base + '/start');
  await page.waitForSelector(`[data-step="${step}"]`);
  await page.waitForTimeout(900);
}
const shot = async (page: Page, sel: string, name: string) => {
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await el.screenshot({ path: path.join(out, `${lang}-${name}`) });
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 300)));
  await at(page, 1, draft({ householdSize: 8 }));
  await shot(page, 'form', 'z-household.png');
  await at(page, 2, draft());
  await shot(page, 'form', 'z-income.png');
  await at(page, 3, draft());
  await shot(page, 'form', 'z-housing.png');
  await at(page, 3, draft({ bedrooms: 3, occupants: 5, rent: 1500 }));
  await shot(page, 'form', 'z-housing2.png');
  await at(page, 4, draft({ debts: { car: { payment: 320, balance: null }, card: { payment: 65, balance: 2100 }, student: { payment: 180, balance: null }, collection: { payment: null, balance: 1900 }, other: { payment: 50, balance: null } } }));
  await shot(page, '[data-testid=debt-scale]', 'z-scale5.png');
  await at(page, 4, draft());
  await shot(page, '[data-testid=debt-scale]', 'z-scale.png');
  await shot(page, '[data-testid=credit-gauge]', 'z-gauge.png');
  await b.close();
})();
