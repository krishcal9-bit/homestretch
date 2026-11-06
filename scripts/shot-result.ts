import { chromium } from 'playwright';
const draft = { householdSize: 4, inOC: true, residentOrCitizen: true, grossMonthlyIncome: 5200, otherIncomeOn: false, otherMonthlyIncome: null, rent: 2350, bedrooms: 1, occupants: 4, unsafeConditions: false,
  debts: { car: { payment: null, balance: null }, card: { payment: 65, balance: 2100 }, student: { payment: null, balance: null }, collection: { payment: null, balance: 1900 }, other: { payment: null, balance: null } },
  savings: 3100, creditBand: 'needs_work', levers: { extraDebt: 0, monthlySavings: 150, coApplicantIncome: 0 } };
(async () => {
  const b = await chromium.launch();
  for (const [name, vp] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]] as const) {
    const p = await b.newPage({ viewport: vp, deviceScaleFactor: 1 });
    p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
    p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
    await p.goto('http://localhost:3000/');
    await p.evaluate((d) => { localStorage.setItem('hs.draft', JSON.stringify(d)); localStorage.setItem('hs.step', '5'); sessionStorage.clear(); }, draft);
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2200);
    await p.screenshot({ path: `docs/screenshots/step4-result-${name}.png`, fullPage: true });
    if (name === 'mobile') {
      console.log('date before', await p.getByTestId('ready-date').innerText());
      await p.fill('#lever-extraDebt-n', '150'); await p.waitForTimeout(800);
      console.log('date after $150', await p.getByTestId('ready-date').innerText());
      await p.locator('[data-testid=homes] button').first().click(); await p.waitForTimeout(1200);
      console.log('aim:', await p.getByTestId('aim-sentence').innerText());
      console.log('date after aim', await p.getByTestId('ready-date').innerText(), await p.inputValue('#lever-extraDebt-n'), await p.inputValue('#lever-monthlySavings-n'));
      await p.locator('[data-milestone=credit]').focus(); await p.waitForTimeout(300);
      await p.screenshot({ path: `docs/screenshots/step4-result-tooltip-mobile.png` });
    }
    await p.close();
  }
  await b.close();
})();
