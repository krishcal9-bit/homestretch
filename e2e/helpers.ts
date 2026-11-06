import { expect, type Page } from '@playwright/test';

export const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "August 2027" → months since year 0, for comparisons. */
export function monthIndex(text: string): number {
  const m = text.trim().match(/([A-Za-z]+)\s+(\d{4})/);
  if (!m) return Number.NaN;
  return Number(m[2]) * 12 + MONTHS_EN.indexOf(m[1]);
}

export async function freshStart(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = 'hs_lang=en; path=/';
  });
  await page.goto('/start');
}

/** From a clean state, lands on the marketing page (/) with the intro turned off (it has its own test). */
export async function freshLanding(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('hs.nointro', '1');
    localStorage.setItem('hs.dragged', '1');
    document.cookie = 'hs_lang=en; path=/';
  });
  await page.reload();
}

/** Completes intake screens 1–4 using only the keyboard. */
export async function completeIntakeByKeyboard(page: Page) {
  const tabTo = async (selector: string) => {
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      if (await page.evaluate((sel) => !!document.activeElement?.matches(sel), selector)) return;
    }
    throw new Error(`could not tab to ${selector}`);
  };
  await tabTo('[data-testid=find-my-date]');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Tell us about your household' })).toBeFocused();
  // household size: 4
  await tabTo('#householdSize');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('4');
  // OC: yes; resident: yes (radio group: arrow keys select)
  await tabTo('[aria-label="Do you live or work in Orange County?"] [role=radio]');
  await page.keyboard.press('Space');
  await tabTo('[aria-label="Is everyone applying a US citizen or permanent resident?"] [role=radio]');
  await page.keyboard.press('Space');
  await tabTo('button[type=submit]');
  await page.keyboard.press('Enter'); // Continue
  // income
  await expect(page.getByRole('heading', { name: 'What does your household earn?' })).toBeFocused();
  await tabTo('#gross');
  await page.keyboard.type('5200');
  await page.keyboard.press('Enter');
  // housing
  await expect(page.getByRole('heading', { name: 'Where you live now' })).toBeFocused();
  await tabTo('#rent');
  await page.keyboard.type('2350');
  await page.keyboard.press('Enter');
  // money
  await expect(page.getByRole('heading', { name: 'Your money picture' })).toBeFocused();
  await tabTo('#debt-card-payment');
  await page.keyboard.type('65');
  await tabTo('#debt-card-balance');
  await page.keyboard.type('2100');
  await tabTo('#debt-collection-balance');
  await page.keyboard.type('1900');
  await tabTo('#savings');
  await page.keyboard.type('3100');
  await tabTo('[aria-label="How is your credit?"] [role=radio]');
  await page.keyboard.press('ArrowRight'); // building
  await page.keyboard.press('ArrowRight'); // needs work
  await page.keyboard.press('Enter');
}

/** Click Continue / See my path and wait for the screen transition to finish. */
export async function next(page: Page) {
  await page.waitForFunction(() => document.querySelectorAll('form button[type=submit]').length === 1);
  await page.locator('form button[type=submit]').click();
  await page.waitForTimeout(50);
  await page.waitForFunction(() => document.querySelectorAll('[data-step]').length === 1);
}

export async function staffLogin(page: Page) {
  await page.goto('/staff/login');
  await page.locator('input[type=password]').fill(process.env.STAFF_PASSWORD ?? 'habitat2026');
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-testid=family-row]', { timeout: 60_000 });
}

export const DEMO_DRAFT = {
  householdSize: 4, inOC: true, residentOrCitizen: true, grossMonthlyIncome: 5200, otherIncomeOn: false, otherMonthlyIncome: null, rent: 2350, bedrooms: 1, occupants: 4, unsafeConditions: false,
  debts: { car: { payment: null, balance: null }, card: { payment: 65, balance: 2100 }, student: { payment: null, balance: null }, collection: { payment: null, balance: 1900 }, other: { payment: null, balance: null } },
  savings: 3100, creditBand: 'needs_work', levers: { extraDebt: 0, monthlySavings: 150, coApplicantIncome: 0 },
};
