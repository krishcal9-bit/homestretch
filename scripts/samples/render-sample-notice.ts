// Renders the fictional FAIR Plan renewal notice used by the Keep demo to public/samples/ramirez-insurance-renewal.png.
// Run: npx tsx scripts/samples/render-sample-notice.ts
import { chromium } from '@playwright/test';
import path from 'path';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 1 });
  await page.goto(`file://${path.join(__dirname, 'ramirez-insurance-renewal.html')}`);
  const out = path.join(__dirname, '../../public/samples/ramirez-insurance-renewal.png');
  await page.locator('.page').screenshot({ path: out });
  await browser.close();
  console.log('wrote', out);
}
main();
