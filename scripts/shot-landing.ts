// Landing screenshots at 1440×900, 1024×768, 390×844 (hero after the intro) + full page.
import { chromium } from 'playwright';
(async () => {
  const b = await chromium.launch();
  for (const [name, vp] of [['1440', { width: 1440, height: 900 }], ['1024', { width: 1024, height: 768 }], ['390', { width: 390, height: 844 }]] as const) {
    const p = await b.newPage({ viewport: vp });
    p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 200)));
    await p.goto('http://localhost:3000/'); await p.evaluate(() => sessionStorage.setItem('hs.opened', '1')); await p.reload(); await p.waitForTimeout(2200);
    await p.screenshot({ path: `docs/screenshots/landing-hero-${name}.png` });
    // scroll through so in-view scenes settle, then full page
    for (let y = 0; y < 9000; y += 400) { await p.mouse.wheel(0, 400); await p.waitForTimeout(60); }
    await p.waitForTimeout(800);
    await p.screenshot({ path: `docs/screenshots/landing-full-${name}.png`, fullPage: true });
    await p.close();
  }
  await b.close();
})();
