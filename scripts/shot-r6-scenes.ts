// Screenshots every landing section's scene (navigated with the Down arrow on desktop, scrolled on phones)
// at 1440×900, 1280×800, 1024×768 and 390×844 → docs/screenshots/r6-scenes-<section>-<width>.png
// Usage: PORT=3141 npx tsx scripts/shot-r6-scenes.ts [widths=1440,1280,1024,390] [outDir]
import { chromium } from 'playwright';

const PORT = process.env.PORT ?? '3141';
const SIZES: Record<string, [number, number]> = { 1440: [1440, 900], 1280: [1280, 800], 1024: [1024, 768], 390: [390, 844] };
const widths = (process.argv[2] ?? '1440,1280,1024,390').split(',');
const out = process.argv[3] ?? 'docs/screenshots';
const only = process.env.ONLY?.split(',');

(async () => {
  const b = await chromium.launch();
  for (const w of widths) {
    const [vw, vh] = SIZES[w];
    const p = await b.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: vw < 500 ? 2 : 1 });
    p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
    p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text().slice(0, 200)));
    await p.goto(`http://localhost:${PORT}/?nointro`);
    await p.waitForTimeout(2600);
    const ids = ['hero', 'scene-intake', 'scene-road', 'scene-homes', 'closing'];
    for (let i = 0; i < ids.length; i++) {
      if (i > 0) {
        if (vw >= 1024) await p.keyboard.press('ArrowDown');
        else await p.evaluate((id) => document.getElementById(id)!.scrollIntoView(), ids[i]);
        await p.waitForTimeout(5200); // let the section's animation finish
      }
      if (only && !only.includes(ids[i])) continue;
      await p.screenshot({ path: `${out}/r6-scenes-${ids[i]}-${w}.png` });
      if (vw < 1024) {
        // phones: a section can be taller than the screen; also shoot its lower part
        const extra = await p.evaluate((id) => {
          const r = document.getElementById(id)!.getBoundingClientRect();
          return r.bottom - window.innerHeight;
        }, ids[i]);
        if (extra > 40) {
          await p.evaluate((dy) => window.scrollBy(0, dy), extra);
          await p.waitForTimeout(1200);
          await p.screenshot({ path: `${out}/r6-scenes-${ids[i]}-${w}-lower.png` });
        }
      }
    }
    await p.close();
  }
  await b.close();
})();
