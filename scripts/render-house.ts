// Captures the still render of the 3D house used as its placeholder and fallback (public/house/house.png).
// Renders the scene at the slot's 5:4 framing on a transparent background, 1600×1280.
// usage: npx tsx scripts/render-house.ts [baseUrl]   (needs a page that mounts the scene; see /r5-test while developing)
import { chromium } from 'playwright';
(async () => {
  const base = process.argv[2] ?? 'http://localhost:3005';
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 800 }, deviceScaleFactor: 2 });
  await p.goto(`${base}/r5-test?build=none&lit=1&w=800`, { timeout: 120000 });
  await p.waitForSelector('#stage canvas', { timeout: 60000 });
  await p.addStyleTag({ content: 'html,body,body *{background:transparent!important;outline:none!important}' });
  await p.waitForTimeout(3500);
  await p.locator('#stage').screenshot({ path: 'public/house/house.png', omitBackground: true });
  await b.close();
})();
