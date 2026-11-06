// Records the landing page load + slider play to docs/motion/landing.webm and screenshots it.
import { chromium } from 'playwright';
import fs from 'fs';
(async () => {
  const b = await chromium.launch();
  const warm = await b.newPage(); await warm.goto('http://localhost:3000/'); await warm.close();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: 'docs/motion/tmp', size: { width: 390, height: 844 } } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:3000/'); await p.waitForTimeout(1800);
  await p.screenshot({ path: 'docs/screenshots/landing-mobile.png' });
  const s = (await p.locator('#sample-extra').boundingBox())!;
  await p.mouse.move(s.x + s.width * 0.375, s.y + s.height / 2); await p.mouse.down();
  for (let i = 0; i <= 25; i++) { await p.mouse.move(s.x + s.width * (0.375 + (0.6 * i) / 25), s.y + s.height / 2); await p.waitForTimeout(30); }
  await p.mouse.up(); await p.waitForTimeout(900);
  await p.screenshot({ path: 'docs/screenshots/landing-after-slider-mobile.png' });
  await ctx.close();
  const f = fs.readdirSync('docs/motion/tmp')[0]; fs.renameSync(`docs/motion/tmp/${f}`, 'docs/motion/landing.webm'); fs.rmdirSync('docs/motion/tmp');
  const d = await b.newPage({ viewport: { width: 1440, height: 900 } }); await d.goto('http://localhost:3000/'); await d.waitForTimeout(1800);
  await d.screenshot({ path: 'docs/screenshots/landing-desktop.png' }); await b.close();
})();
