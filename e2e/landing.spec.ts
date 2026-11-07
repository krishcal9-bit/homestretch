import { test, expect } from '@playwright/test';

test('the intro plays on every load; any key skips straight to the hero', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('intro')).toBeVisible();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('intro')).toHaveCount(0, { timeout: 2000 });
  await expect(page.getByTestId('find-my-date')).toBeVisible();
  await expect(page.getByTestId('door-keep')).toBeVisible();
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

test('the hero offers two doors: keeping a home and getting one', async ({ page }) => {
  await page.goto('/?nointro');
  await expect(page.getByTestId('door-keep')).toHaveAttribute('href', '/keep');
  await expect(page.getByTestId('find-my-date')).toHaveAttribute('href', '/start');
  await page.getByTestId('find-my-date').click();
  await page.waitForURL('**/start');
});
