// Round 4: screenshots every page at 1440×900, 1024×768 and 390×844 into docs/screenshots/r5-page-<name>-<width>.png
// (landing sections: scripts/shot-sections.ts). usage: npx tsx --env-file=.env scripts/shot-r4.ts
import { chromium } from 'playwright';
import fs from 'fs';
const B = 'http://localhost:3000';
const draft = JSON.parse(fs.readFileSync('fixtures/demo-draft.json', 'utf8'));
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('PAGEERROR', w, e.message.slice(0, 160)));
    const shot = async (name: string, full = true, wait = 1800) => {
      await p.waitForTimeout(wait);
      if (full) {
        // sections below the fold animate in when scrolled into view: walk the page first
        const total = await p.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < total; y += h * 0.7) { await p.evaluate((yy) => window.scrollTo(0, yy), y); await p.waitForTimeout(350); }
        await p.waitForTimeout(900);
        await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
      }
      await p.screenshot({ path: `docs/screenshots/r5-page-${name}-${w}.png`, fullPage: full });
    };
    const family = async (step: number) => {
      await p.evaluate(([d, s]) => { localStorage.setItem('hs.draft', JSON.stringify(d)); localStorage.setItem('hs.step', String(s)); }, [draft, step] as const);
      await p.reload();
    };
    await p.goto(B + '/?nointro');
    await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('hs.nointro', '1'); });
    await p.goto(B + '/start');
    const names = ['household', 'income', 'housing', 'money', 'result'];
    for (const s of [1, 2, 3, 4, 5]) { await family(s); await shot(`intake-${names[s - 1]}`, true, s === 5 ? 3500 : 1600); }
    await p.goto(B + '/plan/NGU7P3'); await shot('plan', true, 2500);
    await p.goto(B + '/plan/notarealcode'); await shot('plan-404');
    await p.goto(B + '/staff/login'); await shot('staff-login', false);
    await p.locator('input[type=password]').fill(process.env.STAFF_PASSWORD ?? 'habitat2026');
    await p.keyboard.press('Enter');
    await p.waitForSelector('[data-testid=family-row]', { timeout: 60_000 });
    await shot('staff-pipeline');
    await p.getByTestId('family-row').filter({ hasText: 'Patel' }).click(); await shot('staff-drawer', false);
    for (const r of ['homes', 'match?home=h1', 'insights', 'checkin']) { await p.goto(`${B}/staff/${r}`); await shot(`staff-${r.split('?')[0]}`); }
    await ctx.close();
  }
  await b.close();
})();
