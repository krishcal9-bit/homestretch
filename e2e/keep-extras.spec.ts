import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DEMO_DRAFT } from './helpers';

// KEEP extras: Home health, Relief, Check-in, the Ready "first year of owning" bridge (MOCK_CLAUDE=1).

async function sampleFamily(page: Page, path: string, lang: 'en' | 'es' = 'en') {
  await page.goto(path);
  await page.evaluate((l) => {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = `hs_lang=${l}; path=/`;
  }, lang);
  await page.reload();
  await page.getByTestId('use-sample-family').click();
}

const keepState = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('hs.keep') ?? '{}'));

test('home health: the sample photo pre-fills an age, saves the system, and the leak help gives safe steps', async ({ page }) => {
  await sampleFamily(page, '/keep/home');
  await expect(page.getByRole('heading', { name: 'Home health', level: 1 })).toBeVisible();
  const before = await page.getByTestId('set-aside').innerText();

  await page.getByTestId('use-sample-photo').click();
  const read = page.getByTestId('read-result');
  await expect(read).toBeVisible({ timeout: 15_000 });
  await expect(read).toContainText('Water heater, made in 2014');
  await expect(page.locator('#read-age')).toHaveValue('12');
  await expect(page.getByTestId('read-confidence')).toHaveText('High confidence');

  // they can edit the age before saving
  await read.getByRole('button', { name: 'One year older: Water heater' }).click();
  await expect(page.locator('#read-age')).toHaveValue('13');
  await read.getByRole('button', { name: 'One year younger: Water heater' }).click();
  await page.getByTestId('save-system').click();
  await expect(page.getByTestId('system-saved')).toContainText('Water heater');
  await expect(page.getByTestId('system-water_heater').locator('input')).toHaveValue('12');
  await expect(page.getByTestId('repair-timeline')).toContainText('Due now');
  await expect.poll(async () => page.getByTestId('set-aside').innerText()).not.toBe(before);

  const s = await keepState(page);
  const wh = s.profile.systems.find((x: { kind: string }) => x.kind === 'water_heater');
  expect(wh).toMatchObject({ ageYears: 12, source: 'photo', confidence: 'high' });
  expect(s.profile.systems.filter((x: { kind: string }) => x.kind === 'water_heater')).toHaveLength(1);

  // "My water heater is leaking"
  await page.getByTestId('leak-water-heater').click();
  await expect(page.getByTestId('leak-urgency')).toHaveText('Do this now');
  await expect(page.getByTestId('leak-steps').locator('ol li')).toHaveCount(5);
  await expect(page.getByTestId('leak-steps')).toContainText('You have $300 saved for the house.');
});

test('relief: the five programs render, can be marked done, and the exemption sets the profile', async ({ page }) => {
  await sampleFamily(page, '/keep/relief');
  const list = page.getByTestId('relief-list');
  await expect(list.locator('> li')).toHaveCount(5);
  for (const name of ["California Homeowners' Exemption", 'CARE and FERA utility discounts', 'Safer from Wildfires', 'Habitat OC home repair programs', '211 Orange County']) await expect(list).toContainText(name);
  await expect(page.getByTestId('relief-item-careFera')).toContainText('FERA');
  await expect(page.getByTestId('relief-item-exemption').getByRole('link')).toHaveAttribute('href', /boe\.ca\.gov/);
  await expect(page.getByTestId('relief-count')).toHaveText('0 of 5 done');

  await page.locator('label[for=relief-exemption]').first().click();
  await page.locator('label[for=relief-wildfire]').first().click();
  await expect(page.getByTestId('relief-count')).toHaveText('2 of 5 done');
  await expect(page.locator('#relief-exemption')).toBeChecked();
  const s = await keepState(page);
  expect(s.reliefDone).toEqual(expect.arrayContaining(['exemption', 'wildfire']));
  expect(s.profile.homeownersExemption).toBe(true);

  await page.reload();
  await expect(page.locator('#relief-exemption')).toBeChecked();
  await page.locator('label[for=relief-wildfire]').first().click();
  await expect(page.getByTestId('relief-count')).toHaveText('1 of 5 done');

  // the one-page home plan
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-testid=download-home-plan]:visible').click()]);
  expect(download.suggestedFilename()).toBe('my-home-plan-en.pdf');
});

test('check-in: three tap questions update the profile and say how the forecast moved', async ({ page }) => {
  await sampleFamily(page, '/keep/checkin');
  const choices = page.getByTestId('checkin-choices');
  const tap = (name: string) => choices.getByRole('button', { name, exact: true }).click();
  await expect(page.getByTestId('checkin-thread')).toContainText('Any new bills for the house this month?');

  await tap('Yes, a bill went up');
  await tap('Insurance premium');
  await page.locator('#checkin-amount').fill('1980');
  await page.getByTestId('checkin-send').click();
  await expect(page.getByTestId('checkin-thread')).toContainText(/Your highest month is now \$[\d,]+, in [A-Z][a-z]+ \d{4}: \$\d+ more than before\./);
  let s = await keepState(page);
  expect(s.profile.premium).toBe(1980);
  expect(s.profile.escrow).toBe(483);

  await tap('It went down');
  await page.locator('#checkin-amount').fill('4200');
  await page.getByTestId('checkin-send').click();
  await expect(page.getByTestId('checkin-thread')).toContainText(/tightest month/);
  s = await keepState(page);
  expect(s.profile.takeHome).toBe(4200);

  await tap('Water heater');
  await expect(page.getByTestId('checkin-thread')).toContainText(/Flagged\. Your repair set-aside is now \$[\d,]+ a month/);
  await expect(page.getByTestId('checkin-saved')).toBeVisible({ timeout: 10_000 });
  s = await keepState(page);
  const wh = s.profile.systems.find((x: { kind: string }) => x.kind === 'water_heater');
  expect(wh.lifeYears - wh.ageYears).toBe(1);
  expect(s.checkins).toHaveLength(1);
  expect(s.checkins[0]).toMatchObject({ newBills: true, incomeChange: 4200 - 4570, breaking: 'water_heater' });
});

test('Ready result shows "Your first year of owning" with a way into Keep', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((d) => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('hs.nointro', '1');
    document.cookie = 'hs_lang=en; path=/';
    localStorage.setItem('hs.draft', JSON.stringify(d));
    localStorage.setItem('hs.step', '5');
  }, DEMO_DRAFT);
  await page.goto('/start');
  const fy = page.getByTestId('first-year');
  await expect(fy).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Your first year of owning' })).toBeVisible();
  await expect(fy).toContainText('Mortgage');
  await expect(fy).toContainText('Property tax and insurance');
  await expect(fy).toContainText('Set aside for repairs');
  await expect(page.getByTestId('first-year-total')).toHaveText(/^\$[\d,]+$/);
  await expect(page.getByTestId('see-keep')).toHaveAttribute('href', '/keep');
  await audit(page, 'ready result');
});

// English strings that must never show once Spanish is on.
const ENGLISH = [
  'Home health', 'Set aside for repairs', 'The next five years', 'Your systems', 'Add or check a system', 'Something leaking or broken?', 'My water heater is leaking',
  'Do this now', 'Use the sample photo', 'High confidence', 'Water heater', 'Relief you can claim', 'Still to claim', 'You likely qualify', 'Next step', 'Worth checking',
  'Download my home plan', 'Monthly check-in', 'Any new bills', 'No new bills', 'Your highest month', 'a month', 'a year', 'Check-in saved', 'Open Home health',
];
async function noEnglish(page: Page) {
  const text = await page.locator('main').innerText();
  for (const s of ENGLISH) expect(text.includes(s), `found English "${s}"`).toBe(false);
}

test('Spanish: Home health, Relief and Check-in have no English', async ({ page }) => {
  await sampleFamily(page, '/keep/home', 'es');
  await expect(page.getByRole('heading', { name: 'Salud de la casa', level: 1 })).toBeVisible();
  await page.getByTestId('use-sample-photo').click();
  await expect(page.locator('#read-age')).toHaveValue('12', { timeout: 15_000 });
  await expect(page.getByTestId('read-confidence')).toHaveText('Confianza alta');
  await page.getByTestId('save-system').click();
  await page.getByTestId('leak-water-heater').click();
  await expect(page.getByTestId('leak-urgency')).toHaveText('Haga esto ahora');
  await expect(page.getByTestId('leak-steps')).toContainText('SoCalGas');
  await noEnglish(page);

  await page.goto('/keep/relief');
  await expect(page.getByTestId('relief-list').locator('> li')).toHaveCount(5);
  await expect(page.getByTestId('relief-list')).toContainText('Exención para Propietarios de California');
  await page.waitForLoadState('networkidle');
  await page.locator('label[for=relief-exemption]').first().click();
  await expect(page.getByTestId('relief-count')).toHaveText('1 de 5 hechos');
  await noEnglish(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-testid=download-home-plan]:visible').click()]);
  expect(download.suggestedFilename()).toBe('my-home-plan-es.pdf');

  await page.goto('/keep/checkin');
  const tap = (name: string) => page.getByTestId('checkin-choices').getByRole('button', { name, exact: true }).click();
  await tap('Sí, una cuenta subió');
  await tap('Cuota de HOA');
  await page.locator('#checkin-amount').fill('120');
  await page.getByTestId('checkin-send').click();
  await expect(page.getByTestId('checkin-thread')).toContainText('Su mes más alto ahora es');
  await tap('Sin cambio');
  await tap('Nada');
  await expect(page.getByTestId('checkin-saved')).toBeVisible({ timeout: 10_000 });
  await noEnglish(page);
});

async function audit(page: Page, name: string) {
  await page.waitForTimeout(1200);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || (a.effect?.getTiming().iterations ?? 1) === Infinity), null, { timeout: 5000 }).catch(() => {});
  const res = await new AxeBuilder({ page: page as never }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${name}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
}

for (const theme of ['light', 'dark'] as const) {
  test(`Keep extras have no serious or critical axe violations (${theme})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ colorScheme: theme });
    await sampleFamily(page, '/keep/home');
    await page.getByTestId('use-sample-photo').click();
    await expect(page.getByTestId('read-result')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('leak-water-heater').click();
    await expect(page.getByTestId('leak-steps')).toBeVisible();
    await audit(page, `home (${theme})`);
    await page.goto('/keep/relief');
    await page.locator('label[for=relief-exemption]').first().click();
    await audit(page, `relief (${theme})`);
    await page.goto('/keep/checkin');
    await page.getByTestId('checkin-choices').getByRole('button', { name: 'No new bills', exact: true }).click();
    await expect(page.getByTestId('checkin-choices').getByRole('button', { name: 'No change', exact: true })).toBeVisible();
    await audit(page, `checkin (${theme})`);
  });
}
