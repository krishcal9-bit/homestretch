import { test, expect } from '@playwright/test';
import { freshStart, next } from './helpers';
import path from 'path';

test('pay stub scan prefills income with a tag', async ({ page }) => {
  await freshStart(page);
  await page.getByRole('button', { name: 'Start' }).click();
  await next(page);
  await page.locator('#file-paystub').setInputFiles(path.join(__dirname, '../fixtures/paystub.png'));
  await expect(page.getByTestId('upload-paystub-done')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#gross')).toHaveValue('5,200');
  await expect(page.getByTestId('from-paystub')).toContainText('From your pay stub');
});

test('a text file gets a friendly error, not a crash', async ({ page }) => {
  await freshStart(page);
  await page.getByRole('button', { name: 'Start' }).click();
  for (let i = 0; i < 3; i++) {
    if (i === 1) await page.fill('#gross', '5200');
    if (i === 2) await page.fill('#rent', '2000');
    await next(page);
  }
  await page.locator('#file-statement').setInputFiles(path.join(__dirname, '../fixtures/not-a-statement.txt'));
  const err = page.getByTestId('upload-statement-error');
  await expect(err).toBeVisible({ timeout: 20_000 });
  await expect(err).toContainText('We can only read photos');
  await expect(page.getByRole('heading', { name: 'Your money picture' })).toBeVisible();
});

test('statement upload drives Underwriter\'s eye and a letter of explanation', async ({ page }) => {
  await freshStart(page);
  await page.getByRole('button', { name: 'Start' }).click();
  for (let i = 0; i < 3; i++) {
    if (i === 1) await page.fill('#gross', '5200');
    if (i === 2) await page.fill('#rent', '2350');
    await next(page);
  }
  await page.locator('#file-statement').setInputFiles(path.join(__dirname, '../fixtures/bank-statement.png'));
  await expect(page.getByTestId('upload-statement-done')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#debt-car-payment')).toHaveValue('342');
  await page.fill('#savings', '3100');
  await page.getByRole('radio', { name: 'Building' }).click();
  await next(page);
  const ue = page.getByTestId('underwriters-eye');
  await expect(ue).toBeVisible({ timeout: 20_000 });
  await expect(ue).toContainText('overdraft');
  await ue.getByTestId('write-letter').first().click();
  await expect(page.getByTestId('letter-text')).toHaveValue(/Sincerely/, { timeout: 20_000 });
});
