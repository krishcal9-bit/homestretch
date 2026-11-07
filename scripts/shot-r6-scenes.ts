// Screenshots every landing scene (navigated with the Down arrow on desktop, scrolled on phones) in the light
// or dark theme → <outDir>/<scene>-<theme>[-<width>].png (1440 has no width suffix, as the lead asked).
// Usage: PORT=3141 THEME=light|dark npx tsx scripts/shot-r6-scenes.ts [widths=1440,390] [outDir=docs/screenshots/scenes]
// ONLY=scene-road,closing limits the sections shot.
import { chromium } from 'playwright';

const PORT = process.env.PORT ?? '3141';
const THEME = process.env.THEME === 'dark' ? 'dark' : 'light';
const SIZES: Record<string, [number, number]> = { 1440: [1440, 900], 1280: [1280, 800], 1024: [1024, 768], 390: [390, 844] };
const widths = (process.argv[2] ?? '1440,390').split(',');
const out = process.argv[3] ?? 'docs/screenshots/scenes';
const only = process.env.ONLY?.split(',');
const NAMES: Record<string, string> = { hero: 'hero', 'scene-intake': 'home', 'scene-road': 'repair', 'scene-homes': 'neighborhood', closing: 'closing' };

(async () => {
  const b = await chromium.launch();
  for (const w of widths) {
    const [vw, vh] = SIZES[w];
    const ctx = await b.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: vw < 500 ? 2 : 1, colorScheme: THEME });
    await ctx.addInitScript(`try { localStorage.setItem('hs.theme', '${THEME}'); } catch {}`);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
    p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text().slice(0, 200)));
    await p.goto(`http://localhost:${PORT}/?nointro`);
    await p.waitForTimeout(2600);
    const ids = ['hero', 'scene-intake', 'scene-road', 'scene-homes', 'closing'];
    for (let i = 0; i < ids.length; i++) {
      if (i > 0) {
        if (vw >= 1024) await p.keyboard.press('ArrowDown');
        else await p.evaluate((id) => document.getElementById(id)!.scrollIntoView(), ids[i]);
        await p.waitForTimeout(6000); // the camera lands, then the scene's moment plays
      }
      if (only && !only.includes(ids[i])) continue;
      const suffix = w === '1440' ? '' : `-${w}`;
      await p.screenshot({ path: `${out}/${NAMES[ids[i]]}-${THEME}${suffix}.png` });
      if (vw < 1024) {
        // phones: a section can be taller than the screen; also shoot its lower part
        const extra = await p.evaluate((id) => document.getElementById(id)!.getBoundingClientRect().bottom - window.innerHeight, ids[i]);
        if (extra > 40) {
          await p.evaluate((dy) => window.scrollBy(0, dy), extra);
          await p.waitForTimeout(1200);
          await p.screenshot({ path: `${out}/${NAMES[ids[i]]}-${THEME}${suffix}-lower.png` });
        }
      }
    }
    await ctx.close();
  }
  await b.close();
})();
