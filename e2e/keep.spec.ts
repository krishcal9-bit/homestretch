import { test, expect, type Page } from '@playwright/test';
import path from 'path';

async function freshKeep(page: Page, lang: 'en' | 'es' = 'en') {
  await page.goto('/keep');
  await page.evaluate((l) => {
    localStorage.removeItem('hs.keep');
    document.cookie = `hs_lang=${l}; path=/`;
  }, lang);
  await page.reload();
  await expect(page.getByTestId('keep-setup')).toBeVisible();
}

const feltOf = async (page: Page) => {
  const txt = (await page.getByTestId('shock-marker-amount').first().innerText()).replace(/[^\d]/g, '');
  return txt ? Number(txt) : 0;
};

test('sample family: a March shock, the slider flattens it, and the Shock Shield has moves', async ({ page }) => {
  await freshKeep(page);
  await page.getByTestId('keep-try-sample').click();
  await expect(page.getByTestId('keep-forecast')).toBeVisible();

  // the FAIR Plan renewal in March: +$69/month, from the engine
  const headline = page.getByTestId('keep-headline');
  await expect(headline).toHaveAttribute('data-kind', 'rise');
  await expect(headline).toContainText('March');
  await expect(page.getByTestId('headline-amount')).toHaveText('$69', { timeout: 5000 });
  const marker = page.getByTestId('shock-marker').first();
  await expect(marker).toContainText('Mar 2027');
  await expect(marker).toContainText('+$69/month');
  await expect(marker).toContainText('insurance renewal');
  await expect(page.getByTestId('recommendation')).toContainText("Set aside $48 a month starting now and March won't hurt.");

  // drag-equivalent: a partial set-aside softens the jump, the recommended one flattens it
  const slider = page.locator('#keep-setaside');
  await slider.fill('6');
  await expect.poll(() => feltOf(page)).toBeLessThan(69);
  await expect.poll(() => feltOf(page)).toBeGreaterThan(0);
  await slider.fill('48');
  await expect(marker).toContainText('Covered');
  await expect(page.locator('[data-testid=keep-headline][data-kind=covered]')).toBeVisible();
  await expect(page.getByTestId('setaside-value')).toHaveText('$48 a month');

  // Shock Shield: four ranked moves with engine effects
  const moves = page.getByTestId('shield-moves');
  await expect(moves).toBeVisible({ timeout: 30_000 });
  await expect(moves.locator('> li')).toHaveCount(4);
  for (const k of ['setAside', 'insurance', 'claim', 'habitat']) await expect(page.getByTestId(`move-${k}`)).toBeVisible();
  await expect(page.getByTestId('move-insurance').getByTestId('move-effect')).toHaveText(/^\+\$\d+\/month breathing room$/);

  // applying the deductible move lowers the March rise in the forecast
  await slider.fill('0');
  await expect(marker).toContainText('+$69/month');
  await page.getByTestId('move-insurance-apply').click();
  await expect.poll(() => feltOf(page)).toBeLessThan(69);
  await page.getByTestId('move-insurance-apply').click(); // undo
  await expect(marker).toContainText('+$69/month');

  // set aside early: one tap creates the savings goal and sets the slider
  await page.getByTestId('move-setaside').click();
  await expect(page.getByTestId('goal-set')).toContainText('$48 a month');
  await expect(page.getByTestId('setaside-value')).toHaveText('$48 a month');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hs.keep')!));
  expect(saved.savingsGoal.monthly).toBe(48);
  expect(saved.profile.setAside).toBe(48);

  // talk to Habitat early: a pre-written, editable message
  await page.getByTestId('move-habitat-write').click();
  await expect(page.getByTestId('habitat-text')).toHaveValue(/Ramirez family.*March 2027.*\$69/);
  await page.getByTestId('move-habitat-send').click();
  await expect(page.getByRole('status')).toContainText('Sent');
  await expect(page.getByTestId('move-habitat')).toHaveAttribute('data-done', 'true');
});

test('the sample renewal notice fills the setup with "From your document" and explains the change', async ({ page }) => {
  await freshKeep(page);
  await page.locator('#file-keep-doc').setInputFiles(path.join(__dirname, '../public/samples/ramirez-insurance-renewal.png'));
  await expect(page.getByTestId('doc-done')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#keep-premium')).toHaveValue('1,416');
  await expect(page.locator('#keep-renewalMonth')).toHaveValue('3');
  await expect(page.locator('#keep-insurer')).toHaveValue('California FAIR Plan');
  await expect(page.locator('#keep-fair')).toHaveAttribute('aria-checked', 'true');
  for (const f of ['premium', 'renewalMonth', 'insurer']) await expect(page.getByTestId(`from-doc-${f}`)).toContainText('From your document');
  await expect(page.getByTestId('doc-explain')).toHaveText("Your insurance is going up $412 a year, from $1,416 to $1,828. That's why your payment goes up about $69 a month in March.", { timeout: 30_000 });

  // editing a field makes it the family's own
  await page.fill('#keep-premium', '1500');
  await expect(page.getByTestId('from-doc-premium')).toHaveCount(0);

  // the "Use the sample notice" button does the same
  await freshKeep(page);
  await page.getByTestId('use-sample-notice').click();
  await expect(page.getByTestId('from-doc-premium')).toBeVisible({ timeout: 30_000 });
});

test('setup validates inline and finishes into the forecast; all-zero money never shows NaN', async ({ page }) => {
  await freshKeep(page);
  await page.getByTestId('keep-continue').click();
  await expect(page.locator('#keep-mortgage-error')).toHaveText('Add this to see your forecast.');
  await page.fill('#keep-mortgage', '1000');
  await page.fill('#keep-premium', '1300');
  await page.fill('#keep-propertyTax', '3800');
  await page.getByTestId('keep-continue').click();
  await expect(page.locator('[data-step=home]')).toBeVisible();
  await page.getByTestId('keep-continue').click();
  await expect(page.locator('[data-step=money]')).toBeVisible();
  await page.fill('#keep-takeHome', '5200');
  await page.getByTestId('keep-continue').click();
  await expect(page.getByTestId('keep-forecast')).toBeVisible();
  await expect(page.getByTestId('shock-marker').first()).toBeVisible();
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/NaN|undefined|Infinity/);
});

const ENGLISH = [
  'Your payment', 'likely to rise', 'a month', 'ready', 'Set aside', 'Breathing room', 'Shock shield', 'What you pay', 'Room to spare', 'Tight', 'Short',
  'insurance renewal', 'This month', 'After', 'Lowest', 'breathing room', 'Low effort', 'Some effort', 'Write to Habitat', 'Apply to my forecast',
  'Mark as filed', 'Claim', 'recommended', 'Edit my home', 'Start over', 'sample family', 'Forecast', 'Home health', 'Relief', 'Check-in', '/month',
];

test('Spanish: /keep has no English', async ({ page }) => {
  await freshKeep(page, 'es');
  await expect(page.getByRole('heading', { name: 'Registre su casa' })).toBeVisible();
  const check = async () => {
    const text = `${await page.locator('nav[aria-label]').first().innerText()}\n${await page.locator('main').innerText()}`;
    for (const s of ENGLISH) expect(text.includes(s), `found English "${s}"`).toBe(false);
  };
  await check();
  await page.getByTestId('use-sample-notice').click();
  await expect(page.getByTestId('doc-explain')).toContainText('Su seguro sube $412 al año', { timeout: 30_000 });
  await check();
  await page.getByTestId('keep-try-sample').click();
  await expect(page.getByTestId('keep-forecast')).toBeVisible();
  await expect(page.getByTestId('keep-headline')).toContainText('Es probable que su pago suba');
  await expect(page.getByTestId('shield-moves')).toBeVisible({ timeout: 30_000 });
  await check();
  await page.getByTestId('move-habitat-write').click();
  await expect(page.getByTestId('habitat-text')).toHaveValue(/^Hola/);
  await check();
});
