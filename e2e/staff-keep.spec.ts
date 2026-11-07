import { test, expect } from '@playwright/test';
import { homeownerRows, riskCounts, stressHomes } from '../lib/earlyWarning';
import { stressTest, thisMonth } from '../lib/forecast';
import { staffLogin } from './helpers';

// Expected numbers come from the same engine the console uses, run here for today.
const today = new Date();
const rows = homeownerRows(today);
const counts = riskCounts(rows);

test('early warning: risk counts, a drawer, a Spanish draft; stress test; weekly digest', async ({ page }) => {
  await staffLogin(page);
  await expect(page.getByTestId('sample-data')).toBeVisible();
  await expect(page.getByTestId('homeowner-row')).toHaveCount(40);
  await expect(page.getByTestId('ew-summary')).toHaveAttribute('data-at-risk', String(counts.act + counts.watch));
  await expect(page.getByTestId('ew-summary')).toContainText(`${counts.act + counts.watch} homeowners`);
  for (const l of ['act', 'watch', 'stable'] as const) {
    await expect(page.getByTestId(`ew-count-${l}`)).toHaveAttribute('data-count', String(counts[l]));
    await expect(page.locator(`[data-testid=homeowner-row][data-level=${l}]`)).toHaveCount(counts[l]);
  }
  // sorted by risk: the first row is the riskiest household
  await expect(page.getByTestId('homeowner-row').first()).toHaveAttribute('data-id', rows[0].id);
  expect(await page.locator('main').innerText()).not.toMatch(/NaN|Infinity|undefined/);

  // a Spanish-preferring household: drawer, forecast, moves, home health, draft in Spanish with an English translation
  const es = rows.find((r) => r.language === 'es')!;
  await page.locator(`[data-testid=homeowner-row][data-id=${es.id}]`).click();
  const drawer = page.getByTestId('homeowner-drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('heading', { name: `${es.surname} family` })).toBeVisible();
  await expect(drawer.getByTestId('homeowner-forecast')).toBeVisible();
  await expect(drawer.getByTestId('shield-moves').locator('li')).not.toHaveCount(0);
  await drawer.getByTestId('draft-outreach').click();
  const note = drawer.getByTestId('homeowner-note');
  await expect(note).toHaveValue(new RegExp(es.surname), { timeout: 20_000 });
  await expect(note).toHaveValue(/Hola/);
  await expect(drawer.getByTestId('homeowner-translation')).toContainText(es.surname);
  await expect(drawer.getByTestId('homeowner-translation')).toContainText(/Hi /);
  const words = (await note.inputValue()).trim().split(/\s+/).length;
  expect(words).toBeLessThan(120);
  await drawer.getByTestId('approve-outreach').click();
  await expect(page.getByText(`Sample send to the ${es.surname} family`)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);

  // stress test: the at-risk count matches the engine and moves with the insurance slider
  const homes = stressHomes(today);
  const opts = { start: thisMonth(today), today };
  const at29 = stressTest(homes, { insuranceIncrease: 0.29, supplemental: false, hardshipFund: 0, matchedRepair: 150 }, opts);
  const at0 = stressTest(homes, { insuranceIncrease: 0, supplemental: false, hardshipFund: 0, matchedRepair: 150 }, opts);
  expect(at0.atRiskBefore).not.toBe(at29.atRiskBefore);
  await page.goto('/staff/stress');
  await expect(page.getByTestId('at-risk-before')).toHaveAttribute('data-value', String(at29.atRiskBefore));
  await expect(page.getByTestId('at-risk-after')).toHaveAttribute('data-value', String(at29.atRiskAfter));
  await expect(page.getByTestId('stress-headline')).toContainText(`A 29% insurance jump puts ${at29.atRiskBefore} of 40 homeowners at risk.`);
  await page.locator('#st-ins').focus();
  await page.keyboard.press('Home');
  await expect(page.getByTestId('st-ins-value')).toHaveText('0%');
  await expect(page.getByTestId('at-risk-before')).toHaveAttribute('data-value', String(at0.atRiskBefore));
  await expect(page.getByTestId('at-risk-before')).toHaveText(String(at0.atRiskBefore));

  // weekly digest streams households in, each with a draft to approve; Spanish households get a Spanish draft
  await page.goto('/staff/digest');
  await expect(page.getByTestId('digest-item')).toHaveCount(0);
  await page.getByTestId('run-digest').click();
  await expect(page.getByTestId('digest-item').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('run-digest')).toHaveText('Run again', { timeout: 60_000 });
  await expect(page.getByTestId('run-digest')).toBeEnabled({ timeout: 60_000 });
  const n = await page.getByTestId('digest-item').count();
  expect(n).toBeGreaterThan(0);
  const esItem = page.locator('[data-testid=digest-item][data-lang=es]').first();
  if (await esItem.count()) await expect(esItem.getByTestId('digest-draft-es')).toContainText(/Hola/);
  const first = page.getByTestId('digest-item').first();
  await first.getByTestId('digest-edit').click();
  await expect(first.locator('textarea').first()).toBeVisible();
  await first.getByTestId('digest-approve').click();
  await expect(first.getByTestId('digest-approve')).toHaveText('Approved');
});

test('the digest API streams NDJSON and validates its input', async ({ page }) => {
  await staffLogin(page);
  const bad = await page.request.post('/api/digest', { data: { surprise: true } });
  expect(bad.status()).toBe(400);
  expect((await bad.json()).error.code).toBe('invalid_input');
  const res = await page.request.post('/api/digest', { data: {} });
  const lines = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
  expect(lines[0]).toMatchObject({ type: 'start', total: 40 });
  expect(lines.at(-1)?.type).toBe('done');
  expect(lines.filter((l) => l.type === 'household').length).toBeGreaterThan(0);
  const badOutreach = await page.request.post('/api/outreach/homeowner', { data: { id: 'nope' } });
  expect(badOutreach.status()).toBe(400);
});
