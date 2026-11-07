// Renders the landing street's stills from /dev/house (dev server only), with the live hero house's camera
// (STREET_FRAME: no plinth, shadows on an invisible ground, the same top-left light), on transparency:
//   public/house/street.png, street-night.png        — the family's house (fallback + placeholder of the live one)
//   public/house/street-{name}{,-night}.webp          — the neighbours and the street trees (HOUSE_VARIANTS 1–7)
//   public/house/street-stills.json                   — each still's size and ground anchor, read by HeroScene
// Every still is rendered 560px tall (the street frame's 8.31 units), so one unit is the same size in all of
// them and in the live house's slot; neighbours are rendered wider (the camera keeps its distance) and then
// cropped to what they draw, day and night alike.
// usage: npx tsx scripts/render-street.ts [baseUrl] [--neighbours]   (--neighbours keeps the family's stills)
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import sharp from 'sharp';

/** HOUSE_VARIANTS (components/three/houseModel.tsx) rendered here: index → still name. Keep in step. */
const STILLS: { variant: number; name: string; lit: number }[] = [
  { variant: 1, name: 'ranch', lit: 2 },
  { variant: 2, name: 'townhomes', lit: 3 },
  { variant: 3, name: 'colonial', lit: 1 },
  { variant: 4, name: 'cottage', lit: 2 },
  { variant: 5, name: 'foursquare', lit: 2 },
  { variant: 6, name: 'tree', lit: 0 },
  { variant: 7, name: 'trees', lit: 0 },
];
/** the render height (px) and how wide the neighbours' frame is before cropping */
const H = 560;
const FRAME_W = 1100;
/** where every front path meets the sidewalk, as a share of the frame's height (Road.tsx SLOT.street.ay) */
const AY = 0.935;
const PAD = 4;

type Box = { left: number; top: number; right: number; bottom: number };
async function alphaBox(buf: Buffer): Promise<Box> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = { left: info.width, top: info.height, right: -1, bottom: -1 };
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++)
      if (data[(y * info.width + x) * 4 + 3] > 6) {
        if (x < b.left) b.left = x;
        if (x > b.right) b.right = x;
        if (y < b.top) b.top = y;
        if (y > b.bottom) b.bottom = y;
      }
  return b;
}
const union = (a: Box, b: Box): Box => ({ left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) });

(async () => {
  const base = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:3000';
  const neighboursOnly = process.argv.includes('--neighbours');
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const shot = async (q: string, w: number, h: number, dsf: number) => {
    const p = await b.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: dsf });
    await p.goto(`${base}/dev/house?frame=street&ground=0&w=${w}&${q}`, { timeout: 180000 });
    await p.waitForSelector('[data-testid=dev-house] canvas', { timeout: 120000 });
    await p.addStyleTag({
      content: `html,body,body *{background:transparent!important;box-shadow:none!important} body *{visibility:hidden!important} [data-testid=dev-house], [data-testid=dev-house] *{visibility:visible!important} [data-testid=dev-house]{height:${h}px!important}`,
    });
    await p.waitForTimeout(4500);
    const buf = await p.locator('[data-testid=dev-house]').screenshot({ omitBackground: true });
    await p.close();
    return buf;
  };

  // the family's house: its own 5:4 frame (the slot), at 2× for the hero's largest slot
  const familyDay = neighboursOnly ? readFileSync('public/house/street.png') : await shot('variant=0&night=0&lit=1', 600, 480, 2);
  if (!neighboursOnly) {
    await sharp(familyDay).png({ compressionLevel: 9 }).toFile('public/house/street.png');
    await sharp(await shot('variant=0&night=1&lit=1', 600, 480, 2)).png({ compressionLevel: 9 }).toFile('public/house/street-night.png');
  }
  const fm = await sharp(familyDay).metadata();
  const fb = await alphaBox(familyDay);
  const manifest: { family: { l: number; r: number; t: number }; h: number; stills: Record<string, { w: number; h: number; ay: number; cx: number }> } = {
    // the family's drawing inside its slot, as shares of the slot (left, right, top)
    family: { l: +(fb.left / fm.width!).toFixed(4), r: +((fb.right + 1) / fm.width!).toFixed(4), t: +(fb.top / fm.height!).toFixed(4) },
    h: H,
    stills: {},
  };

  for (const s of STILLS) {
    const day = await shot(`variant=${s.variant}&night=0&lit=0`, FRAME_W, H, 1);
    const night = await shot(`variant=${s.variant}&night=1&lit=${s.lit}`, FRAME_W, H, 1);
    const bx = union(await alphaBox(day), await alphaBox(night));
    const left = Math.max(0, bx.left - PAD);
    const top = Math.max(0, bx.top - PAD);
    const width = Math.min(FRAME_W, bx.right + 1 + PAD) - left;
    const height = Math.min(H, bx.bottom + 1 + PAD) - top;
    for (const [buf, sfx] of [
      [day, ''],
      [night, '-night'],
    ] as const) {
      await sharp(buf).extract({ left, top, width, height }).webp({ quality: 82, alphaQuality: 90, effort: 6 }).toFile(`public/house/street-${s.name}${sfx}.webp`);
    }
    // ay: the sidewalk line inside the crop; cx: the frame's centre (the lot's middle) inside the crop
    manifest.stills[s.name] = { w: width, h: height, ay: +(AY * H - top).toFixed(1), cx: FRAME_W / 2 - left };
    console.log(s.name, manifest.stills[s.name]);
  }
  writeFileSync('public/house/street-stills.json', `${JSON.stringify(manifest, null, 2)}\n`);
  await b.close();
})();
