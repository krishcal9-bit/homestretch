// Captures the still render of the 3D house (public/house/house.png): the placeholder shown until the canvas
// draws, and the fallback without WebGL or with reduced motion. Taken from the landing hero's house slot
// (door open, porch light on, one window lit — the hero's resting state) on a transparent background.
// usage: npx tsx scripts/render-house.ts [baseUrl]
import { chromium } from 'playwright';
(async () => {
  const base = process.argv[2] ?? 'http://localhost:3000';
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2 });
  await p.goto(`${base}/?nointro`, { timeout: 120000 });
  await p.waitForSelector('[data-testid=hero-house] canvas', { timeout: 60000 });
  // render the slot at 600px (same 5:4 framing) so the 2× canvas is 1200px wide
  await p.addStyleTag({ content: '[data-testid=hero-house]{position:fixed!important;left:0!important;top:0!important;width:600px!important;max-width:none!important;z-index:999}' });
  await p.waitForTimeout(5000);
  // only the canvas, on transparency
  await p.addStyleTag({ content: 'html,body,body *{background:transparent!important;box-shadow:none!important} body *{visibility:hidden!important} [data-testid=hero-house], [data-testid=hero-house] canvas{visibility:visible!important} [data-testid=hero-house] img{display:none!important}' });
  await p.waitForTimeout(800);
  await p.locator('[data-testid=hero-house]').screenshot({ path: 'public/house/house.png', omitBackground: true });
  await b.close();
})();
