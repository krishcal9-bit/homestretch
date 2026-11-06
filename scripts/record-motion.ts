// Records the main interaction to docs/motion/<name>.webm
import { chromium } from 'playwright';
import fs from 'fs';
const draft = JSON.parse(fs.readFileSync('fixtures/demo-draft.json', 'utf8'));
(async () => {
  const name = process.argv[2] ?? 'step4';
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: 'docs/motion/tmp', size: { width: 390, height: 844 } } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:3000/');
  await p.evaluate((d) => { localStorage.setItem('hs.draft', JSON.stringify(d)); localStorage.setItem('hs.step', '5'); sessionStorage.clear(); }, draft);
  await p.reload(); await p.waitForTimeout(2500);
  const box = (await p.locator('#lever-extraDebt').boundingBox())!;
  await p.mouse.move(box.x + 12, box.y + box.height / 2); await p.mouse.down();
  for (let i = 0; i <= 30; i++) { await p.mouse.move(box.x + 12 + (box.width * 0.3 * i) / 30, box.y + box.height / 2); await p.waitForTimeout(40); }
  await p.mouse.up(); await p.waitForTimeout(800);
  await p.locator('[data-testid=homes] button').nth(4).scrollIntoViewIfNeeded();
  await p.locator('[data-testid=homes] button').nth(4).click(); await p.waitForTimeout(400);
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await p.waitForTimeout(1800);
  await ctx.close();
  const f = fs.readdirSync('docs/motion/tmp')[0];
  fs.renameSync(`docs/motion/tmp/${f}`, `docs/motion/${name}.webm`); fs.rmdirSync('docs/motion/tmp');
  await b.close();
})();
