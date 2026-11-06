// Records landing load (2s) + one full scroll at 1440×900 to docs/motion/landing-1440.webm,
// and takes viewport screenshots inside each scroll scene.
import { chromium } from 'playwright';
import fs from 'fs';
(async () => {
  const b = await chromium.launch();
  const warm = await b.newPage(); await warm.goto('http://localhost:3000/'); await warm.close();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: 'docs/motion/tmp', size: { width: 1440, height: 900 } } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
  await p.goto('http://localhost:3000/'); await p.waitForTimeout(2200);
  const sceneTop = async (id: string) => p.evaluate((i) => document.querySelector(`[data-testid=${i}]`)!.getBoundingClientRect().top + window.scrollY, id);
  const shots: [string, number][] = [];
  const phone = await sceneTop('scene-intake'); shots.push(['scene1', phone - 80]);
  const road = await sceneTop('scene-road');
  shots.push(['scene2-a', road + 400], ['scene2-b', road + 400 + 0.7 * 900], ['scene2-c', road + 400 + 1.4 * 900]);
  const homes = await sceneTop('scene-homes'); shots.push(['scene3', homes - 40]);
  // smooth scroll through the page
  const total = await p.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < total; y += 60) { await p.mouse.wheel(0, 60); await p.waitForTimeout(16); }
  await ctx.close();
  const f = fs.readdirSync('docs/motion/tmp')[0]; fs.renameSync(`docs/motion/tmp/${f}`, 'docs/motion/landing-1440.webm'); fs.rmdirSync('docs/motion/tmp');
  const q = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await q.goto('http://localhost:3000/'); await q.waitForTimeout(1800);
  for (const [name, y] of shots) {
    // approach each point by wheel so scroll-linked scenes update naturally
    const cur = await q.evaluate(() => window.scrollY);
    for (let s = cur; s < y; s += 120) { await q.mouse.wheel(0, 120); await q.waitForTimeout(20); }
    await q.waitForTimeout(700);
    await q.screenshot({ path: `docs/screenshots/landing-${name}-1440.png` });
  }
  await b.close();
})();
