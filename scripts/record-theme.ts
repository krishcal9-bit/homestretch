// Round 6: the theme switch, frame by frame. Clicks the header switch on a page and saves frames during the
// 600ms crossfade (and the toggle's 250ms morph) → <out>/r6-theme-switch-<page>-<n>.png
// Usage: npx tsx scripts/record-theme.ts [base=http://localhost:3152] [path=/?nointro] [name=landing] [out=docs/screenshots] [from=light]
import { chromium } from 'playwright';
import path from 'path';

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1) ?? d;
const B = arg('base', 'http://localhost:3152');
const route = arg('path', '/?nointro');
const name = arg('name', 'landing');
const OUT = arg('out', 'docs/screenshots');
const from = arg('from', 'light');

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('hs.theme', t);
      sessionStorage.setItem('hs.nointro', '1');
      localStorage.setItem('hs.dragged', '1');
    } catch {}
  }, from);
  const p = await ctx.newPage();
  await p.goto(B + route);
  await p.waitForTimeout(3000);
  const t0 = Date.now();
  await p.getByTestId('theme-toggle').click();
  for (const at of [60, 200, 340, 480, 900]) {
    const wait = at - (Date.now() - t0);
    if (wait > 0) await p.waitForTimeout(wait);
    const file = path.join(OUT, `r6-theme-switch-${name}-${String(at).padStart(3, '0')}ms.png`);
    await p.screenshot({ path: file });
    console.log(file, await p.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.vt ?? '-', localStorage.getItem('hs.theme')].join(' ')));
  }
  await b.close();
})();
