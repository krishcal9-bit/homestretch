// Records a full section-by-section pass using the Down arrow (1440×900) to docs/motion/r4-sections.webm
import { chromium } from 'playwright';
import fs from 'fs';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: 'docs/motion/tmp', size: { width: 1440, height: 900 } } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 160)));
  await p.goto('http://localhost:3000/'); await p.waitForTimeout(3400); // the intro plays
  for (let i = 0; i < 4; i++) { await p.keyboard.press('ArrowDown'); await p.waitForTimeout(3300); }
  await p.getByTestId('section-arrow-4').click(); await p.waitForTimeout(1500);
  await ctx.close();
  const f = fs.readdirSync('docs/motion/tmp')[0]; fs.renameSync(`docs/motion/tmp/${f}`, 'docs/motion/r4-sections.webm'); fs.rmdirSync('docs/motion/tmp');
  await b.close();
})();
