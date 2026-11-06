import { test, expect } from '@playwright/test';

test('the intro plays on every load; any key skips straight to the hero', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('intro')).toBeVisible();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('intro')).toHaveCount(0, { timeout: 2000 });
  await expect(page.getByTestId('find-my-date')).toBeVisible();
  await expect(page.getByTestId('sample-date')).toHaveText(/[A-Z][a-z]+ \d{4}/);
  await page.reload();
  await expect(page.getByTestId('intro')).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(page.getByTestId('intro')).toHaveCount(0, { timeout: 2000 });
});

test('Down arrow moves section by section; the last arrow returns to the top', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?nointro');
  await page.waitForTimeout(1600);
  const top = async (id: string) => page.evaluate((i) => Math.round(document.getElementById(i)!.getBoundingClientRect().top), id);
  for (const id of ['scene-intake', 'scene-road', 'scene-homes', 'closing']) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(950);
    expect(Math.abs((await top(id)) - 64)).toBeLessThan(4);
  }
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(950);
  expect(Math.abs((await top('scene-homes')) - 64)).toBeLessThan(4);
  await page.getByTestId('section-dots').getByRole('button').last().click();
  await page.waitForTimeout(950);
  await page.getByTestId('section-arrow-4').click();
  await page.waitForTimeout(950);
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBeLessThan(4);
});

test('dragging the sample slider shows how much sooner, and the ticker shows sample families', async ({ page }) => {
  await page.goto('/?nointro');
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
