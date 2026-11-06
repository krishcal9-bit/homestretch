import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DEMO_DRAFT, staffLogin } from './helpers';

async function audit(page: Page, name: string) {
  await page.waitForTimeout(1500); // let the Road entrance finish
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(600);
  const res = await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${name}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
}

test('family routes have no serious or critical axe violations', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await audit(page, 'welcome');
  for (const step of [1, 2, 3, 4, 5]) {
    await page.evaluate(([d, s]) => { localStorage.setItem('hs.draft', JSON.stringify(d)); localStorage.setItem('hs.step', String(s)); }, [DEMO_DRAFT, step] as const);
    await page.reload();
    await audit(page, `step-${step}`);
  }
  await page.goto('/plan/NGU7P3');
  await audit(page, 'plan');
  await page.goto('/plan/notarealcode');
  await audit(page, 'plan-404');
});

test('staff routes have no serious or critical axe violations', async ({ page }) => {
  await page.goto('/staff/login');
  await audit(page, 'login');
  await staffLogin(page);
  await audit(page, 'pipeline');
  await page.getByTestId('family-row').first().click();
  await audit(page, 'drawer');
  for (const r of ['/staff/homes', '/staff/match?home=h1', '/staff/insights']) {
    await page.goto(r);
    await audit(page, r);
  }
});
