import { chromium } from 'playwright';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3100/staff/login');
  await p.fill('input[type=password]', process.env.STAFF_PASSWORD!); await p.keyboard.press('Enter'); await p.waitForSelector('tbody tr', { timeout: 60000 });
  await p.getByTestId('run-checkin').click(); await p.waitForSelector('[data-testid=checkin-item]', { timeout: 60000 }); await p.waitForTimeout(2500);
  await p.screenshot({ path: 'docs/screenshots/step11-checkin.png' });
  await b.close();
})();
