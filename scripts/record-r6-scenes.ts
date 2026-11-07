// Records a section-by-section pass with the Down arrow at 1440×900 (each scene's camera move, its sky
// crossfade and its replay), then back to the top → docs/screenshots/r6-scenes-sections.webm
// Usage: PORT=3141 npx tsx scripts/record-r6-scenes.ts [out=docs/screenshots/r6-scenes-sections.webm]
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT ?? '3141';
const out = process.argv[2] ?? 'docs/screenshots/r6-scenes-sections.webm';

(async () => {
  const tmp = fs.mkdtempSync(path.join(path.dirname(out), '.rec-'));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: tmp, size: { width: 1440, height: 900 } } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
  await p.goto(`http://localhost:${PORT}/?nointro`);
  await p.waitForTimeout(2600);
  for (let i = 0; i < 4; i++) {
    await p.keyboard.press('ArrowDown');
    await p.waitForTimeout(i === 1 ? 6200 : 4200); // the road's drive takes longest
  }
  await p.getByTestId('section-arrow-4').click();
  await p.waitForTimeout(1600);
  await ctx.close();
  const f = fs.readdirSync(tmp)[0];
  fs.renameSync(path.join(tmp, f), out);
  fs.rmSync(tmp, { recursive: true, force: true });
  await b.close();
})();
