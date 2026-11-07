import { test, expect } from '@playwright/test';
import { staffReady } from './helpers';

test('wrong password is rejected', async ({ page }) => {
  await page.goto('/staff');
  await expect(page).toHaveURL(/\/staff\/login/);
  await page.locator('input[type=password]').fill('not-the-password');
  await page.keyboard.press('Enter');
  await expect(page.getByText("That password didn't work. Try again.")).toBeVisible();
});

test('ready pipeline buckets, drawer, homes, match, insights', async ({ page }) => {
  await staffReady(page);
  await expect(page.getByTestId('family-row')).toHaveCount(14);
  const expected: Record<string, number> = { ready_now: 2, le6: 4, six_18: 2, gt18: 4, not_eligible: 2 };
  for (const [k, n] of Object.entries(expected)) {
    await expect(page.getByTestId(`stage-${k}`).getByTestId('stage-count')).toHaveText(String(n));
  }

  // Drawer shows the same ready date the family page computes
  await page.getByTestId('family-row').filter({ hasText: 'Patel' }).click();
  const drawerDate = (await page.getByTestId('drawer-ready-date').innerText()).trim();
  const fam = await page.context().newPage();
  await fam.goto('/plan/PAT6H9');
  await expect(fam.getByTestId('ready-date')).toHaveText(drawerDate, { timeout: 15_000 });
  await fam.close();

  // Homes: at least one home with families projected ready
  await page.goto('/staff/homes');
  const counts = await page.getByTestId('home-row').evaluateAll((rows) => rows.map((r) => Number(r.getAttribute('data-ready-count'))));
  expect(Math.max(...counts)).toBeGreaterThan(0);

  // Match → Draft outreach contains the surname
  await page.goto('/staff/match?home=h1');
  const row = page.getByTestId('match-row').first();
  await expect(row).toBeVisible({ timeout: 20_000 });
  const surname = (await row.getAttribute('data-surname')) ?? '';
  await row.getByRole('button', { name: 'Draft outreach' }).click();
  await expect(page.getByTestId('outreach').first()).toHaveValue(new RegExp(surname), { timeout: 20_000 });

  // Insights simulator: 0 → > 0
  await page.goto('/staff/insights');
  await expect(page.getByTestId('more-ready')).toHaveText(/^0\b/);
  await page.getByRole('switch', { name: /Matched savings/i }).click();
  await expect(page.getByTestId('more-ready')).not.toHaveText(/^0\b/);
});

test('Monday check-in twice: second run reports no changes', async ({ page }) => {
  await staffReady(page);
  await page.getByTestId('run-checkin').click();
  await expect(page.getByTestId('checkin-item').nth(4)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('rerun')).toBeEnabled({ timeout: 60_000 });
  await page.getByTestId('rerun').click();
  await expect(page.getByTestId('no-changes')).toBeVisible({ timeout: 60_000 });
});
