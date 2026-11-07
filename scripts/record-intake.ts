// Records intake steps 1→4 with value changes at 390×844 to docs/motion/r4-intake.webm.
// Usage: npx tsx scripts/record-intake.ts <baseUrl>   (server must run with MOCK_CLAUDE=1)
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const base = process.argv[2] || 'http://localhost:3401';
const root = path.join(__dirname, '..');
const tmp = path.join(root, 'docs/motion/tmp-intake');

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: tmp, size: { width: 390, height: 844 } } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
  const pause = (ms: number) => p.waitForTimeout(ms);
  const next = async () => {
    await p.locator('form button[type=submit]').click();
    await pause(700);
  };
  await p.goto(base + '/');
  await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('hs.opened', '1'); localStorage.setItem('hs.step', '1'); });
  await p.goto(base + '/start');
  await pause(900);

  // 1 household: people pop in and out; the county draws, erases, draws
  const more = p.getByRole('button', { name: 'One more person' });
  const fewer = p.getByRole('button', { name: 'One fewer person' });
  for (let i = 0; i < 3; i++) { await more.click(); await pause(260); }
  await fewer.click(); await pause(400);
  const oc = p.getByRole('radiogroup', { name: 'Do you live or work in Orange County?' });
  await oc.getByRole('radio', { name: 'Yes' }).click(); await pause(600);
  await oc.getByRole('radio', { name: 'No' }).click(); await pause(600);
  await oc.getByRole('radio', { name: 'Yes' }).click(); await pause(600);
  await p.getByRole('radiogroup', { name: 'Is everyone applying a US citizen or permanent resident?' }).getByRole('radio', { name: 'Yes' }).click();
  await pause(400);
  await next();

  // 2 income: coins stack as it's typed; then a pay stub is scanned and its amount flies into the field
  await p.locator('#gross').click();
  await p.locator('#gross').pressSequentially('3400', { delay: 140 });
  await pause(500);
  await p.locator('#gross').fill('');
  await p.locator('#gross').blur();
  await pause(400);
  await p.locator('#file-paystub').setInputFiles(path.join(root, 'fixtures/paystub.png'));
  await p.getByTestId('upload-paystub-done').waitFor({ timeout: 20000 });
  await pause(1600);
  await next();

  // 3 housing: rent share fills and turns amber; rooms and people
  await p.locator('#rent').click();
  await p.locator('#rent').pressSequentially('1400', { delay: 140 });
  await pause(500);
  await p.locator('#rent').fill('2350');
  await p.locator('#rent').blur();
  await pause(600);
  const moreBed = p.getByRole('button', { name: 'One more bedroom' });
  const fewerBed = p.getByRole('button', { name: 'One fewer bedroom' });
  await moreBed.click(); await pause(450);
  await moreBed.click(); await pause(450);
  await fewerBed.click(); await pause(450);
  await fewerBed.click(); await pause(450);
  await fewerBed.click(); await pause(600);
  const morePeople = p.getByRole('button', { name: 'One more person' });
  await morePeople.click(); await pause(450);
  await moreBed.click(); await pause(700);
  await next();

  // 4 money: tags land on the scale, savings on the other pan; the credit needle swings
  await p.locator('#debt-car-payment').fill('320'); await pause(450);
  await p.locator('#debt-card-balance').fill('2100'); await pause(450);
  await p.locator('#debt-collection-balance').scrollIntoViewIfNeeded();
  await p.locator('#debt-collection-balance').fill('1900'); await pause(450);
  await p.locator('[data-testid=debt-scale]').scrollIntoViewIfNeeded(); await pause(300);
  await p.locator('#savings').click();
  await p.locator('#savings').pressSequentially('3100', { delay: 140 });
  await pause(700);
  const credit = p.getByRole('radiogroup', { name: 'How is your credit?' });
  await credit.scrollIntoViewIfNeeded();
  for (const name of ['Building', 'Needs work', 'Good', 'Not sure', 'Needs work']) { await credit.getByRole('radio', { name }).click(); await pause(450); }
  await pause(400);
  await ctx.close();
  const f = fs.readdirSync(tmp)[0];
  fs.renameSync(path.join(tmp, f), path.join(root, 'docs/motion/r4-intake.webm'));
  fs.rmdirSync(tmp);
  await b.close();
})();
