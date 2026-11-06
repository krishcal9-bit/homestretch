import { test, expect } from '@playwright/test';

test('first visit plays the opening; any key skips it; it does not replay in the session', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await expect(page.getByTestId('opening')).toBeVisible();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('opening')).toHaveCount(0);
  await expect(page.getByTestId('find-my-date')).toBeVisible();
  await expect(page.getByTestId('sample-date')).toHaveText(/[A-Z][a-z]+ \d{4}/);
  await page.reload();
  await page.waitForTimeout(300);
  await expect(page.getByTestId('opening')).toHaveCount(0);
});

test('dragging the sample slider shows how much sooner, and the ticker shows sample families', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => sessionStorage.setItem('hs.opened', '1'));
  await page.reload();
  await expect(page.getByTestId('ticker')).toContainText('Sample families');
  await page.waitForTimeout(1800);
  const s = page.locator('#sample-extra');
  const box = (await s.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.375, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 15; i++) await page.mouse.move(box.x + box.width * (0.375 + (0.6 * i) / 15), box.y + box.height / 2);
  await page.mouse.up();
  await expect(page.getByTestId('delta-pill')).toContainText('sooner');
});
