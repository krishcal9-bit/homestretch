// Usage: tsx scripts/screenshot.ts <name> <path> [--mobile|--desktop] [--base=http://localhost:3000]
// Takes a screenshot of a route into docs/screenshots/<name>-<viewport>.png
import { chromium } from 'playwright';

async function main() {
  const [name, route = '/'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const base = process.argv.find((a) => a.startsWith('--base='))?.slice(7) ?? 'http://localhost:3000';
  const which = process.argv.includes('--mobile') ? ['mobile'] : process.argv.includes('--desktop') ? ['desktop'] : ['mobile', 'desktop'];
  const browser = await chromium.launch();
  for (const v of which) {
    const viewport = v === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
    await page.goto(base + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `docs/screenshots/${name}-${v}.png`, fullPage: true });
    await page.close();
  }
  await browser.close();
}
main();
