// Screenshots of each intake step at 390×844 and 1440×900 (server with MOCK_CLAUDE=1).
// Usage: npx tsx scripts/shot-intake.ts <baseUrl> <outDir> [prefix]
import { chromium, type Page } from 'playwright';
import path from 'path';

const base = process.argv[2] || 'http://localhost:3401';
const out = process.argv[3] || 'docs/screenshots';
const prefix = process.argv[4] || 'r4-intake';
const fixtures = path.join(__dirname, '../fixtures');

const intakeDraft = (over: Record<string, unknown> = {}) => ({
  householdSize: 4, inOC: true, residentOrCitizen: true, grossMonthlyIncome: 5200, otherIncomeOn: false, otherMonthlyIncome: null, rent: 2350, bedrooms: 1, occupants: 4, unsafeConditions: false,
  debts: { car: { payment: 320, balance: null }, card: { payment: 65, balance: 2100 }, student: { payment: null, balance: null }, collection: { payment: null, balance: 1900 }, other: { payment: null, balance: null } },
  savings: 3100, creditBand: 'needs_work', levers: { extraDebt: 0, monthlySavings: 150, coApplicantIncome: 0 },
  ...over,
});

async function at(page: Page, step: number, d: object) {
  await page.goto(base + '/');
  await page.evaluate(([dd, s]) => {
    localStorage.clear();
    sessionStorage.setItem('hs.opened', '1');
    localStorage.setItem('hs.draft', JSON.stringify(dd));
    localStorage.setItem('hs.step', String(s));
  }, [d, step] as const);
  await page.goto(base + '/start');
  await page.waitForSelector(`[data-step="${step}"]`);
  await page.waitForTimeout(900);
}

(async () => {
  const b = await chromium.launch();
  for (const [w, h, tag] of [[390, 844, '390'], [1440, 900, '1440']] as const) {
    const page = await b.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 300)));
    await at(page, 1, intakeDraft({ inOC: null, residentOrCitizen: null, householdSize: 3 }));
    // live: one more person, Yes for Orange County
    await page.getByRole('button', { name: 'One more person' }).click();
    await page.getByRole('radiogroup', { name: 'Do you live or work in Orange County?' }).getByRole('radio', { name: 'Yes' }).click();
    await page.getByRole('radiogroup', { name: 'Is everyone applying a US citizen or permanent resident?' }).getByRole('radio', { name: 'Yes' }).click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(out, `${prefix}-household-${tag}.png`), fullPage: true });

    await at(page, 2, intakeDraft());
    await page.screenshot({ path: path.join(out, `${prefix}-income-${tag}.png`), fullPage: true });
    await at(page, 2, intakeDraft({ grossMonthlyIncome: null }));
    await page.locator('#file-paystub').setInputFiles(path.join(fixtures, 'paystub.png'));
    await page.getByTestId('upload-paystub-done').waitFor({ timeout: 20000 });
    await page.waitForTimeout(1200);
    console.log('gross after upload', tag, await page.inputValue('#gross'));
    await page.screenshot({ path: path.join(out, `${prefix}-income-paystub-${tag}.png`), fullPage: true });

    await at(page, 3, intakeDraft({ bedrooms: 2, occupants: 3, rent: 1400 }));
    await page.screenshot({ path: path.join(out, `${prefix}-housing-${tag}.png`), fullPage: true });
    await at(page, 3, intakeDraft());
    await page.screenshot({ path: path.join(out, `${prefix}-housing-overcrowded-${tag}.png`), fullPage: true });

    await at(page, 4, intakeDraft());
    await page.screenshot({ path: path.join(out, `${prefix}-money-${tag}.png`), fullPage: true });
    await page.close();
  }
  await b.close();
})();
