import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'path';
import { DEMO_DRAFT, freshStart, next, staffLogin } from './helpers';

async function audit(page: Page, name: string) {
  await page.waitForTimeout(1500); // let the Road entrance finish
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(600);
  const res = await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${name}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
}

// Every route in both themes (round 6). The theme comes from the system setting: each test clears storage,
// so no stored choice overrides it.
for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    // nine routes, each settled before the audit: more than the default minute
    test.describe.configure({ timeout: 150_000 });
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
    });

    test('family routes have no serious or critical axe violations', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => { localStorage.clear(); sessionStorage.setItem('hs.nointro', '1'); });
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await audit(page, `landing (${theme})`);
      for (const step of [1, 2, 3, 4, 5]) {
        await page.evaluate(([d, s]) => { localStorage.setItem('hs.draft', JSON.stringify(d)); localStorage.setItem('hs.step', String(s)); }, [DEMO_DRAFT, step] as const);
        await page.goto('/start');
        await audit(page, `step-${step} (${theme})`);
      }
      await page.goto('/plan/NGU7P3');
      await audit(page, `plan (${theme})`);
      await page.goto('/plan/notarealcode');
      await audit(page, `plan-404 (${theme})`);
      await page.goto('/no-such-page');
      await audit(page, `not-found (${theme})`);
    });

    test('a letter of explanation has no serious or critical axe violations', async ({ page }) => {
      await freshStart(page);
      for (let i = 0; i < 3; i++) {
        if (i === 1) await page.fill('#gross', '5200');
        if (i === 2) await page.fill('#rent', '2350');
        await next(page);
      }
      await page.locator('#file-statement').setInputFiles(path.join(__dirname, '../fixtures/bank-statement.png'));
      await expect(page.getByTestId('upload-statement-done')).toBeVisible({ timeout: 20_000 });
      await page.fill('#savings', '3100');
      await page.getByRole('radio', { name: 'Building' }).click();
      await next(page);
      const ue = page.getByTestId('underwriters-eye');
      await expect(ue).toBeVisible({ timeout: 20_000 });
      await ue.getByTestId('write-letter').first().click();
      await expect(page.getByTestId('letter-text')).toHaveValue(/Sincerely/, { timeout: 20_000 });
      await audit(page, `letter (${theme})`);
    });

    test('staff routes have no serious or critical axe violations', async ({ page }) => {
      await page.goto('/staff/login');
      await audit(page, `login (${theme})`);
      await staffLogin(page);
      await audit(page, `pipeline (${theme})`);
      await page.getByTestId('family-row').first().click();
      await audit(page, `drawer (${theme})`);
      for (const r of ['/staff/homes', '/staff/match?home=h1', '/staff/insights']) {
        await page.goto(r);
        await audit(page, `${r} (${theme})`);
      }
    });
  });
}
