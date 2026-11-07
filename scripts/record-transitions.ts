// Records landing → intake → result (with a lever drag) → staff link → back, at 390×844, to docs/motion/transitions.webm.
import { chromium } from 'playwright';
import fs from 'fs';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: 'docs/motion/tmp', size: { width: 390, height: 844 } } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
  p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text().slice(0, 200)));
  await p.goto('http://localhost:3000/?nointro'); await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('hs.nointro', '1'); }); await p.goto('http://localhost:3000/'); await p.waitForTimeout(1800);
  const mark = (s: string) => console.log(s, Date.now());
  mark('click find');
  await p.getByTestId('find-my-date').click(); await p.waitForURL('**/start'); await p.waitForTimeout(900);
  console.log('on start:', await p.locator('h1').first().innerText());
  await p.getByRole('radio', { name: 'Yes' }).first().click();
  await p.locator('form button[type=submit]').click(); await p.waitForTimeout(700);
  await p.getByRole('button', { name: 'Back' }).click(); await p.waitForTimeout(700);
  await p.locator('form button[type=submit]').click(); await p.waitForTimeout(500);
  await p.fill('#gross', '5200'); await p.locator('form button[type=submit]').click(); await p.waitForTimeout(500);
  await p.fill('#rent', '2350'); await p.locator('form button[type=submit]').click(); await p.waitForTimeout(500);
  await p.fill('#debt-collection-balance', '1900'); await p.fill('#savings', '3100');
  await p.getByRole('radio', { name: 'Building' }).click();
  await p.locator('form button[type=submit]').click(); await p.waitForTimeout(3200);
  console.log('result date:', await p.getByTestId('ready-date').innerText().catch(() => 'none'));
  // drag "Extra toward debt" to show the date, Road and Keys house responding
  const lever = p.locator('#lever-extraDebt'); await lever.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  const bb = await lever.boundingBox();
  if (bb) { await p.mouse.move(bb.x + 6, bb.y + bb.height / 2); await p.mouse.down(); for (let i = 1; i <= 30; i++) { await p.mouse.move(bb.x + 6 + (bb.width * 0.6 * i) / 30, bb.y + bb.height / 2); await p.waitForTimeout(30); } await p.mouse.up(); }
  await p.waitForTimeout(1500);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(600);
  await p.getByTestId('staff-link').click(); await p.waitForURL('**/staff/login'); await p.waitForTimeout(600);
  await p.goBack(); await p.waitForTimeout(900);
  console.log('after back url:', p.url());
  await ctx.close();
  const f = fs.readdirSync('docs/motion/tmp')[0]; fs.renameSync(`docs/motion/tmp/${f}`, 'docs/motion/transitions.webm'); fs.rmdirSync('docs/motion/tmp');
  await b.close();
})();
