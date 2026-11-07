// The Keystone arch, as pure geometry (shared by the wordmark component and scripts/build-icons.ts).
// Base on y = 0, springline at y = −26, centre x = 46; pier stones and seven voussoirs, the middle one the keystone.
/* ---- the arch, in its own frame: base on y = 0, springline at y = −26, centre x = 46 ---- */
export const CX = 46;
export const SPRING = -26;
export const R1 = 25;
export const R2 = 44;
const VOUSSOIRS = 7;
const KEY = 3;
const GAP = 1.6;
const rad = (d: number) => (d * Math.PI) / 180;
const pt = (r: number, a: number) => [CX + r * Math.cos(rad(a)), SPRING - r * Math.sin(rad(a))] as const;
const f = (n: number) => +n.toFixed(2);
function sector(lo: number, hi: number, r1: number, r2: number) {
  const [ax, ay] = pt(r2, hi);
  const [bx, by] = pt(r2, lo);
  const [cx, cy] = pt(r1, lo);
  const [dx, dy] = pt(r1, hi);
  return `M${f(ax)} ${f(ay)}A${r2} ${r2} 0 0 1 ${f(bx)} ${f(by)}L${f(cx)} ${f(cy)}A${r1} ${r1} 0 0 0 ${f(dx)} ${f(dy)}Z`;
}
export type Stone = { d: string; key?: boolean; side: -1 | 0 | 1; step: number; tone: number };
function archStones(): Stone[] {
  const span = 180 / VOUSSOIRS;
  const g = (GAP / ((R1 + R2) / 2)) * (180 / Math.PI) * 0.5;
  const out: Stone[] = [];
  // piers: two stones a side (bottom first)
  const pier = (x: number, y0: number, y1: number, side: -1 | 1, step: number, tone: number) =>
    out.push({ d: `M${x} ${y0}H${x + (R2 - R1)}V${y1}H${x}Z`, side, step, tone });
  pier(CX - R2, -0.2, -12.2, -1, 0, 0.62);
  pier(CX + R1, -0.2, -12.2, 1, 0, 0.36);
  pier(CX - R2, -13.8, SPRING + 0.8, -1, 1, 0.66);
  pier(CX + R1, -13.8, SPRING + 0.8, 1, 1, 0.4);
  for (let i = 0; i < VOUSSOIRS; i++) {
    const hi = 180 - i * span - g;
    const lo = 180 - (i + 1) * span + g;
    if (i === KEY) {
      out.push({ d: sector(lo - 1.2, hi + 1.2, R1 - 1.5, R2 + 5), key: true, side: 0, step: 5, tone: 0.5 });
      continue;
    }
    const left = i < KEY;
    // light from the top-left: the left stones catch it, the right ones fall into shade
    out.push({ d: sector(lo, hi, R1, R2), side: left ? -1 : 1, step: left ? 2 + i : 2 + (VOUSSOIRS - 1 - i), tone: left ? 0.72 - i * 0.04 : 0.3 + (VOUSSOIRS - 1 - i) * 0.04 });
  }
  return out;
}
export const STONES = archStones();
/** The keyhole cut into the keystone (in arch units). */
export const [KX, KY] = pt((R1 + R2) / 2 + 1.5, 90);
export const KEYHOLE = `M${f(KX)} ${f(KY - 6.2)}a3.4 3.4 0 1 1 0.01 0Z M${f(KX - 1.6)} ${f(KY - 3.6)}L${f(KX - 2.6)} ${f(KY + 4.6)}H${f(KX + 2.6)}L${f(KX + 1.6)} ${f(KY - 3.6)}Z`;


const hex = (c: string) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
const toHex = (v: number[]) => `#${v.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;
/** a share t of `to` blended into c */
const blend = (c: string, to: string, t: number) => toHex(hex(c).map((x, k) => x + (hex(to)[k] - x) * t));

/** A standalone SVG of the arch (favicon / app icon): hex colours only, shaded stones, the keyhole; a night version under prefers-color-scheme: dark (the keystone glows). */
export function archIconSvg({ pine = '#1E5C47', brass = '#B8862B', nightPine = '#4FA585', nightBrass = '#D9A64A', bg, nightBg }: { pine?: string; brass?: string; nightPine?: string; nightBrass?: string; bg?: string; nightBg?: string } = {}) {
  const grads = (pre: string, p: string, b: string) =>
    STONES.map((s, i) => {
      const light = s.key ? 0.28 : 0.3 - (1 - s.tone) * 0.22;
      const dark = s.key ? 0.16 : 0.22 - s.tone * 0.12;
      const c = s.key ? b : p;
      return `<linearGradient id="${pre}${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${blend(c, '#ffffff', light)}"/><stop offset="1" stop-color="${blend(c, '#000000', dark)}"/></linearGradient>`;
    }).join('');
  const stones = (pre: string) => STONES.map((s, i) => `<path d="${s.d}" fill="url(#${pre}${i})"${s.key ? ' mask="url(#kh)"' : ''}/>`).join('');
  const glowY = SPRING - (R1 + R2) / 2 - 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -82 96 96">
<style>.n{display:none}@media (prefers-color-scheme: dark){.d{display:none}.n{display:inline}}</style>
<defs>${grads('g', pine, brass)}${grads('h', nightPine, nightBrass)}<mask id="kh" maskUnits="userSpaceOnUse" x="-10" y="-100" width="120" height="120"><rect x="-10" y="-100" width="120" height="120" fill="#fff"/><path d="${KEYHOLE}" fill="#000"/></mask><filter id="kg" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="7"/></filter></defs>
<g class="d">${bg ? `<rect x="-2" y="-82" width="96" height="96" rx="20" fill="${bg}"/>` : ''}${stones('g')}</g>
<g class="n">${nightBg ?? bg ? `<rect x="-2" y="-82" width="96" height="96" rx="20" fill="${nightBg ?? bg}"/>` : ''}<circle cx="${CX}" cy="${glowY}" r="15" fill="${nightBrass}" opacity="0.55" filter="url(#kg)"/>${stones('h')}</g>
</svg>
`;
}

/** Each stone as a polygon (arch units, y up = negative in SVG terms is flipped here: y grows upward), for 3D extrusion. */
export type StonePoly = { pts: [number, number][]; key: boolean; side: -1 | 0 | 1; step: number; tone: number; centroid: [number, number] };
export const STONE_POLYS: StonePoly[] = (() => {
  const span = 180 / VOUSSOIRS;
  const g = (GAP / ((R1 + R2) / 2)) * (180 / Math.PI) * 0.5;
  const arc = (r: number, a0: number, a1: number, n = 10) => Array.from({ length: n + 1 }, (_, i) => {
    const a = rad(a0 + ((a1 - a0) * i) / n);
    return [CX + r * Math.cos(a), -SPRING + r * Math.sin(a)] as [number, number];
  });
  const out: StonePoly[] = [];
  const rect = (x0: number, y0: number, x1: number, y1: number, side: -1 | 1, step: number, tone: number) => out.push({ pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], key: false, side, step, tone, centroid: [(x0 + x1) / 2, (y0 + y1) / 2] });
  // piers (y up from the base): two stones a side
  rect(CX - R2, 0.2, CX - R1, 12.2, -1, 0, 0.62);
  rect(CX + R1, 0.2, CX + R2, 12.2, 1, 0, 0.36);
  rect(CX - R2, 13.8, CX - R1, -SPRING - 0.8, -1, 1, 0.66);
  rect(CX + R1, 13.8, CX + R2, -SPRING - 0.8, 1, 1, 0.4);
  for (let i = 0; i < VOUSSOIRS; i++) {
    const key = i === KEY;
    let hi = 180 - i * span - g;
    let lo = 180 - (i + 1) * span + g;
    let r1 = R1;
    let r2 = R2;
    if (key) {
      lo -= 1.2;
      hi += 1.2;
      r1 -= 1.5;
      r2 += 5;
    }
    const pts = [...arc(r2, hi, lo), ...arc(r1, lo, hi)];
    const mid = rad((lo + hi) / 2);
    const left = i < KEY;
    out.push({ pts, key, side: key ? 0 : left ? -1 : 1, step: key ? 5 : left ? 2 + i : 2 + (VOUSSOIRS - 1 - i), tone: key ? 0.5 : left ? 0.72 - i * 0.04 : 0.3 + (VOUSSOIRS - 1 - i) * 0.04, centroid: [CX + ((r1 + r2) / 2) * Math.cos(mid), -SPRING + ((r1 + r2) / 2) * Math.sin(mid)] });
  }
  return out;
})();
/** The keyhole in the keystone, as a circle + slot (arch units, y up). */
/** The keyhole (y up): a round hole near the top and a tapered slot beneath it, as in KEYHOLE (radius trimmed so it clears the edge). */
export const KEYHOLE_UP = { cx: KX, cy: -KY + 9.4, r: 3.0, slot: { top: -KY + 3.6, bottom: -KY - 4.6, halfTop: 1.6, halfBottom: 2.6 } };
export const ARCH_GEO = { VOUSSOIRS, KEY, GAP };
