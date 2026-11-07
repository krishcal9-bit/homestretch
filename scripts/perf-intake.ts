// Frame times at 4× CPU throttle while the household stepper is clicked repeatedly (and the housing steppers).
// Usage: npx tsx scripts/perf-intake.ts <baseUrl>
import { chromium, type Page } from 'playwright';

const base = process.argv[2] || 'http://localhost:3401';
type W = Window & { __frames: number[]; __run: boolean };

/** Raw pointer clicks at a fixed point (Playwright's locator.click runs its own checks in the page, which skews frames). */
async function tapper(page: Page, loc: ReturnType<Page['locator']>) {
  const box = (await loc.boundingBox())!;
  return () => page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function measure(page: Page, label: string, act: () => Promise<void>) {
  // A string, so tsx's helpers (__name) never reach the page.
  await page.evaluate(`(() => {
    window.__frames = [];
    window.__clicks = 0;
    if (!window.__counting) {
      window.__counting = true;
      document.addEventListener('pointerdown', () => { window.__clicks++; }, true);
    }
    let last = performance.now();
    function tick(t) {
      window.__frames.push([t - last, window.__clicks]);
      last = t;
      if (window.__run) requestAnimationFrame(tick);
    }
    window.__run = true;
    requestAnimationFrame(tick);
  })()`);
  await act();
  await page.waitForTimeout(600);
  const frames = await page.evaluate(() => {
    const w = window as unknown as W;
    w.__run = false;
    return (w.__frames as unknown as [number, number][]).slice(1);
  });
  const f = frames.map(([d]) => d);
  const sorted = [...f].sort((a, b) => a - b);
  const slow = frames.filter(([d]) => d > 34);
  console.log(
    `${label}: ${f.length} frames, median ${sorted[Math.floor(f.length / 2)].toFixed(1)}ms, p95 ${sorted[Math.floor(f.length * 0.95)].toFixed(1)}ms, max ${sorted[f.length - 1].toFixed(1)}ms, >34ms: ${slow.length} [${slow.map(([d, c]) => `${d.toFixed(0)}@tap${c}`).join(', ')}]`,
  );
}

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const draft = {
    householdSize: 3, inOC: true, residentOrCitizen: true, grossMonthlyIncome: 5200, otherIncomeOn: false, otherMonthlyIncome: null, rent: 2350, bedrooms: 2, occupants: 3, unsafeConditions: false,
    debts: { car: { payment: null, balance: null }, card: { payment: null, balance: null }, student: { payment: null, balance: null }, collection: { payment: null, balance: null }, other: { payment: null, balance: null } },
    savings: null, creditBand: null, levers: { extraDebt: 0, monthlySavings: 150, coApplicantIncome: 0 },
  };
  const go = async (step: number) => {
    await page.goto(base + '/');
    await page.evaluate(([d, s]) => {
      localStorage.clear();
      sessionStorage.setItem('hs.opened', '1');
      localStorage.setItem('hs.draft', JSON.stringify(d));
      localStorage.setItem('hs.step', String(s));
    }, [draft, step] as const);
    await page.goto(base + '/start');
    await page.waitForSelector(`[data-step="${step}"]`);
    await page.waitForTimeout(1200);
  };
  const cdp = await page.context().newCDPSession(page);
  await go(1);
  // Optional CSS to isolate a cost while profiling (e.g. hide one illustration): argv[3].
  if (process.argv[3]) await page.addStyleTag({ content: process.argv[3] });
  const more = await tapper(page, page.getByRole('button', { name: 'One more person' }));
  const fewer = await tapper(page, page.getByRole('button', { name: 'One fewer person' }));
  const idle = await tapper(page, page.getByRole('heading').first());
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await measure(page, 'control: clicks on the title (4x)', async () => {
    for (let i = 0; i < 16; i++) { await idle(); await page.waitForTimeout(90); }
  });
  await measure(page, 'household stepper x16 (4x)', async () => {
    for (let i = 0; i < 5; i++) { await more(); await page.waitForTimeout(90); }
    for (let i = 0; i < 6; i++) { await fewer(); await page.waitForTimeout(90); }
    for (let i = 0; i < 5; i++) { await more(); await page.waitForTimeout(90); }
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await go(3);
  const bed = await tapper(page, page.getByRole('button', { name: 'One more bedroom' }));
  const bedLess = await tapper(page, page.getByRole('button', { name: 'One fewer bedroom' }));
  const ppl = await tapper(page, page.getByRole('button', { name: 'One more person' }));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await measure(page, 'housing steppers x14 (4x)', async () => {
    for (let i = 0; i < 4; i++) { await bed(); await page.waitForTimeout(90); }
    for (let i = 0; i < 6; i++) { await ppl(); await page.waitForTimeout(90); }
    for (let i = 0; i < 4; i++) { await bedLess(); await page.waitForTimeout(90); }
  });
  await measure(page, 'rent typing (4x)', async () => {
    await page.locator('#rent').fill('');
    await page.locator('#rent').pressSequentially('1850', { delay: 90 });
  });
  await b.close();
})();
