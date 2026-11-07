// Screenshots of the staff KEEP console (Early warning, drawer, Stress test, Weekly digest) at 1440×900 in light
// and dark. Run against a server started with MOCK_CLAUDE=1:
//   SHOT_PORT=3171 npx tsx --env-file=.env scripts/shot-staff-keep.ts
import { chromium, type Page } from 'playwright';

const BASE = `http://localhost:${process.env.SHOT_PORT ?? 3000}`;
const OUT = process.env.SHOT_DIR ?? 'docs/screenshots/staff';

async function login(p: Page) {
  await p.goto(`${BASE}/staff/login`);
  await p.fill('input[type=password]', process.env.STAFF_PASSWORD ?? '');
  await p.keyboard.press('Enter');
  await p.waitForSelector('[data-testid=homeowner-row]', { timeout: 90_000 });
}

(async () => {
  const b = await chromium.launch();
  for (const theme of ['light', 'dark'] as const) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
    await ctx.addInitScript((t) => localStorage.setItem('hs.theme', t), theme);
    const p = await ctx.newPage();
    await login(p);
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}/early-warning-${theme}.png` });
    await p.locator('[data-testid=homeowner-row][data-id=ho01]').click();
    await p.getByTestId('homeowner-drawer').waitFor();
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${OUT}/drawer-${theme}.png` });
    await p.getByTestId('draft-outreach').click();
    await p.getByTestId('homeowner-note').waitFor({ timeout: 30_000 });
    await p.waitForTimeout(500);
    await p.getByTestId('homeowner-outreach').scrollIntoViewIfNeeded();
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}/drawer-outreach-${theme}.png` });
    await p.goto(`${BASE}/staff/stress`);
    await p.getByTestId('stress-chart').waitFor();
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${OUT}/stress-test-${theme}.png` });
    await p.goto(`${BASE}/staff/digest`);
    await p.getByTestId('run-digest').click();
    await p.getByTestId('digest-item').nth(3).waitFor({ timeout: 60_000 });
    await p.waitForFunction(() => document.querySelector('[data-testid=run-digest]')?.textContent?.includes('Run again') && !document.querySelector('[data-testid=run-digest]')?.hasAttribute('disabled'), null, { timeout: 60_000 });
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUT}/digest-${theme}.png` });
    await p.goto(`${BASE}/staff/ready`);
    await p.waitForSelector('[data-testid=family-row]');
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUT}/ready-pipeline-${theme}.png` });
    await ctx.close();
  }
  await b.close();
})();
