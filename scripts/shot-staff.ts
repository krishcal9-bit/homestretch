import { chromium } from 'playwright';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000/staff/login');
  await p.fill('input[type=password]', process.env.STAFF_PASSWORD!); await p.keyboard.press('Enter'); await p.waitForSelector('tbody tr', { timeout: 60000 }); await p.waitForTimeout(800);
  await p.screenshot({ path: 'docs/screenshots/step7-pipeline.png', fullPage: true });
  await p.getByText('Patel', { exact: true }).click(); await p.waitForTimeout(3500);
  await p.screenshot({ path: 'docs/screenshots/step7-drawer.png' });
  await p.goto('http://localhost:3000/staff/insights'); await p.waitForTimeout(1500);
  await p.screenshot({ path: 'docs/screenshots/step9-insights.png', fullPage: true });
  await b.close();
})();
