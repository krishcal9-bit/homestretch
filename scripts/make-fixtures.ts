// Renders a fake pay stub and bank statement (obviously fictional names) to PNG/PDF.
import { chromium } from 'playwright';
import fs from 'fs';

const css = `body{font-family:Arial,Helvetica,sans-serif;color:#222;margin:0;padding:36px;background:#fff;width:820px}
h1{font-size:22px;margin:0}table{width:100%;border-collapse:collapse;margin-top:14px;font-size:14px}
td,th{border-bottom:1px solid #ccc;padding:7px 6px;text-align:left}th{background:#eee}.r{text-align:right}.muted{color:#666;font-size:12px}
.box{border:2px solid #333;padding:14px;margin-top:14px}.flex{display:flex;justify-content:space-between}`;

const paystub = `<html><head><style>${css}</style></head><body>
<div class="flex"><div><h1>Sunridge Market Co.</h1><div class="muted">4410 Example Blvd, Santa Ana, CA 92701 · FICTIONAL SAMPLE</div></div>
<div><b>EARNINGS STATEMENT</b><div class="muted">Pay date: 10/24/2026</div><div class="muted">Period: 10/05/2026 – 10/18/2026</div><div class="muted">Pay frequency: Bi-weekly</div></div></div>
<div class="box flex"><div><b>Employee:</b> Lucía Example<br/>ID 004417 · Cashier, Full time</div><div>Net pay<br/><b style="font-size:20px">$1,912.36</b></div></div>
<table><tr><th>Earnings</th><th class="r">Rate</th><th class="r">Hours</th><th class="r">This period</th><th class="r">Year to date</th></tr>
<tr><td>Regular</td><td class="r">28.50</td><td class="r">80.00</td><td class="r">2,280.00</td><td class="r">50,160.00</td></tr>
<tr><td>Overtime</td><td class="r">42.75</td><td class="r">2.81</td><td class="r">120.00</td><td class="r">2,640.00</td></tr>
<tr><td><b>Gross pay</b></td><td></td><td></td><td class="r"><b>2,400.00</b></td><td class="r"><b>52,800.00</b></td></tr></table>
<table><tr><th>Deductions</th><th class="r">This period</th><th class="r">Year to date</th></tr>
<tr><td>Federal income tax</td><td class="r">168.40</td><td class="r">3,704.80</td></tr><tr><td>Social Security</td><td class="r">148.80</td><td class="r">3,273.60</td></tr>
<tr><td>Medicare</td><td class="r">34.80</td><td class="r">765.60</td></tr><tr><td>CA state tax</td><td class="r">62.04</td><td class="r">1,364.88</td></tr>
<tr><td>CA SDI</td><td class="r">26.40</td><td class="r">580.80</td></tr><tr><td>Medical</td><td class="r">47.20</td><td class="r">1,038.40</td></tr></table>
<p class="muted">This is a fictional document generated for software testing. Not a real employer or person.</p></body></html>`;

const rows: [string, string, string, string][] = [
  ['09/01', 'Opening balance', '', '642.18'], ['09/02', 'PAYROLL SUNRIDGE MARKET CO', '+2,400.00', '3,042.18'], ['09/03', 'RENT ZELLE TO PARKVIEW APTS', '-2,350.00', '692.18'],
  ['09/05', 'COASTLINE AUTO FINANCE PMT', '-342.00', '350.18'], ['09/08', 'HARBOR CARD SERVICES PMT', '-65.00', '285.18'], ['09/09', 'GROCERY OUTLET', '-188.42', '96.76'],
  ['09/10', 'QUICKCASH LENDING ACH', '-120.00', '-23.24'], ['09/10', 'OVERDRAFT FEE', '-35.00', '-58.24'], ['09/14', 'CASH DEPOSIT BRANCH 112', '+1,500.00', '1,441.76'],
  ['09/16', 'PAYROLL SUNRIDGE MARKET CO', '+2,400.00', '3,841.76'], ['09/18', 'SO CAL EDISON', '-96.30', '3,745.46'], ['09/22', 'CHILD SUPPORT OC DCSS', '+410.00', '4,155.46'],
  ['09/25', 'GROCERY OUTLET', '-212.10', '3,943.36'], ['09/28', 'NSF RETURNED ITEM FEE', '-35.00', '3,908.36'], ['09/30', 'PAYROLL SUNRIDGE MARKET CO', '+2,400.00', '6,308.36'],
];
const statement = `<html><head><style>${css}</style></head><body>
<div class="flex"><div><h1>Pacific Example Credit Union</h1><div class="muted">FICTIONAL SAMPLE · Member services 1-800-000-0000</div></div>
<div><b>Monthly statement</b><div class="muted">September 1 – September 30, 2026</div><div class="muted">Checking ****4471</div></div></div>
<div class="box">Lucía Example · 123 Example St, Santa Ana, CA 92703</div>
<table><tr><th>Date</th><th>Description</th><th class="r">Amount</th><th class="r">Balance</th></tr>
${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td class="r">${r[2]}</td><td class="r">${r[3]}</td></tr>`).join('')}</table>
<p class="muted">Deposits this period: $9,110.00 · Withdrawals: $3,443.82 · Fees: $70.00</p>
<p class="muted">This is a fictional document generated for software testing. Not a real bank or person.</p></body></html>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 892, height: 600 }, deviceScaleFactor: 1.5 });
  for (const [name, html] of [['paystub', paystub], ['bank-statement', statement]] as const) {
    await p.setContent(html);
    await p.screenshot({ path: `fixtures/${name}.png`, fullPage: true });
    fs.copyFileSync(`fixtures/${name}.png`, `public/samples/${name}.png`);
  }
  await p.setContent(statement);
  await p.pdf({ path: 'fixtures/bank-statement.pdf', format: 'Letter' });
  fs.copyFileSync('fixtures/bank-statement.pdf', 'public/samples/bank-statement.pdf');
  fs.writeFileSync('fixtures/not-a-statement.txt', 'Grocery list: rice, beans, tortillas, milk.\n');
  await b.close();
})();
