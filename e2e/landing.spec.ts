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

test('Down arrow moves section by section (the cost scene one stage per press); the last arrow returns to the top', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?nointro');
  await page.waitForTimeout(1600);
  const top = async (id: string) => page.evaluate((i) => Math.round(document.getElementById(i)!.getBoundingClientRect().top), id);
  const y = async () => page.evaluate(() => Math.round(window.scrollY));
  const header = async () => page.evaluate(() => Math.round(document.querySelector('header')!.getBoundingClientRect().top));
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(950);
  expect(Math.abs((await top('scene-cost')) - 64)).toBeLessThan(4);
  // four more presses walk the pinned scene's stages; the section stays pinned and the header never moves
  let last = await y();
  for (let k = 0; k < 4; k++) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(950);
    const now = await y();
    expect(now).toBeGreaterThan(last + 100);
    expect(await header()).toBe(0);
    last = now;
  }
  for (const id of ['scene-intake', 'scene-road', 'scene-homes', 'closing']) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(950);
    expect(Math.abs((await top(id)) - 64)).toBeLessThan(4);
    expect(await header()).toBe(0);
  }
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(950);
  expect(Math.abs((await top('scene-homes')) - 64)).toBeLessThan(4);
  await page.getByTestId('section-dots').getByRole('button').last().click();
  await page.waitForTimeout(950);
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
