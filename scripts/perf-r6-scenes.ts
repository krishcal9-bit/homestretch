// Frame times at 4× CPU throttle (CDP Emulation.setCPUThrottlingRate) during each landing section change
// (Down arrow at 1440×900, then the dots back up), plus CLS and LCP on load. Run against a production build.
// Usage: npx tsx scripts/perf-r6-scenes.ts [baseUrl=http://localhost:3142]
import { chromium, type Page } from 'playwright';

const base = process.argv[2] || 'http://localhost:3142';

async function frames(page: Page, act: () => Promise<void>, ms: number) {
  // a string, so tsx's helpers never reach the page
  await page.evaluate(`(() => {
    window.__f = [];
    let last = performance.now();
    window.__run = true;
    function tick(t) { window.__f.push(t - last); last = t; if (window.__run) requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
  })()`);
  await act();
  await page.waitForTimeout(ms);
  return (await page.evaluate(`(() => { window.__run = false; return window.__f.slice(1); })()`)) as number[];
}

const stat = (f: number[]) => {
  const s = [...f].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  return { n: f.length, median: q(0.5), p95: q(0.95), max: s[s.length - 1], over17: f.filter((d) => d > 17.5).length, over34: f.filter((d) => d > 34).length };
};
const fmt = (o: ReturnType<typeof stat>) => `${o.n} frames · median ${o.median.toFixed(1)}ms · p95 ${o.p95.toFixed(1)}ms · max ${o.max.toFixed(1)}ms · >17.5ms ${o.over17} · >34ms ${o.over34}`;

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  // CLS and LCP on load (no throttle)
  await page.addInitScript(`(() => {
    window.__cls = 0; window.__lcp = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { const e = l.getEntries(); window.__lcp = e[e.length - 1].startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  })()`);
  await page.goto(base + '/?nointro');
  await page.waitForTimeout(4000);
  const vitals = (await page.evaluate(`({ cls: window.__cls, lcp: window.__lcp })`)) as { cls: number; lcp: number };
  console.log(`load: CLS ${vitals.cls.toFixed(4)} · LCP ${vitals.lcp.toFixed(0)}ms`);
  // let every scene mount (idle), then throttle
  await page.waitForTimeout(7000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const all: number[] = [];
  const names = ['hero → intake', 'intake → road', 'road → homes', 'homes → closing'];
  for (const name of names) {
    // the move takes 700ms: measure it (the section activates, and mounts its centrepiece, right after)
    const f = await frames(page, () => page.keyboard.press('ArrowDown'), 720);
    all.push(...f);
    console.log(`${name}: ${fmt(stat(f))}`);
    await page.waitForTimeout(3500); // the section's own moment plays, then settles
  }
  for (const [i, name] of [[3, 'closing → homes (dot)'], [2, 'homes → road (dot)'], [0, 'road → hero (dot)']] as const) {
    const f = await frames(page, () => page.getByTestId('section-dots').getByRole('button').nth(i).click(), 720);
    all.push(...f);
    console.log(`${name}: ${fmt(stat(f))}`);
    await page.waitForTimeout(2500);
  }
  console.log(`all transitions: ${fmt(stat(all))}`);
  await b.close();
})();
