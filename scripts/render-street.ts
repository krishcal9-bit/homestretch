// Renders the landing street's house stills from /dev/house (dev server only), same camera as the live hero
// house (STREET_FRAME, no plinth, shadows on an invisible ground), on transparency:
//   public/house/street.png, street-night.png      — the family's house (fallback + placeholder of the live one)
//   public/house/street-n{1,2,3}{,-night}.webp      — the neighbours (other colours, some mirrored)
// usage: npx tsx scripts/render-street.ts [baseUrl]
import { chromium } from 'playwright';
import sharp from 'sharp';

(async () => {
  const base = process.argv[2] ?? 'http://localhost:3000';
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const shot = async (q: string, w: number, dsf: number) => {
    const p = await b.newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: dsf });
    await p.goto(`${base}/dev/house?frame=street&ground=0&w=${w}&${q}`, { timeout: 180000 });
    await p.waitForSelector('[data-testid=dev-house] canvas', { timeout: 120000 });
    await p.addStyleTag({ content: 'html,body,body *{background:transparent!important;box-shadow:none!important} body *{visibility:hidden!important} [data-testid=dev-house], [data-testid=dev-house] *{visibility:visible!important}' });
    await p.waitForTimeout(4500);
    const buf = await p.locator('[data-testid=dev-house]').screenshot({ omitBackground: true });
    await p.close();
    return buf;
  };
  for (const night of [0, 1]) {
    const sfx = night ? '-night' : '';
    await sharp(await shot(`variant=0&night=${night}&lit=1`, 600, 2)).png({ compressionLevel: 9 }).toFile(`public/house/street${sfx}.png`);
    for (const v of [1, 2, 3]) {
      await sharp(await shot(`variant=${v}&night=${night}&lit=${night ? 2 + (v % 2) : 0}`, 700, 1)).webp({ quality: 82, alphaQuality: 90 }).toFile(`public/house/street-n${v}${sfx}.webp`);
    }
  }
  await b.close();
})();
