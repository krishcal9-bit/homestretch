// Renders the demo water-heater data plate (fictional brand) to public/samples/water-heater-plate.png.
// Usage: npx tsx scripts/make-sample-plate.ts
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0}
  body{width:1200px;height:800px;background:#c9cfcc;display:flex;align-items:center;justify-content:center;font-family:'DejaVu Sans','Liberation Sans',Arial,sans-serif}
  .tank{position:absolute;inset:0;background:repeating-linear-gradient(90deg,#c4cac7 0 6px,#c9cfcc 6px 14px)}
  .plate{position:relative;width:860px;background:#f3f1ea;border:2px solid #3a3a36;border-radius:10px;padding:34px 40px 28px;transform:rotate(-2.2deg);color:#1d1d1b}
  .rivet{position:absolute;width:16px;height:16px;border-radius:50%;background:#9aa09c;border:2px solid #6d726f}
  .brand{font-size:40px;font-weight:700;letter-spacing:.06em}
  .type{font-size:22px;margin-top:4px;border-bottom:2px solid #1d1d1b;padding-bottom:14px}
  table{width:100%;border-collapse:collapse;margin-top:14px;font-size:24px}
  td{padding:7px 0;border-bottom:1px solid #b9b6aa}
  td:first-child{width:46%;color:#444}
  td:last-child{font-weight:700;font-family:'DejaVu Sans Mono','Liberation Mono',monospace}
  .warn{margin-top:16px;font-size:15px;line-height:1.35;color:#333}
  .demo{margin-top:12px;font-size:15px;font-weight:700;letter-spacing:.08em;color:#7a2a20}
</style></head><body><div class="tank"></div>
<div class="plate">
  <span class="rivet" style="left:12px;top:12px"></span><span class="rivet" style="right:12px;top:12px"></span>
  <span class="rivet" style="left:12px;bottom:12px"></span><span class="rivet" style="right:12px;bottom:12px"></span>
  <div class="brand">SAMPLE WATER HEATER CO.</div>
  <div class="type">Residential gas water heater · Natural gas</div>
  <table>
    <tr><td>Model No.</td><td>SW-40N-2</td></tr>
    <tr><td>Serial No.</td><td>1403A0471158</td></tr>
    <tr><td>Mfg. date</td><td>03/2014</td></tr>
    <tr><td>Capacity</td><td>40 U.S. gal (151 L)</td></tr>
    <tr><td>Input</td><td>36,000 BTU/hr</td></tr>
    <tr><td>Recovery</td><td>39 GPH at 90°F rise</td></tr>
    <tr><td>Max. working pressure</td><td>150 PSI</td></tr>
  </table>
  <div class="warn">Serial number: first 2 digits = year, next 2 = month of manufacture. Install per local codes. Keep flammable vapors away.</div>
  <div class="demo">SAMPLE LABEL FOR DEMONSTRATION · NOT A REAL PRODUCT</div>
</div></body></html>`;

(async () => {
  const out = path.join(process.cwd(), 'public/samples/water-heater-plate.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  await p.setContent(HTML);
  await p.screenshot({ path: out });
  await b.close();
  console.log(out);
})();
