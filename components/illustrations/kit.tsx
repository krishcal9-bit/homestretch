'use client';
import { createContext, memo, useContext, useId, type ReactNode } from 'react';
import { P, mix } from '@/lib/illustrationPalette';

/**
 * The illustration kit: the landing's drawing language as reusable SVG primitives (round 7).
 *
 * Style. Soft and dimensional: every object has two or three tones (a lit face, a shade face, ambient
 * occlusion where it meets the ground). One light source everywhere, high on the top-left, so lit faces
 * look up and left, shade gathers bottom-right, and contact shadows fall slightly right. Distance is
 * atmospheric: `haze` (0–1) pulls every tone toward `hazeTo` (the sky behind it), so far layers are lighter
 * and less saturated. Far things are simpler (fewer clusters), never a different style.
 *
 * Mechanics. Everything draws inside a parent <svg> in its user units, anchored bottom-centre at
 * (x, base) unless noted. Colours come only from the palette (`P`, `mix`), so the dark theme repaints
 * every piece with no re-render. No filters: softness comes from gradients and layered fills. Leaf masses
 * are merged into one path per tone, so a tree costs about eight nodes.
 *
 *   <svg viewBox="0 0 1600 900">
 *     <Kit>                                         shared gradients for this svg (optional, saves nodes)
 *       <Hills x0={0} x1={1600} bottom={900} layers={[{ y: 520, haze: 0.5 }, { y: 640 }]} />
 *       <Tree species="oak" x={400} base={700} size={160} />
 *       <Bush x={520} base={704} size={60} />
 *     </Kit>
 *   </svg>
 */

/* ------------------------------------------------------------------ */
/* Shared defs                                                         */
/* ------------------------------------------------------------------ */

const KitCtx = createContext<string | null>(null);

/** Rounds to 0.1 (trigonometry can differ in the last digit between the server and the browser). */
const r1 = (v: number) => Math.round(v * 10) / 10;
/** A colour pushed toward `to` by `haze` (aerial perspective). */
export const hazed = (c: string, haze = 0, to: string = P.skyBottom) => (haze > 0 ? mix(c, to, Math.min(1, haze)) : c);
/** Deterministic pseudo-random (same on server and client). */
export function seeded(seed: number) {
  let s = Math.max(1, Math.floor(seed) % 2147483647);
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
/** One circle as a path segment (to merge many into one path). */
const circ = (cx: number, cy: number, r: number) => `M${r1(cx - r)} ${r1(cy)}a${r1(r)} ${r1(r)} 0 1 0 ${r1(r * 2)} 0a${r1(r)} ${r1(r)} 0 1 0 ${r1(-r * 2)} 0Z`;

/** The gradients every kit piece shares: the contact shadow, and the light and occlusion over a leaf mass. */
function KitGradients({ id }: { id: string }) {
  return (
    <>
      <radialGradient id={`${id}-cs`}>
        <stop offset="0" stopColor={P.ink} stopOpacity="0.34" />
        <stop offset="0.45" stopColor={P.ink} stopOpacity="0.16" />
        <stop offset="1" stopColor={P.ink} stopOpacity="0" />
      </radialGradient>
      {/* light falling on a rounded mass from the top-left */}
      <radialGradient id={`${id}-sheen`} cx="0.3" cy="0.22" r="0.62">
        <stop offset="0" stopColor={P.cloudLight} stopOpacity="0.34" />
        <stop offset="0.55" stopColor={P.cloudLight} stopOpacity="0.08" />
        <stop offset="1" stopColor={P.cloudLight} stopOpacity="0" />
      </radialGradient>
      {/* the underside turning away from the light */}
      <linearGradient id={`${id}-under`} x1="0.2" y1="0" x2="0.5" y2="1">
        <stop offset="0.45" stopColor={P.ink} stopOpacity="0" />
        <stop offset="1" stopColor={P.ink} stopOpacity="0.26" />
      </linearGradient>
    </>
  );
}

/** The id prefix of the shared gradients: the surrounding Kit's, or this piece's own (it then draws them). */
function useKitIds() {
  const shared = useContext(KitCtx);
  const own = `ko${useId().replace(/[:«»]/g, '')}`;
  return { id: shared ?? own, defs: shared ? null : <defs><KitGradients id={own} /></defs> };
}

/** Shared gradients for one <svg>: wrap a drawing in it and the kit pieces inside reuse its defs. Optional. */
export function Kit({ children }: { children: ReactNode }) {
  const id = `kit${useId().replace(/[:«»]/g, '')}`;
  return (
    <KitCtx.Provider value={id}>
      <defs>
        <KitGradients id={id} />
      </defs>
      {children}
    </KitCtx.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Contact shadow                                                      */
/* ------------------------------------------------------------------ */

/**
 * A soft contact shadow: a wide penumbra and a tight, darker core where the object touches the ground
 * (ambient occlusion). Centred at (cx, cy); it leans right of the object, away from the top-left light.
 * `strength` scales the darkness (1 = an object standing on lawn).
 */
export const ContactShadow = memo(function ContactShadow({ cx, cy, rx, ry, strength = 1 }: { cx: number; cy: number; rx: number; ry?: number; strength?: number }) {
  const { id, defs } = useKitIds();
  const fill = `url(#${id}-cs)`;
  const h = ry ?? rx * 0.18;
  return (
    <g>
      {defs}
      <ellipse cx={r1(cx)} cy={r1(cy)} rx={r1(rx)} ry={r1(h)} fill={fill} opacity={Math.min(1, 0.9 * strength)} />
      <ellipse cx={r1(cx - rx * 0.12)} cy={r1(cy - h * 0.08)} rx={r1(rx * 0.5)} ry={r1(h * 0.5)} fill={fill} opacity={Math.min(1, 0.85 * strength)} />
    </g>
  );
});

/* ------------------------------------------------------------------ */
/* Trees                                                               */
/* ------------------------------------------------------------------ */

export type TreeSpecies = 'palm' | 'jacaranda' | 'oak' | 'cypress';
type Tones = { deep: string; base: string; light: string; sun: string };
type Cluster = [number, number, number]; // cx, cy, r in a 100-tall tree

const leafTones = (haze: number, to?: string): Tones => ({
  deep: hazed(P.foliageDeep, haze, to),
  base: hazed(P.foliage, haze, to),
  light: hazed(P.foliageLight, haze, to),
  sun: hazed(P.foliageSun, haze, to),
});
const bloomTones = (haze: number, to?: string): Tones => ({
  deep: hazed(P.jacarandaDark, haze, to),
  base: hazed(P.jacaranda, haze, to),
  light: hazed(P.jacarandaLight, haze, to),
  sun: hazed(mix(P.jacarandaLight, P.trim, 0.4), haze, to),
});

/**
 * A leaf mass from clusters: the whole silhouette in the deep tone; each cluster again in the base tone,
 * nudged up-left so a shaded crescent stays bottom-right; the upper clusters' lit faces; then, over the whole
 * mass, a soft sheen from the top-left and occlusion on the underside (shared gradients, no filters).
 */
function LeafMass({ clusters, tones, simple, haze = 0 }: { clusters: Cluster[]; tones: Tones; simple: boolean; haze?: number }) {
  const { id, defs } = useKitIds();
  const top = Math.min(...clusters.map((c) => c[1] - c[2]));
  const bottom = Math.max(...clusters.map((c) => c[1] + c[2]));
  const upper = (c: Cluster) => c[1] < top + (bottom - top) * 0.6;
  const deep = clusters.map(([x, y, r]) => circ(x, y, r)).join('');
  const base = clusters.map(([x, y, r]) => circ(x - r * 0.12, y - r * 0.14, r * 0.86)).join('');
  const light = simple ? '' : clusters.filter(upper).map(([x, y, r]) => circ(x - r * 0.2, y - r * 0.26, r * 0.6)).join('');
  return (
    <>
      {defs}
      <path d={deep} fill={tones.deep} />
      <path d={base} fill={tones.base} />
      {light && <path d={light} fill={tones.light} />}
      <path d={deep} fill={`url(#${id}-sheen)`} opacity={1 - haze} />
      <path d={deep} fill={`url(#${id}-under)`} opacity={1 - haze * 0.7} />
    </>
  );
}

/** A trunk (and limbs) in two tones: the lit left edge, the shaded right. Coordinates in a 100-tall tree. */
function Trunk({ d, lit, haze, to }: { d: string; lit: string; haze: number; to?: string }) {
  return (
    <>
      <path d={d} fill={hazed(mix(P.bark, P.ink, 0.22), haze, to)} />
      <path d={lit} fill={hazed(P.bark, haze, to)} />
    </>
  );
}

const OAK: Cluster[] = [
  [-26, -50, 16], [24, -50, 17], [-6, -46, 18], [-30, -66, 17], [30, -66, 16],
  [-14, -72, 22], [14, -70, 21], [-4, -88, 18], [18, -86, 14], [-22, -84, 13],
];
const OAK_FAR: Cluster[] = [[-17, -40, 20], [17, -42, 20], [0, -58, 25], [-4, -32, 17], [10, -30, 14]];
const JAC: Cluster[] = [
  [-44, -58, 13], [44, -58, 13], [-30, -66, 16], [30, -66, 16], [-12, -70, 18], [12, -70, 18],
  [-30, -78, 12], [24, -80, 13], [0, -84, 14], [-16, -86, 10],
];
const JAC_FAR: Cluster[] = [[-30, -56, 16], [30, -56, 16], [0, -66, 22], [-12, -76, 13], [14, -74, 12]];

function cypressPath(w: number, h: number, scallop: boolean, side: 'all' | 'left') {
  // a flame: widest a third of the way up, pointed top; scalloped edges where the foliage tufts stick out
  const pts: [number, number][] = [];
  const n = scallop ? 9 : 4;
  const width = (t: number) => w * Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + t * 0.92)), 0.8) * (1 - t * 0.35);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([-width(t) - (scallop && i % 2 ? w * 0.08 : 0), -h * (0.06 + t * 0.94)]);
  }
  const right: [number, number][] = [];
  for (let i = n; i >= 0; i--) {
    const t = i / n;
    const x = side === 'left' ? -width(t) * 0.05 + (scallop && i % 2 ? w * 0.12 : w * 0.02) : width(t) + (scallop && i % 2 ? w * 0.08 : 0);
    right.push([x, -h * (0.06 + t * 0.94)]);
  }
  const all = [...pts, ...right];
  // smooth through the points (quadratic midpoints)
  let d = `M${r1(all[0][0] * 0.4)} ${r1(-h * 0.04)}L${r1(all[0][0])} ${r1(all[0][1])}`;
  for (let i = 1; i < all.length; i++) {
    const [px, py] = all[i - 1];
    const [x, y] = all[i];
    d += `Q${r1(px)} ${r1(py)} ${r1((px + x) / 2)} ${r1((py + y) / 2)}`;
  }
  const last = all[all.length - 1];
  return `${d}L${r1(last[0] * 0.4)} ${r1(-h * 0.04)}Z`;
}

/**
 * One palm frond from the crown (0,0): a spine that arches out and droops toward its tip (`angle` in
 * degrees, 0 = right, 90 = down) and a smooth leaf tapering along it. Returns the leaf and its spine.
 */
function frond(angle: number, len: number, droop: number, detail: boolean) {
  const a = (angle * Math.PI) / 180;
  const tip = { x: Math.cos(a) * len, y: Math.sin(a) * len * 0.42 + droop * len };
  const ctl = { x: Math.cos(a) * len * 0.52, y: Math.sin(a) * len * 0.32 - len * 0.2 };
  const at = (t: number) => ({ x: 2 * (1 - t) * t * ctl.x + t * t * tip.x, y: 2 * (1 - t) * t * ctl.y + t * t * tip.y });
  const n = detail ? 12 : 7;
  const w = len * 0.13;
  const up: string[] = [];
  const dn: string[] = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const p = at(t);
    const q = at(Math.min(1, t + 0.02));
    const tx = q.x - p.x;
    const ty = q.y - p.y;
    const l = Math.hypot(tx, ty) || 1;
    const nx = -ty / l;
    const ny = tx / l;
    const prof = Math.pow(Math.sin(Math.PI * Math.min(1, 0.1 + t * 0.9)), 0.9) * w;
    up.push(`${r1(p.x + nx * prof)} ${r1(p.y + ny * prof)}`);
    dn.unshift(`${r1(p.x - nx * prof * 0.7)} ${r1(p.y - ny * prof * 0.7)}`);
  }
  return {
    leaf: `M0 0L${up.join('L')}L${r1(tip.x)} ${r1(tip.y)}L${dn.join('L')}Z`,
    spine: `M0 0Q${r1(ctl.x)} ${r1(ctl.y)} ${r1(tip.x * 0.94)} ${r1(tip.y * 0.94)}`,
  };
}
const fronds = (list: { a: number; len: number; droop: number }[], detail: boolean) => {
  const f = list.map((o) => frond(o.a, o.len, o.droop, detail));
  return { leaf: f.map((o) => o.leaf).join(''), spine: f.map((o) => o.spine).join('') };
};

/**
 * A tree of one of four species, drawn bottom-centre at (x, base) and `size` units tall:
 *  - 'oak': a forked trunk under a crown of leaf clusters (also stands in for sycamores and street trees)
 *  - 'jacaranda': a broad lavender umbrella on a branching trunk, a few fallen blossoms
 *  - 'cypress': a narrow flame with tufted edges
 *  - 'palm': a slim, leaning, ringed trunk with a crown of feathered fronds
 * `haze` (0–1) for distance toward `hazeTo` (default the day/night sky); small or hazy trees draw fewer
 * clusters. `lean` bends a palm (units at the crown; negative leans left). `shadow` scales the contact
 * shadow (0 hides it). `sway` makes the crown sway (the scene's one ambient loop; CSS .sc-amb.sc-sway).
 */
export const Tree = memo(function Tree({ species, x, base, size, haze = 0, hazeTo, lean, shadow = 1, sway = false, delay = 0 }: { species: TreeSpecies; x: number; base: number; size: number; haze?: number; hazeTo?: string; lean?: number; shadow?: number; sway?: boolean; delay?: number }) {
  const kit = useKitIds();
  const k = size / 100;
  const simple = size < 46 || haze > 0.45;
  // the crown sways about its own base (fill-box: no world coordinates needed)
  const swayProps = (origin: string) => (sway ? { className: 'sc-amb sc-sway', style: { transformOrigin: origin, transformBox: 'fill-box' as const, animationDelay: `${-delay}s` } } : {});
  let body: ReactNode;
  let shadowW = 34;
  if (species === 'oak' || species === 'jacaranda') {
    const jac = species === 'jacaranda';
    shadowW = jac ? 46 : 36;
    const trunk = jac
      ? { d: 'M-4 0L-3 -34L-24 -56L-20 -58L-1 -40L1 -60L5 -60L4 -40L22 -58L26 -55L4 -32L5 0Z', lit: 'M-4 0L-3 -34L-24 -56L-21.5 -57L-1 -38.5L1 -60L2.6 -60L1.4 -36L0.6 0Z' }
      : { d: 'M-5 0L-4 -30L-16 -50L-12 -52L0 -38L10 -54L14 -52L4 -30L5 0Z', lit: 'M-5 0L-4 -30L-16 -50L-13.5 -51.4L-0.6 -36L-0.4 0Z' };
    const clusters = jac ? (simple ? JAC_FAR : JAC) : simple ? OAK_FAR : OAK;
    body = (
      <>
        {/* fallen blossoms: a lavender carpet under the crown */}
        {jac && !simple && <ellipse cx={8} cy={1} rx={44} ry={4.5} fill={hazed(P.jacarandaLight, haze, hazeTo)} opacity={0.42} />}
        <Trunk d={trunk.d} lit={trunk.lit} haze={haze} to={hazeTo} />
        <g {...swayProps('50% 100%')}>
          <LeafMass clusters={clusters} tones={jac ? bloomTones(haze, hazeTo) : leafTones(haze, hazeTo)} simple={simple} haze={haze} />
        </g>
      </>
    );
  } else if (species === 'cypress') {
    shadowW = 16;
    const h = 100;
    const w = 11;
    body = (
      <>
        <rect x={-1.6} y={-8} width={3.2} height={8} fill={hazed(mix(P.bark, P.ink, 0.2), haze, hazeTo)} />
        <g {...swayProps('50% 100%')}>
          <path d={cypressPath(w, h, !simple, 'all')} fill={hazed(P.foliageDeep, haze, hazeTo)} />
          <path d={cypressPath(w * 0.9, h * 0.97, !simple, 'left')} fill={hazed(P.foliage, haze, hazeTo)} transform="translate(-0.6 0)" />
          <path d={cypressPath(w, h, !simple, 'all')} fill={`url(#${kit.id}-sheen)`} opacity={1 - haze} />
          <path d={cypressPath(w, h, !simple, 'all')} fill={`url(#${kit.id}-under)`} opacity={1 - haze * 0.7} />
        </g>
      </>
    );
  } else {
    // palm
    shadowW = 20;
    const lx = lean ?? 6;
    const cx = lx;
    const cy = -100;
    const trunk = `M-2.6 0Q${r1(lx * 0.2 - 2.4)} -50 ${r1(cx - 1.5)} ${cy}H${r1(cx + 1.5)}Q${r1(lx * 0.2 + 2.6)} -50 2.6 0Z`;
    const lit = `M-2.6 0Q${r1(lx * 0.2 - 2.4)} -50 ${r1(cx - 1.5)} ${cy}H${r1(cx - 0.2)}Q${r1(lx * 0.2 - 0.6)} -50 -0.4 0Z`;
    const rings = simple ? '' : Array.from({ length: 9 }, (_, i) => {
      const t = (i + 1) / 10;
      const px = 2 * (1 - t) * t * (lx * 0.2) + t * t * cx;
      const py = -100 * t;
      const hw = 2.6 - t * 1.1;
      return `M${r1(px - hw)} ${r1(py)}h${r1(hw * 2)}v0.7h${r1(-hw * 2)}Z`;
    }).join('');
    const len = 36;
    const detail = !simple;
    // back fronds reach up and away (deep tone), the side ones arch out and droop, the front ones fall toward us
    const back = fronds([224, 252, 288, 318, 202].map((a) => ({ a, len: len * 0.8, droop: 0.14 })), detail);
    const mid = fronds([184, 356, 220, 322].map((a) => ({ a, len, droop: 0.36 })), detail);
    const front = fronds([150, 30, 166, 14, 118, 62].map((a, i) => ({ a, len: len * (i < 4 ? 0.92 : 0.64), droop: i < 4 ? 0.5 : 0.56 })), detail);
    const dead = simple ? '' : fronds([98, 84].map((a) => ({ a, len: len * 0.4, droop: 0.3 })), false).leaf;
    body = (
      <>
        <path d={trunk} fill={hazed(mix(P.bark, P.ink, 0.22), haze, hazeTo)} />
        <path d={lit} fill={hazed(mix(P.bark, P.trim, 0.12), haze, hazeTo)} />
        {rings && <path d={rings} fill={hazed(mix(P.bark, P.ink, 0.35), haze, hazeTo)} opacity={0.5} />}
        <g transform={`translate(${r1(cx)} ${cy})`}>
          <g {...swayProps('50% 30%')}>
            {dead && <path d={dead} fill={hazed(mix(P.bark, P.timber, 0.4), haze, hazeTo)} />}
            <path d={back.leaf} fill={hazed(P.frondDeep, haze, hazeTo)} />
            <path d={circ(0, 1.5, 2.4)} fill={hazed(mix(P.bark, P.ink, 0.3), haze, hazeTo)} />
            <path d={mid.leaf} fill={hazed(P.frond, haze, hazeTo)} />
            {detail && <path d={mid.spine} fill="none" stroke={hazed(P.frondDeep, haze, hazeTo)} strokeWidth={0.7} opacity={0.6} />}
            <path d={front.leaf} fill={hazed(P.frondLight, haze, hazeTo)} />
            {detail && <path d={front.spine} fill="none" stroke={hazed(P.frond, haze, hazeTo)} strokeWidth={0.7} />}
          </g>
        </g>
      </>
    );
  }
  return (
    <g>
      {species === 'cypress' && kit.defs}
      {shadow > 0 && <ContactShadow cx={x + shadowW * 0.22 * k} cy={base} rx={shadowW * k} ry={shadowW * k * 0.2} strength={shadow * (1 - haze * 0.8)} />}
      <g transform={`translate(${r1(x)} ${r1(base)}) scale(${r1(k * 1000) / 1000})`}>{body}</g>
    </g>
  );
});

/**
 * A bush: a low mound of the same leaf clusters as the trees, `size` units wide, bottom-centre at
 * (x, base). `bloom` sprinkles flowers in that colour (a palette colour). `haze` as for Tree.
 */
export const Bush = memo(function Bush({ x, base, size, bloom, haze = 0, hazeTo, seed = 3, shadow = 1 }: { x: number; base: number; size: number; bloom?: string; haze?: number; hazeTo?: string; seed?: number; shadow?: number }) {
  const k = size / 100;
  const r = seeded(seed * 97 + 11);
  const simple = size < 30;
  const clusters: Cluster[] = simple
    ? [[-22, -20, 22], [20, -18, 22], [0, -30, 26]]
    : [[-36, -16, 16], [34, -15, 17], [-16, -26, 22], [16, -26, 22], [0, -36, 20], [-30, -32, 13], [28, -34, 12]].map(([cx, cy, cr]) => [cx + (r() - 0.5) * 6, cy + (r() - 0.5) * 4, cr] as Cluster);
  const flowers = bloom && !simple ? Array.from({ length: 9 }, () => circ(-34 + r() * 60, -44 + r() * 28, 2.4)).join('') : '';
  return (
    <g>
      {shadow > 0 && <ContactShadow cx={x + size * 0.08} cy={base} rx={size * 0.6} ry={size * 0.09} strength={shadow * (1 - haze * 0.8)} />}
      <g transform={`translate(${r1(x)} ${r1(base)}) scale(${r1(k * 1000) / 1000})`}>
        <LeafMass clusters={clusters} tones={leafTones(haze, hazeTo)} simple={simple} haze={haze} />
        {flowers && <path d={flowers} fill={hazed(bloom!, haze, hazeTo)} />}
      </g>
    </g>
  );
});

/* ------------------------------------------------------------------ */
/* Terrain                                                             */
/* ------------------------------------------------------------------ */

/**
 * One terrain layer for Hills. `y` is the crest line's mean height; `amp` how much it rolls; `waves` how
 * many humps across the span; `seed` varies the shape; `haze` pushes it toward the sky (far layers);
 * `tones` overrides [lit crest, body, shade] (defaults: meadow → sage → sageDark). `points` places the crest
 * exactly instead (x, y pairs left to right; a smooth curve runs through them).
 */
export type HillLayer = { y: number; amp?: number; waves?: number; seed?: number; haze?: number; tones?: [string, string, string]; points?: [number, number][] };

/** A smooth curve (Catmull-Rom as cubic segments) through points, left to right. */
export function smoothPath(pts: { x: number; y: number }[]) {
  let d = `M${r1(pts[0].x)} ${r1(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += `C${r1(p1.x + (p2.x - p0.x) / 6)} ${r1(p1.y + (p2.y - p0.y) / 6)} ${r1(p2.x - (p3.x - p1.x) / 6)} ${r1(p2.y - (p3.y - p1.y) / 6)} ${r1(p2.x)} ${r1(p2.y)}`;
  }
  return d;
}

/** A smooth crest through (x0…x1) as cubic segments (Catmull-Rom through seeded points). */
export function crestPath(x0: number, x1: number, y: number, amp: number, waves: number, seed: number) {
  const r = seeded(seed * 131 + 7);
  const n = Math.max(2, Math.round(waves * 2));
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const wave = Math.sin(t * Math.PI * waves + r() * 1.2) * 0.7 + (r() - 0.5) * 0.6;
    return { x: x0 + (x1 - x0) * t, y: y - wave * amp };
  });
  return smoothPath(pts);
}

/**
 * Smooth, layered terrain from back to front: each layer is a rolling crest filled down to `bottom` with a
 * vertical gradient (lit crest to deeper body) over a shade tone that shows on the right-hand flanks
 * (the light is top-left). Far layers take `haze` toward `hazeTo`. Spans x0…x1.
 */
export const Hills = memo(function Hills({ x0, x1, bottom, layers, hazeTo }: { x0: number; x1: number; bottom: number; layers: HillLayer[]; hazeTo?: string }) {
  const id = `hl${useId().replace(/[:«»]/g, '')}`;
  return (
    <g>
      <defs>
        {layers.map((l, i) => {
          const [lit, body] = l.tones ?? [P.meadow, P.sage, P.sageDark];
          const h = l.haze ?? 0;
          return (
            <linearGradient key={i} id={`${id}-${i}`} x1={0} y1={l.y - (l.amp ?? 30)} x2={0} y2={Math.min(bottom, l.y + 260)} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={hazed(lit, h, hazeTo)} />
              <stop offset="0.35" stopColor={hazed(mix(lit, body, 0.6), h, hazeTo)} />
              <stop offset="1" stopColor={hazed(body, h, hazeTo)} />
            </linearGradient>
          );
        })}
      </defs>
      {layers.map((l, i) => {
        const amp = l.amp ?? 30;
        const waves = l.waves ?? 3;
        const seed = l.seed ?? i + 1;
        const [, , shade] = l.tones ?? [P.meadow, P.sage, P.sageDark];
        const h = l.haze ?? 0;
        const span = (x1 - x0) / waves;
        const shift = span * 0.08;
        const crest = l.points ? smoothPath(l.points.map(([px, py]) => ({ x: px, y: py }))) : crestPath(x0 - shift, x1 + shift, l.y, amp, waves, seed);
        const xr = l.points ? l.points[l.points.length - 1][0] : x1 + shift;
        const xl = l.points ? l.points[0][0] : x0 - shift;
        const close = `L${xr} ${bottom}H${xl}Z`;
        return (
          <g key={i}>
            {/* the shade tone (shows on the right flanks), then the lit body nudged left over it */}
            <path d={crest + close} fill={hazed(shade, h, hazeTo)} />
            <path d={crest + close} fill={`url(#${id}-${i})`} transform={`translate(${r1(-shift)} 0)`} />
          </g>
        );
      })}
    </g>
  );
});

/**
 * A flat stretch of ground (lawn, a yard) from its far edge `y` down to `bottom`: a vertical gradient from a
 * hazier far edge to a richer near edge. `tones` = [far, near]; `haze` for the far edge.
 */
export function Ground({ x0, x1, y, bottom, tones, haze = 0.15, hazeTo, edge }: { x0: number; x1: number; y: number; bottom: number; tones?: [string, string]; haze?: number; hazeTo?: string; /** an optional crest path (from crestPath) instead of a straight far edge */ edge?: string }) {
  const id = `gd${useId().replace(/[:«»]/g, '')}`;
  const [far, near] = tones ?? [P.sageLight, P.sage];
  return (
    <g>
      <defs>
        <linearGradient id={id} x1={0} y1={y} x2={0} y2={bottom} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={hazed(far, haze, hazeTo)} />
          <stop offset="1" stopColor={near} />
        </linearGradient>
      </defs>
      <path d={`${edge ?? `M${x0} ${y}H${x1}`}L${x1} ${bottom}H${x0}Z`} fill={`url(#${id})`} />
    </g>
  );
}

/**
 * A walking path laid on the ground: a ribbon through `points` (far to near, each with its width), in a lit
 * top tone with a darker edge peeking out bottom-right (its thickness and the occlusion along it).
 */
export function GroundPath({ points, tone = P.stone, edge = P.stoneShade }: { points: { x: number; y: number; w: number }[]; tone?: string; edge?: string }) {
  const left = points.map((p) => `${r1(p.x - p.w / 2)} ${r1(p.y)}`);
  const right = points.map((p) => `${r1(p.x + p.w / 2)} ${r1(p.y)}`).reverse();
  const d = `M${left.join('L')}L${right.join('L')}Z`;
  return (
    <g>
      <path d={d} fill={edge} transform="translate(2 3)" />
      <path d={d} fill={tone} />
    </g>
  );
}

/**
 * A soft cumulus `w` units wide, bottom-centre at (x, base): a shaded base, lit puffs nudged up-left, and a
 * bright rim on the top-left. Takes the night palette by itself (moonlit). `haze` toward `hazeTo`.
 */
export const Cloud = memo(function Cloud({ x, base, w, haze = 0, hazeTo }: { x: number; base: number; w: number; haze?: number; hazeTo?: string }) {
  const id = `cl${useId().replace(/[:«»]/g, '')}`;
  const k = w / 200;
  const puffs: Cluster[] = [[-64, -16, 20], [-34, -30, 30], [6, -40, 38], [46, -28, 28], [76, -14, 18]];
  const body = puffs.map(([cx, cy, r]) => circ(cx, cy, r)).join('') + 'M-84 -2Q-86 -14 -70 -16H86Q98 -12 94 -2Q60 2 0 2Q-50 2 -84 -2Z';
  const lit = puffs.map(([cx, cy, r]) => circ(cx - r * 0.14, cy - r * 0.18, r * 0.84)).join('');
  return (
    <g transform={`translate(${r1(x)} ${r1(base)}) scale(${r1(k * 1000) / 1000})`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0.3" stopColor={hazed(P.cloud, haze, hazeTo)} />
          <stop offset="1" stopColor={hazed(P.cloudShade, haze, hazeTo)} />
        </linearGradient>
      </defs>
      <path d={body} fill={`url(#${id})`} />
      <path d={lit} fill={hazed(P.cloud, haze, hazeTo)} opacity={0.7} />
      <path d={lit} fill={hazed(P.cloudLight, haze, hazeTo)} opacity={0.35} transform="translate(-4 -4)" />
    </g>
  );
});
