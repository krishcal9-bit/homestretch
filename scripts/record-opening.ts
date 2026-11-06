// Records the first 3.2s of a first visit (opening) at a size, plus timed frames.
import { chromium } from 'playwright';
import fs from 'fs';
(async () => {
  const [w, h] = (process.argv[2] ?? '1440x900').split('x').map(Number);
  const b = await chromium.launch();
  const warm = await b.newPage(); await warm.goto('http://localhost:3000/'); await warm.close();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, recordVideo: { dir: 'docs/motion/tmp', size: { width: w, height: h } } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
  await p.goto('http://localhost:3000/'); await p.waitForTimeout(3600);
  await p.screenshot({ path: `docs/screenshots/landing-opening-end-${w}.png` });
  await ctx.close();
  const f = fs.readdirSync('docs/motion/tmp')[0]; fs.renameSync(`docs/motion/tmp/${f}`, `docs/motion/landing-opening-${w}.webm`); fs.rmdirSync('docs/motion/tmp');
  await b.close();
})();
