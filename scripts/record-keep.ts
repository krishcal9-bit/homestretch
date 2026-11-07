// Records the flatten-slider interaction on /keep → docs/screenshots/keep/flatten.webm (Playwright video).
// Usage: npx tsx scripts/record-keep.ts [base=http://localhost:3161] [vp=desktop|mobile] [cpu=1] [theme=light]
// cpu=4 runs the page under 4× CPU throttling (Chrome DevTools Protocol) to check the drag stays smooth.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1) ?? d;
const B = arg('base', 'http://localhost:3161');
const vp = arg('vp', 'desktop');
const cpu = Number(arg('cpu', '1'));
const theme = arg('theme', 'light');
const OUT = arg('out', 'docs/screenshots/keep/flatten.webm');
const size = vp === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 };

(async () => {
  const dir = fs.mkdtempSync(path.join(path.dirname(OUT), '.rec-'));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: size, recordVideo: { dir, size } });
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('hs.theme', t);
    } catch {}
  }, theme);
  const p = await ctx.newPage();
  if (cpu > 1) {
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  }
  await p.goto(`${B}/keep`);
  await p.evaluate(() => localStorage.removeItem('hs.keep'));
  await p.reload();
  await p.getByTestId('keep-try-sample').click();
  await p.getByTestId('keep-forecast').waitFor();
  if (vp === 'mobile') await p.evaluate(() => window.scrollTo({ top: 260 }));
  await p.waitForTimeout(2200);
  // frame-time probe: the longest gap between animation frames while dragging
  // (a string, so tsx's helpers don't leak into the page)
  await p.evaluate(`(() => { window.__gaps = []; let last = performance.now(); const tick = (t) => { window.__gaps.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); })()`);
  const box = (await p.locator('#keep-setaside').boundingBox())!;
  const y = box.y + box.height / 2;
  const at = (v: number, max: number) => box.x + 12 + (box.width - 24) * (v / max);
  const max = Number(await p.locator('#keep-setaside').getAttribute('max'));
  await p.mouse.move(at(0, max), y);
  await p.mouse.down();
  // slowly to the recommended amount, past it, back, then let go
  for (const [from, to, ms] of [
    [0, 48, 1600],
    [48, 90, 800],
    [90, 30, 900],
    [30, 48, 500],
  ] as const) {
    const steps = Math.round(ms / 16);
    for (let i = 1; i <= steps; i++) {
      await p.mouse.move(at(from + ((to - from) * i) / steps, max), y);
      await p.waitForTimeout(16);
    }
  }
  await p.mouse.up();
  await p.waitForTimeout(1200);
  // a fling: release-to-zero with one tap, then the recommendation button
  await p.mouse.click(at(0, max), y);
  await p.waitForTimeout(1200);
  await p.getByTestId('apply-recommended').click();
  await p.waitForTimeout(1600);
  const gaps = (await p.evaluate('window.__gaps.slice(2)')) as number[];
  gaps.sort((a, b) => a - b);
  const pct = (q: number) => gaps[Math.floor(q * (gaps.length - 1))]?.toFixed(1);
  console.log(`frames ${gaps.length} · median ${pct(0.5)}ms · p95 ${pct(0.95)}ms · max ${pct(1)}ms (cpu ×${cpu})`);
  const video = p.video();
  await ctx.close();
  await b.close();
  if (video) fs.renameSync(await video.path(), OUT);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('wrote', OUT);
})();
