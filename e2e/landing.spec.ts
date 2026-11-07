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

test('the cost scene plays by itself, holds, and Down finishes it before moving on; the last arrow returns to the top', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?nointro');
  await page.waitForTimeout(1600);
  const top = async (id: string) => page.evaluate((i) => Math.round(document.getElementById(i)!.getBoundingClientRect().top), id);
  const y = async () => page.evaluate(() => Math.round(window.scrollY));
  const header = async () => page.evaluate(() => Math.round(document.querySelector('header')!.getBoundingClientRect().top));
  const phase = async () => page.getByTestId('scene-cost').getAttribute('data-phase');
  const labelsOut = async () =>
    page.evaluate(() => ['mortgage', 'tax', 'insurance', 'utilities', 'repairs'].every((k) => Number(getComputedStyle(document.querySelector(`[data-testid="cost-${k}"]`)!).opacity) > 0.95));
  // arrive and touch nothing: it plays, every label comes out, and it stays
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(950);
  expect(Math.abs((await top('scene-cost')) - 64)).toBeLessThan(4);
  expect(await phase()).toBe('playing');
  await expect.poll(phase, { timeout: 8000 }).toBe('done');
  expect(await labelsOut()).toBe(true);
  await page.waitForTimeout(1500);
  expect(Math.abs((await top('scene-cost')) - 64)).toBeLessThan(4);
  await expect(page.getByTestId('section-arrow-1')).toBeVisible();
  // the next press moves on
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(950);
  expect(Math.abs((await top('scene-intake')) - 64)).toBeLessThan(4);
  // back up: finished at once, with Replay; Replay plays it again
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(950);
  expect(await phase()).toBe('done');
  expect(await labelsOut()).toBe(true);
  await page.getByTestId('cost-replay').click();
  expect(await phase()).toBe('playing');
  // Down while it plays finishes it instead of leaving
  const before = await y();
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);
  expect(await phase()).toBe('done');
  expect(await y()).toBe(before);
  expect(await labelsOut()).toBe(true);
  for (const id of ['scene-intake', 'scene-road', 'scene-homes', 'closing']) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(950);
    expect(Math.abs((await top(id)) - 64)).toBeLessThan(4);
    expect(await header()).toBe(0);
  }
  await page.getByTestId('section-arrow-5').click();
  await page.waitForTimeout(950);
  expect(await y()).toBeLessThan(4);
});

test('every section has its headline on screen within 300ms of arriving (no blank sections)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?nointro');
  await page.waitForTimeout(1600);
  for (const id of ['scene-intake', 'scene-road', 'scene-homes']) {
    await page.getByTestId('section-dots').getByRole('button').nth(['hero', 'scene-cost', 'scene-intake', 'scene-road', 'scene-homes'].indexOf(id)).click();
    await page.waitForTimeout(800 + 300);
    const o = await page.evaluate((i) => {
      // the first line's mask and the line inside it: how much of the line is out of the mask
      const line = document.getElementById(i)!.querySelector('h2 > span.absolute > span > span') as HTMLElement | null;
      if (!line) return 0;
      const m = line.parentElement!.getBoundingClientRect();
      const r = line.getBoundingClientRect();
      return Number(getComputedStyle(line).opacity) * (1 - Math.max(0, r.top - m.top) / m.height);
    }, id);
    expect(o).toBeGreaterThan(0.5);
  }
});

test('the hero offers two doors: keeping a home and getting one', async ({ page }) => {
  await page.goto('/?nointro');
  await expect(page.getByTestId('door-keep')).toHaveAttribute('href', '/keep');
  await expect(page.getByTestId('find-my-date')).toHaveAttribute('href', '/start');
  await page.getByTestId('find-my-date').click();
  await page.waitForURL('**/start');
});
