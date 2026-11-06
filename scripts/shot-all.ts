// Screenshots every screen at 390×844 and 1440×900 into docs/screenshots/review-*.png
import { chromium, type Page } from 'playwright';
import fs from 'fs';
const B = 'http://localhost:3000';
const draft = JSON.parse(fs.readFileSync('fixtures/demo-draft.json', 'utf8'));
(async () => {
  const b = await chromium.launch();
  for (const [vp, size] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]] as const) {
    const ctx = await b.newContext({ viewport: size });
    const p = await ctx.newPage();
    const shot = async (name: string) => { await p.waitForTimeout(1600); await p.screenshot({ path: `docs/screenshots/review-${name}-${vp}.png`, fullPage: name !== 'drawer' }); };
    const family = async (step: number) => { await p.evaluate(([d, s]) => { localStorage.setItem('hs.draft', JSON.stringify(d)); localStorage.setItem('hs.step', String(s)); }, [draft, step] as const); await p.reload(); };
    await p.goto(B + '/'); await p.evaluate(() => localStorage.clear()); await p.reload(); await shot('welcome');
    for (const s of [1, 2, 3, 4, 5]) { await family(s); await shot(`step${s}`); }
    await p.goto(B + '/plan/NGU7P3'); await shot('plan');
    await p.goto(B + '/plan/notarealcode'); await shot('plan-404');
    await p.goto(B + '/staff/login'); await shot('login');
    await p.fill('input[type=password]', process.env.STAFF_PASSWORD!); await p.keyboard.press('Enter'); await p.waitForSelector('[data-testid=family-row]');
    await shot('pipeline');
    await p.getByTestId('family-row').filter({ hasText: 'Patel' }).click(); await shot('drawer');
    for (const r of ['homes', 'match?home=h1', 'insights']) { await p.goto(`${B}/staff/${r}`); await shot(r.split('?')[0]); }
    await ctx.close();
  }
  await b.close();
})();
