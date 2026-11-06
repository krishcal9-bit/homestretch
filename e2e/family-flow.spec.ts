import { test, expect } from '@playwright/test';
import { completeIntakeByKeyboard, freshStart, monthIndex } from './helpers';

test('family completes intake by keyboard, explores levers, aims for a home, saves and reopens the plan', async ({ page }) => {
  await freshStart(page);
  await completeIntakeByKeyboard(page);

  // Result
  const date = page.getByTestId('ready-date');
  await expect(date).toHaveText(/[A-Z][a-z]+ \d{4}/, { timeout: 10_000 });
  const before = monthIndex(await date.innerText());
  expect(before).not.toBeNaN();

  // Drag "Extra toward debt" — no network requests during the drag
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  const slider = page.locator('#lever-extraDebt');
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  await page.mouse.move(box.x + 6, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(box.x + 6 + (box.width * 0.4 * i) / 20, box.y + box.height / 2);
  await page.mouse.up();
  await page.waitForTimeout(400);
  expect(requests.filter((u) => !u.includes('/_next/') && !u.includes('webpack'))).toEqual([]);
  const after = monthIndex(await date.innerText());
  expect(after).toBeLessThan(before);

  // D1: aim for a home that a plan can reach
  const debtBefore = await page.inputValue('#lever-extraDebt-n');
  const saveBefore = await page.inputValue('#lever-monthlySavings-n');
  const home = page.locator('[data-testid=homes] button', { hasText: 'Westminster' });
  await home.scrollIntoViewIfNeeded();
  await home.click();
  await expect(page.getByTestId('aim-sentence')).toContainText('Westminster');
  await page.waitForTimeout(1200);
  const changed = (await page.inputValue('#lever-extraDebt-n')) !== debtBefore || (await page.inputValue('#lever-monthlySavings-n')) !== saveBefore;
  expect(changed).toBe(true);

  // Plan + save
  await expect(page.getByTestId('checklist')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Save my plan' }).click();
  const code = (await page.getByTestId('plan-code').innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{6}$/);

  // Shareable plan: tick an item, reload, still ticked
  await page.goto(`/plan/${code}`);
  await expect(page.getByTestId('checklist')).toBeVisible({ timeout: 15_000 });
  const first = page.locator('#action-0');
  await expect(first).not.toBeChecked();
  const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes(`/api/plans/${code}`));
  await page.locator('label[for=action-0]').first().click();
  await expect(first).toBeChecked();
  expect((await saved).ok()).toBe(true);
  await page.reload();
  await expect(page.locator('#action-0')).toBeChecked({ timeout: 10_000 });
});

test('unknown plan code shows a friendly message', async ({ page }) => {
  await page.goto('/plan/notarealcode');
  await expect(page.getByText("We couldn't find that plan. Check the code or start a new one.")).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start a new plan' })).toBeVisible();
});

test('refresh mid-flow restores the screen', async ({ page }) => {
  await freshStart(page);
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.fill('#gross', '4800');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'What does your household earn?' })).toBeVisible();
  await expect(page.locator('#gross')).toHaveValue('4,800');
});
