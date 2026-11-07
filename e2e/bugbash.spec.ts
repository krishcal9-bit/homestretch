import { test, expect, type Page } from '@playwright/test';
import { DEMO_DRAFT, staffReady } from './helpers';

const base = { ...DEMO_DRAFT, debts: { car: { payment: null, balance: null }, card: { payment: null, balance: null }, student: { payment: null, balance: null }, collection: { payment: null, balance: null }, other: { payment: null, balance: null } } };
async function result(page: Page, d: Record<string, unknown>) {
  await page.goto('/');
  await page.evaluate((x) => { localStorage.clear(); localStorage.setItem('hs.draft', JSON.stringify(x)); localStorage.setItem('hs.step', '5'); }, d);
  await page.goto('/start');
  await page.waitForTimeout(1500);
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/NaN|Infinity|undefined/);
  return text;
}

test('edge profiles never show NaN and read honestly', async ({ page }) => {
  // household of 1 and of 8
  await result(page, { ...base, householdSize: 1, occupants: 1 });
  await result(page, { ...base, householdSize: 8, occupants: 8, bedrooms: 2 });
  // income exactly on a tier boundary (4 people, $93,050/yr) and rent exactly 30%
  const t = await result(page, { ...base, grossMonthlyIncome: 93050 / 12, rent: Math.round((93050 / 12) * 0.3 * 100) / 100, bedrooms: 3, occupants: 4 });
  expect(t).toContain('30% of income');
  // all debts 0, savings above target, good credit → near-term, no invented blockers
  const ready = await result(page, { ...base, savings: 20000, creditBand: 'good' });
  expect(ready).toContain('You could start your application now.');
  expect(ready).not.toMatch(/collection/i);
  // not eligible (outside OC): road still shows with an honest banner
  await result(page, { ...base, inOC: false });
  await expect(page.getByTestId('not-eligible')).toBeVisible();
  // all-zeros profile → "add income" state
  const zero = await result(page, { ...base, grossMonthlyIncome: 0, rent: 0, savings: 0, levers: { extraDebt: 0, monthlySavings: 0, coApplicantIncome: 0 } });
  expect(zero).toContain('Add income to see a path');
});

test('sliders at 0 and max keep the screen sane', async ({ page }) => {
  await result(page, DEMO_DRAFT);
  for (const [id, v] of [['extraDebt', '0'], ['extraDebt', '500'], ['monthlySavings', '1000'], ['coApplicantIncome', '3000']]) {
    await page.fill(`#lever-${id}-n`, v);
    await page.waitForTimeout(150);
  }
  expect(await page.locator('main').innerText()).not.toMatch(/NaN|Infinity|undefined/);
  await expect(page.getByTestId('ready-date')).toHaveText(/\d{4}|10\+/);
});

test('staff drawer then browser back leaves a clean pipeline', async ({ page }) => {
  await staffReady(page);
  await page.getByTestId('family-row').first().click();
  await expect(page.getByTestId('drawer')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('drawer')).toHaveCount(0);
  await expect(page.getByTestId('family-row')).toHaveCount(14);
});

test('two tabs editing the same plan: last write wins, no crash', async ({ page, context }) => {
  const other = await context.newPage();
  await page.goto('/plan/KIM1R7');
  await other.goto('/plan/KIM1R7');
  await expect(page.getByTestId('checklist')).toBeVisible({ timeout: 45_000 });
  await expect(other.getByTestId('checklist')).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('#action-1')).toBeEnabled();
  await expect(other.locator('#action-2')).toBeEnabled();
  const isPatch = (r: { request: () => { method: () => string }; url: () => string }) => r.request().method() === 'PATCH' && r.url().includes('/api/plans/KIM1R7');
  const saves = Promise.all([page.waitForResponse(isPatch), other.waitForResponse(isPatch)]);
  await page.locator('label[for=action-1]').first().click();
  await other.locator('label[for=action-2]').first().click();
  const [r1, r2] = await saves;
  expect(r1.ok() && r2.ok()).toBe(true);
  await page.reload();
  await expect(page.getByTestId('checklist')).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('#action-1')).toBeChecked();
  await expect(page.locator('#action-2')).toBeChecked();
});
