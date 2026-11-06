import { chromium } from 'playwright';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto('http://localhost:3100/');
  await p.evaluate(() => { localStorage.clear(); document.cookie = 'hs_lang=es; path=/'; }); await p.reload();
  await p.getByRole('button', { name: 'Empezar' }).click(); await p.waitForTimeout(500);
  console.log('mic visible:', await p.getByTestId('mic').isVisible().catch(() => false));
  await p.getByTestId('type-instead').click();
  await p.fill('#voice-text', 'somos cuatro, vivimos en Santa Ana, gano como cinco mil doscientos al mes, pagamos dos mil trescientos cincuenta de renta');
  await p.getByTestId('voice-fill').click(); await p.getByText('Llenamos').waitFor(); await p.waitForTimeout(250);
  await p.screenshot({ path: 'docs/screenshots/step10-voice-es-mobile.png', fullPage: true });
  console.log('size', await p.inputValue('#householdSize'));
  await p.locator('form button[type=submit]').click(); await p.waitForTimeout(600);
  console.log('gross', await p.inputValue('#gross'));
  await b.close();
})();
