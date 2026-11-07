// Records fresh loads of the landing intro (3D film + title card + hand-off) at a size.
// usage: npx tsx scripts/record-intro.ts 1440x900 [name] [seconds]
import { chromium } from 'playwright';
import fs from 'fs';
(async () => {
  const [w, h] = (process.argv[2] ?? '1440x900').split('x').map(Number);
  const name = process.argv[3] ?? `r5-intro-${w}`;
  const secs = Number(process.argv[4] ?? 6);
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const warm = await b.newPage(); await warm.goto('http://localhost:3000/?nointro&force3d'); await warm.waitForTimeout(1500); await warm.close();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, recordVideo: { dir: 'docs/motion/tmp', size: { width: w, height: h } } });
  const p = await ctx.newPage();
  await p.addInitScript(() => sessionStorage.setItem('hs.force3d', '1'));
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
  p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text().slice(0, 200)));
  await p.goto('http://localhost:3000/');
  await p.waitForTimeout(secs * 1000);
  await ctx.close();
  const f = fs.readdirSync('docs/motion/tmp')[0];
  fs.renameSync(`docs/motion/tmp/${f}`, `docs/motion/${name}.webm`);
  fs.rmdirSync('docs/motion/tmp');
  await b.close();
})();
