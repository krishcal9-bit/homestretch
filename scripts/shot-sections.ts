// Screenshots every landing section (navigated with the Down arrow) at 1440×900, 1024×768 and 390×844.
import { chromium } from 'playwright';
(async () => {
  const b = await chromium.launch();
  for (const [w, h] of [[1440, 900], [1024, 768], [390, 844]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 160)));
    await p.goto('http://localhost:3000/?nointro'); await p.waitForTimeout(2200);
    const ids = ['hero', 'scene-intake', 'scene-road', 'scene-homes', 'closing'];
    for (let i = 0; i < ids.length; i++) {
      if (i > 0) {
        if (w >= 1024) await p.keyboard.press('ArrowDown');
        else await p.evaluate((id) => document.getElementById(id)!.scrollIntoView(), ids[i]);
        await p.waitForTimeout(3200); // let the section's animation finish
      }
      await p.screenshot({ path: `docs/screenshots/r4-landing-${ids[i]}-${w}.png` });
    }
    await p.close();
  }
  await b.close();
})();
