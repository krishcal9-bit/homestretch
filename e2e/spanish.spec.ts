import { test, expect, type Page } from '@playwright/test';
import { freshStart, next } from './helpers';

// Known English strings that must never appear once Spanish is on (screens 1–6).
const ENGLISH = [
  'Start', 'Continue', 'Back', 'Tell us about your household', 'People in your household', 'Do you live or work in Orange County?',
  'What does your household earn?', 'Monthly income from work', 'Scan a pay stub instead', 'Where you live now', 'Monthly rent',
  'Your money picture', 'How is your credit?', 'See my path', 'Why this date', 'Your 90-day plan', 'Save my plan', 'Try changing your plan',
];

async function noEnglish(page: Page) {
  const text = await page.locator('main').innerText();
  for (const s of ENGLISH) expect(text.includes(s), `found English "${s}"`).toBe(false);
}

test('Spanish everywhere on screens 1–6 and the PDF is Spanish', async ({ page }) => {
  await freshStart(page);
  await page.getByTestId('lang-toggle').getByRole('radio', { name: 'ES' }).click();
  await expect(page.getByRole('button', { name: 'Empezar' })).toBeVisible();
  await noEnglish(page);
  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByRole('heading', { name: 'Cuéntenos sobre su hogar' })).toBeVisible();
  await noEnglish(page);
  await next(page);
  await expect(page.getByRole('heading', { name: '¿Cuánto gana su hogar?' })).toBeVisible();
  await page.fill('#gross', '5200');
  await noEnglish(page);
  await next(page);
  await page.fill('#rent', '2350');
  await noEnglish(page);
  await next(page);
  await page.fill('#savings', '3100');
  await page.getByRole('radio', { name: 'En progreso' }).click();
  await noEnglish(page);
  await next(page);
  await expect(page.getByTestId('ready-date')).toHaveText(/de \d{4}/, { timeout: 15_000 });
  await expect(page.getByTestId('checklist')).toBeVisible({ timeout: 20_000 });
  await noEnglish(page);
  await page.getByRole('button', { name: 'Guardar mi plan' }).click();
  await expect(page.getByTestId('plan-code')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-pdf').click()]);
  expect(download.suggestedFilename()).toMatch(/-es\.pdf$/);
});
