// Round 6: axe colour contrast per page per theme (violations and the nodes axe could not decide, e.g. text
// over scenery). Usage: npx tsx --env-file=.env scripts/axe-theme.ts [base=http://localhost:3152]
import { chromium, type Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import sharp from 'sharp';

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1) ?? d;
const B = arg('base', 'http://localhost:3152');
const draft = JSON.parse(fs.readFileSync('fixtures/demo-draft.json', 'utf8'));

async function settle(p: Page) {
  await p.waitForTimeout(1800);
  await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || (a.effect?.getTiming().iterations ?? 1) === Infinity), null, { timeout: 6000 }).catch(() => {});
  await p.waitForTimeout(400);
}

type Measured = { sel: string; ratio: number; need: number; color: string };
const lum = ([r, g, b]: number[]) => {
  const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: number[], b: number[]) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
/** 'rgb(…)', 'rgba(…)' or 'color(srgb r g b / a)' → [r, g, b, a] in 0–255 (a 0–1). */
function parseColor(c: string): number[] | null {
  let m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  m = c.match(/color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+))?\)/);
  if (m) return [+m[1] * 255, +m[2] * 255, +m[3] * 255, m[4] === undefined ? 1 : +m[4]];
  return null;
}

async function measure(p: Page, sels: string[]): Promise<Measured[]> {
  if (!sels.length) return [];
  const els = await p.evaluate((list) => {
    const out: { i: number; s: string; color: string; large: boolean }[] = [];
    list.forEach((s, i) => {
      let el: Element | null = null;
      try { el = document.querySelector(s); } catch {}
      if (!el) return;
      // while a dialog is open, the page behind its scrim is not what anyone reads
      const dialog = document.querySelector('[role=dialog]');
      if (dialog && !dialog.contains(el)) return;
      const cs = getComputedStyle(el);
      // inputs whose own text is transparent: their value is drawn by an element over them (checked on its own)
      if (/rgba\(.*,\s*0\)$/.test(el instanceof SVGElement ? cs.fill : cs.color)) return;
      const size = parseFloat(cs.fontSize);
      const weight = parseInt(cs.fontWeight, 10);
      el.setAttribute('data-measure', String(i));
      out.push({ i, s, color: el instanceof SVGElement ? cs.fill : cs.color, large: size >= 24 || (size >= 18.66 && weight >= 700) });
    });
    const st = document.createElement('style');
    st.id = 'measure-hide';
    st.textContent = '[data-measure], [data-measure] * { color: transparent !important; fill: transparent !important; -webkit-text-fill-color: transparent !important; caret-color: transparent !important; text-shadow: none !important; }';
    document.head.appendChild(st);
    return out;
  }, sels);
  const res: Measured[] = [];
  for (const e of els) {
    const loc = p.locator(`[data-measure="${e.i}"]`);
    const box = await loc.evaluate((el) => {
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const r = el.getBoundingClientRect();
      return { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.min(r.width, innerWidth - Math.max(0, r.left)), height: Math.min(r.height, innerHeight - Math.max(0, r.top)) };
    }).catch(() => null);
    if (!box || box.width < 2 || box.height < 2) continue;
    await p.waitForTimeout(60);
    const png = await p.screenshot({ clip: box }).catch(() => null);
    if (!png) continue;
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const fg = parseColor(e.color);
    if (!fg) continue;
    const px: number[][] = [];
    for (let k = 0; k < info.width * info.height; k++) px.push([data[k * 3], data[k * 3 + 1], data[k * 3 + 2]]);
    // a translucent text colour sits on the median background pixel
    const med = px.map((q) => [lum(q), q] as const).sort((a, b2) => a[0] - b2[0])[px.length >> 1][1];
    const text = fg[3] < 1 ? [0, 1, 2].map((k) => fg[k] * fg[3] + med[k] * (1 - fg[3])) : fg.slice(0, 3);
    const rs = px.map((q) => ratio(text, q)).sort((a, b2) => a - b2);
    res.push({ sel: e.s, ratio: rs[Math.floor(rs.length * 0.05)], need: e.large ? 3 : 4.5, color: e.color });
  }
  await p.evaluate(() => {
    document.getElementById('measure-hide')?.remove();
    document.querySelectorAll('[data-measure]').forEach((el) => el.removeAttribute('data-measure'));
    window.scrollTo(0, 0);
  });
  return res;
}

(async () => {
  const b = await chromium.launch();
  const rows: string[] = [];
  for (const theme of ['light', 'dark'] as const) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
    await ctx.addInitScript(() => {
      try { sessionStorage.setItem('hs.nointro', '1'); localStorage.setItem('hs.dragged', '1'); } catch {}
    });
    const p = await ctx.newPage();
    const check = async (name: string) => {
      await settle(p);
      const r = await new AxeBuilder({ page: p as never }).withRules(['color-contrast']).analyze();
      const v = r.violations.flatMap((x) => x.nodes);
      const inc = r.incomplete.flatMap((x) => x.nodes);
      const passes = r.passes.flatMap((x) => x.nodes).length;
      // axe can't decide text over images (scenery, paper grain): measure those from pixels instead — hide the
      // text, screenshot what's behind it, and take the worst ratio against the 5th-percentile background pixel.
      // pages over scenery: measure everything axe passed too (it can miss a gradient sky behind a fixed layer)
      const scenery = await p.evaluate(() => !!document.querySelector('[data-testid=world],[data-testid=backdrop],[data-testid=road-scene]'));
      const nodes = scenery ? [...inc, ...r.passes.flatMap((x) => x.nodes)] : inc;
      const measured = await measure(p, nodes.map((n) => String(n.target[n.target.length - 1])));
      const low = measured.filter((m) => m.ratio < m.need);
      rows.push(`${theme}\t${name}\taxe pass ${passes}\taxe fail ${v.length}\tmeasured ${measured.length}, min ${measured.length ? Math.min(...measured.map((m) => m.ratio)).toFixed(2) : '-'}\tbelow ${low.length}`);
      for (const n of v) rows.push(`   FAIL ${n.target} :: ${n.any[0]?.message ?? ''}`);
      for (const m of low) rows.push(`   LOW  ${m.sel} :: ${m.ratio.toFixed(2)} (needs ${m.need}) text ${m.color}`);
    };
    await p.goto(B + '/?nointro');
    await check('landing');
    for (const s of [1, 2, 3, 4, 5]) {
      await p.evaluate(([d, st]) => { localStorage.setItem('hs.draft', JSON.stringify(d)); localStorage.setItem('hs.step', String(st)); }, [draft, s] as const);
      await p.goto(B + '/start');
      await check(s === 5 ? 'result' : `step${s}`);
    }
    await p.goto(B + '/plan/NGU7P3');
    await check('plan');
    await p.goto(B + '/plan/notarealcode');
    await check('plan-404');
    await p.goto(B + '/no-such-page');
    await check('not-found');
    await p.goto(B + '/staff/login');
    await check('login');
    await p.fill('input[type=password]', process.env.STAFF_PASSWORD ?? '');
    await p.keyboard.press('Enter');
    await p.waitForSelector('[data-testid=family-row]', { timeout: 60_000 });
    await check('pipeline');
    await p.getByTestId('family-row').first().click();
    await check('drawer');
    for (const r of ['homes', 'match?home=h1', 'insights']) {
      await p.goto(`${B}/staff/${r}`);
      await check(r.split('?')[0]);
    }
    await ctx.close();
  }
  await b.close();
  console.log(rows.join('\n'));
})();
