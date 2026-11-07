import { test, expect } from '@playwright/test';

// Round 6: light and dark mode. The theme is on <html data-theme> before first paint (no flash), follows the
// system setting until the family picks one, remembers the pick, and switches instantly under reduced motion.

test('a stored theme is on <html> before the first frame (no flash)', async ({ page, request }) => {
  // the server HTML carries the pre-paint script in <head>, ahead of the body
  const html = await (await request.get('/start')).text();
  const head = html.slice(0, html.indexOf('<body'));
  expect(head).toContain("localStorage.getItem('hs.theme')");

  await page.addInitScript(() => {
    localStorage.setItem('hs.theme', 'dark');
    const w = window as unknown as { __themeAtBody?: string; __themeAtFrame?: string };
    // the moment <body> is created (before any of it can paint) and the first animation frame
    new MutationObserver((_, obs) => {
      if (document.body) {
        w.__themeAtBody = document.documentElement.dataset.theme ?? 'none';
        obs.disconnect();
      }
    }).observe(document, { childList: true, subtree: true });
    requestAnimationFrame(() => {
      w.__themeAtFrame = document.documentElement.dataset.theme ?? 'none';
    });
  });
  await page.goto('/start');
  const seen = await page.evaluate(() => {
    const w = window as unknown as { __themeAtBody?: string; __themeAtFrame?: string };
    return [w.__themeAtBody, w.__themeAtFrame];
  });
  expect(seen).toEqual(['dark', 'dark']);
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(15, 21, 19)');
});

test('with no stored choice the page follows the system setting, live', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/start');
  await page.evaluate(() => localStorage.removeItem('hs.theme'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('the header switch flips the theme, says what it will do, and is remembered', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/start');
  await page.evaluate(() => localStorage.removeItem('hs.theme'));
  await page.reload();
  const toggle = page.getByTestId('theme-toggle');
  await expect(toggle).toHaveAccessibleName('Switch to dark mode');
  const box = await toggle.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAccessibleName('Switch to light mode');
  expect(await page.evaluate(() => localStorage.getItem('hs.theme'))).toBe('dark');
  // the explicit choice wins over the system setting, across reloads and pages
  await page.goto('/plan/NGU7P3');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('reduced motion switches instantly (no view transition)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/start');
  await page.evaluate(() => localStorage.removeItem('hs.theme'));
  await page.reload();
  await page.getByTestId('theme-toggle').click();
  // the attribute changes in the click's own task: no transition is pending
  const state = await page.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.vt ?? 'none']);
  expect(state).toEqual(['dark', 'none']);
});

test('the switch is in the staff console and on the sign-in page', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/staff/login');
  await expect(page.getByTestId('theme-toggle')).toBeVisible();
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
