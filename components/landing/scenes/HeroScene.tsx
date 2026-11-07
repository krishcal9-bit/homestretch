'use client';
import Image from 'next/image';
import { memo, useMemo, type ReactNode } from 'react';
import { P, mix } from '@/lib/illustrationPalette';
import { Layer, SceneRoot } from './Scene';
import { CloudShape, StreetLamp, nightStyle } from './parts';
import { RoadStreetContext, roadTrackY } from '@/components/result/Road';
import STILLS from '@/public/house/street-stills.json';

/**
 * Hero: a residential street at late afternoon (at night under the dark theme). One stage, edge to edge:
 * the sky (where the headline and the two doors sit), distant hills and rooftops, then the street — front
 * lawns, the sidewalk, a grass verge, the curb and the asphalt — with a row of different homes running off
 * both edges: a ranch, a townhome pair, a Dutch colonial, a front-gable cottage, a foursquare, with trees
 * between them, some behind the houses and some on the front lawns. The family's house is the live 3D one
 * (components/three/HeroHouse.tsx) in the middle, a little nearer and larger; its neighbours are stills of
 * the same parametric model (components/three/houseModel.tsx HOUSE_VARIANTS) under the same camera and light
 * (scripts/render-street.ts), set back by depth. The Road runs along the sidewalk into the family's front
 * path; its labels are plates standing on the verge below it (the Road's plates mode, set by context here).
 *
 * Geometry is in CSS px from one layout (streetLayout), shared by the drawing, the neighbours and the Road,
 * so the line, the path and the houses can't drift apart at any size. Layers move at their own speeds when
 * the camera changes section (Scene.tsx): far 0.6, the street 1, the foreground hedge 1.15.
 */

/** Where the family's front path meets the sidewalk, as a share of its slot's width (projected, STREET_FRAME). */
const PATH_X = 0.427;
const AY = 0.935;

/**
 * The street's stills (public/house/street-stills.json, written by scripts/render-street.ts): every one is
 * rendered with the live house's camera at 560px for the frame's height, so a model unit is the same size in
 * all of them; `ay` is the sidewalk line inside each still, `family` the live house's drawing in its slot.
 */
type StillName = keyof typeof STILLS.stills;

/**
 * The street, outward from the family's house: each home, its depth (k: 1 = the family's lot line; smaller
 * sits further back), the gap before it (render px; negative overlaps the previous lot's shadow and air), and
 * the tree standing where it meets the next lot: behind the houses (smaller, further back) or on the front
 * lawns (dy: render px down from the lot line; negative is further back; dx: along the street, outward).
 */
type Tree = { name: Extract<StillName, 'tree' | 'trees'>; k: number; layer: 'back' | 'front'; dy: number; dx?: number };
type Lot = { name: Exclude<StillName, 'tree' | 'trees'>; k: number; gap: number; tree?: Tree };
const RIGHT: Lot[] = [
  { name: 'townhomes', k: 0.86, gap: -30, tree: { name: 'tree', k: 0.8, layer: 'back', dy: -34 } },
  { name: 'foursquare', k: 0.84, gap: -40, tree: { name: 'trees', k: 0.92, layer: 'front', dy: 14, dx: 6 } },
  { name: 'ranch', k: 0.8, gap: -10 },
  { name: 'colonial', k: 0.84, gap: -50, tree: { name: 'tree', k: 0.84, layer: 'back', dy: -28 } },
  { name: 'cottage', k: 0.86, gap: -40, tree: { name: 'trees', k: 0.82, layer: 'back', dy: -30 } },
];
const LEFT: Lot[] = [
  { name: 'cottage', k: 0.88, gap: -40, tree: { name: 'trees', k: 0.82, layer: 'back', dy: -30 } },
  { name: 'colonial', k: 0.84, gap: -50, tree: { name: 'tree', k: 0.98, layer: 'front', dy: 16, dx: -4 } },
  { name: 'ranch', k: 0.8, gap: -20, tree: { name: 'trees', k: 0.8, layer: 'back', dy: -32 } },
  { name: 'foursquare', k: 0.84, gap: -10, tree: { name: 'tree', k: 0.82, layer: 'back', dy: -28 } },
  { name: 'townhomes', k: 0.84, gap: -40 },
];

/** A still placed on the street (px inside the street block). */
export type Placed = { name: StillName; left: number; top: number; w: number; h: number; layer: 'back' | 'house' | 'front' };

export type StreetLayout = {
  W: number;
  phone: boolean;
  /** a house slot's width and height (5:4) */
  sw: number;
  sh: number;
  /** the street block's height (from the houses' tops to the section's bottom) */
  height: number;
  /**
   * Inside the block, top to bottom: the lawns end at walkTop; the sidewalk (`walk` deep, the Road's line
   * along its middle at roadY); the verge (`verge` deep: the Road's label plates stand on it); the curb at
   * curbY; then the asphalt (deep enough that the section's down arrow sits on it, clear of the plates).
   */
  roadY: number;
  walkTop: number;
  walk: number;
  verge: number;
  curbY: number;
  /** the family's house slot */
  slotLeft: number;
  slotTop: number;
  /** the Road's box: from L, `roadW` wide; its keys end lands on the house's path */
  L: number;
  roadW: number;
  /** the Road's own track offset inside its box (so the track lands on roadY) */
  trackY: number;
  /** the neighbours and the street trees, in paint order (trees behind, houses left to right, trees in front) */
  lots: Placed[];
  lamps: number[];
};

const clamp = (lo: number, v: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * The street, laid out for a section `W` wide in a window `vh` tall. `Xc`: where the family's house should
 * stand (the middle of the doors column on desktop).
 */
export function streetLayout(W: number, vh: number, Xc?: number): StreetLayout {
  const phone = W < 640;
  const avail = vh - 64;
  const sw = Math.round(phone ? clamp(228, Math.min(W * 0.62, avail * 0.33), 280) : clamp(260, Math.min(W * 0.27, avail * 0.44), 420));
  const sh = Math.round(sw * 0.8);
  const walk = phone ? 22 : 28;
  const verge = phone ? 34 : 38;
  const asphalt = phone ? 64 : Math.round(clamp(76, avail * 0.1, 96));
  const roadY = Math.round(sh * AY);
  const walkTop = roadY - walk / 2;
  const curbY = walkTop + walk + verge;
  const height = curbY + 6 + asphalt;
  const cx = Xc ?? (phone ? W / 2 : W * (W < 1024 ? 0.62 : 0.68));
  const slotLeft = Math.round(cx - sw / 2);
  const slotTop = 0;
  const L = phone ? 20 : W >= 1280 ? Math.round((W - 1280) / 2 + 32) : 32;
  // the Road's keys end is at L + roadW − sw + ax − 4 (components/result/Road.tsx, slot reserve)
  const ax = Math.round(PATH_X * sw);
  const keysX = slotLeft + ax;
  const roadW = keysX - L + sw - ax + 4;

  // the neighbours: packed outward from the family's drawing, each at its depth, until past both edges
  const s0 = sh / STILLS.h; // px per render px at the family's depth
  const famL = slotLeft + STILLS.family.l * sw;
  const famR = slotLeft + STILLS.family.r * sw;
  const place = (name: StillName, k: number, left: number, dy: number, layer: Placed['layer']): Placed => {
    const st = STILLS.stills[name];
    const s = s0 * k;
    return { name, left: Math.round(left), top: Math.round(walkTop + 1 + dy * s0 - st.ay * s), w: Math.round(st.w * s), h: Math.round(st.h * s), layer };
  };
  // a tree's crown (its still's centre line) stands at x
  const tree = (t: Tree, x: number) => place(t.name, t.k, x - STILLS.stills[t.name].cx * s0 * t.k, t.dy, t.layer);
  const right: Placed[] = [];
  for (let i = 0, x = famR; x < W + 8; i++) {
    const lot = RIGHT[i % RIGHT.length];
    const p = place(lot.name, lot.k, x + lot.gap * s0, 0, 'house');
    right.push(p);
    x = p.left + p.w;
    // the next lot starts at x + its gap: the tree stands in the middle of that seam
    const next = RIGHT[(i + 1) % RIGHT.length];
    if (lot.tree) right.push(tree(lot.tree, x + (next.gap * s0) / 2 - 18 * s0 + (lot.tree.dx ?? 0) * s0));
  }
  const left: Placed[] = [];
  for (let i = 0, x = famL; x > -8; i++) {
    const lot = LEFT[i % LEFT.length];
    const p = place(lot.name, lot.k, x - lot.gap * s0 - STILLS.stills[lot.name].w * s0 * lot.k, 0, 'house');
    left.push(p);
    // the seam to its left: between the next lot's right edge (x − its gap) and this lot's left
    const next = LEFT[(i + 1) % LEFT.length];
    if (lot.tree) left.push(tree(lot.tree, p.left - (next.gap * s0) / 2 + 22 * s0 + (lot.tree.dx ?? 0) * s0));
    x = p.left;
  }
  // left to right, so each still's shadow (falling right) tucks under the next; trees behind first, front last
  const row = [...left.reverse(), ...right].sort((a, b) => a.left - b.left);
  const depth = { back: 0, house: 1, front: 2 } as const;
  const lots = row
    .map((p, i) => ({ p, i }))
    .sort((a, b) => depth[a.p.layer] - depth[b.p.layer] || a.i - b.i)
    .map((x) => x.p);

  // street lamps at the lawn's edge where two homes meet (never in front of the family's), 3–6 of them
  const houses = row.filter((p) => p.layer === 'house');
  const lampXs: number[] = [];
  for (let i = 0; i + 1 < houses.length; i++) {
    const a = houses[i];
    const b = houses[i + 1];
    if (a.left + a.w <= famL + 1 && b.left >= famR - 30) continue; // the family's house is between these two
    const x = Math.round((a.left + a.w + b.left) / 2);
    // not over the family's house, nor over the Road's start (Today's puck)
    if (x < 8 || x > W - 8 || (x > famL - 12 && x < famR) || (x > L - 12 && x < L + 64)) continue;
    lampXs.push(x);
  }
  const lamps = lampXs.length > 6 ? lampXs.filter((_, i) => i % 2 === 0) : lampXs;
  const trackY = roadTrackY(phone ? 'md' : 'lg', 'street', roadW, sw);
  return { W, phone, sw, sh, height, roadY, walkTop, walk, verge, curbY, slotLeft, slotTop, L, roadW, trackY, lots, lamps };
}

/** The hero's sky: pale behind the date (the brass reads on it), warming toward the horizon. */
const HERO_SKY = `linear-gradient(180deg, ${P.skyTop} 0%, ${mix(P.skyTop, P.skyBottom, 0.7)} 26%, ${P.skyBottom} 48%, ${mix(P.skyBottom, P.goldBottom, 0.7)} 74%, ${mix(P.goldBottom, P.goldTop, 0.5)} 100%)`;

function SkyArt() {
  const stars: [number, number, number][] = [
    [8, 9, 1], [17, 4, 1.3], [29, 12, 0.9], [41, 6, 1.1], [52, 14, 0.8], [58, 5, 1.2], [66, 10, 0.9], [74, 3, 1], [83, 13, 1.2], [91, 7, 0.9], [96, 16, 0.8], [35, 20, 0.8],
  ];
  return (
    <div className="pointer-events-none absolute inset-0 select-none [container-type:size]" aria-hidden>
      {/* day: the bright haze of an afternoon sky where the ready date sits, so the brass keeps its contrast */}
      <div className="il-day absolute inset-0">
        <div
          className="absolute left-1/2 top-[54%] h-[36%] w-[120%] -translate-x-1/2 -translate-y-1/2 lg:left-[68%] lg:top-[30%] lg:h-[44%] lg:w-[64%]"
          style={{ background: `radial-gradient(closest-side, ${P.trim} 0%, ${P.trim} 55%, transparent 100%)`, opacity: 0.92 }}
        />
      </div>
      {stars.map(([x, y, r], i) => (
        <span key={i} className="sc-light absolute block rounded-full" style={{ ...nightStyle(0.15 + i * 0.04), left: `${x}cqw`, top: `${y}cqh`, width: r * 2, height: r * 2, background: P.trim }} />
      ))}
      {/* the moon: scenery, not a control (the header's toggle is the only theme switch). A crescent in a soft
          glow that fades out to nothing (no ring that could read as a button), lower than the header. */}
      <svg viewBox="0 0 80 80" className="sc-light pointer-events-none absolute right-[8cqw] top-[15cqh] w-[clamp(52px,5cqw,80px)]" style={nightStyle(0.05)} aria-hidden focusable="false">
        <defs>
          <radialGradient id="hs-moon-glow">
            <stop offset="0.3" stopColor={P.glow} stopOpacity={0.22} />
            <stop offset="1" stopColor={P.glow} stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle cx={40} cy={40} r={40} fill="url(#hs-moon-glow)" />
        <path d="M46 24a17 17 0 1 0 12 27a14 14 0 1 1 -12 -27Z" fill={P.honeyLight} />
      </svg>
    </div>
  );
}

/** Two drifting clouds, kept clear of the headline (day; the dark theme hides them). */
const Clouds = memo(function Clouds({ phone }: { phone: boolean }) {
  return (
    <div className="il-day absolute inset-0 transition-opacity duration-500" aria-hidden>
      <div className="absolute left-[44%] top-[3%] w-[clamp(110px,11vw,190px)]">
        <svg viewBox="0 0 200 84" className="sc-amb sc-drift block h-auto w-full">
          <CloudShape />
        </svg>
      </div>
      {!phone && (
        <div className="absolute right-[-3%] top-[13%] w-[clamp(140px,14vw,250px)] opacity-90">
          <svg viewBox="0 0 200 84" className="sc-amb sc-drift block h-auto w-full" style={{ animationDelay: '-14s' }}>
            <CloudShape />
          </svg>
        </div>
      )}
    </div>
  );
});

/** Distant hills and rooftops, hazed into the sky, just above the lawns. */
const Far = memo(function Far({ W, top }: { W: number; top: number }) {
  const haze = (c: string, k: number) => mix(c, P.skyBottom, k);
  const roofs: [number, number, number][] = [];
  for (let x = -20, i = 0; x < W + 40; x += 58 + ((i * 37) % 41), i++) roofs.push([x, 22 + ((i * 13) % 12), 40 + ((i * 29) % 26)]);
  return (
    <svg className="absolute left-0 overflow-visible" width={W} height={120} viewBox={`0 0 ${W} 120`} style={{ top: top - 96 }} aria-hidden>
      <path d={`M0 70 C ${W * 0.18} 30 ${W * 0.32} 44 ${W * 0.5} 58 S ${W * 0.82} 26 ${W} 52 V120 H0Z`} fill={haze(P.sageDark, 0.62)} />
      <path d={`M0 92 C ${W * 0.22} 70 ${W * 0.4} 84 ${W * 0.62} 80 S ${W * 0.9} 64 ${W} 78 V120 H0Z`} fill={haze(P.sage, 0.45)} />
      {roofs.map(([x, h, w], i) => (
        <g key={i} transform={`translate(${x} ${120 - h - 8})`}>
          <rect x={0} y={h * 0.45} width={w} height={h * 0.55 + 8} fill={haze(P.wallShade, 0.5)} />
          <path d={`M-3 ${h * 0.48} L${w / 2} 0 L${w + 3} ${h * 0.48}Z`} fill={haze(P.slate, 0.55)} />
          <rect className="sc-light" x={w * 0.3} y={h * 0.62} width={w * 0.14} height={h * 0.18} fill={P.honey} style={nightStyle(0.3 + (i % 5) * 0.08)} />
        </g>
      ))}
    </svg>
  );
});

/** Lawns, the sidewalk (the Road runs along it), the verge (its label plates stand there), the curb, the street. */
const StreetArt = memo(function StreetArt({ layout }: { layout: StreetLayout }) {
  const { W, height, walkTop, walk, verge, curbY, sh, slotTop, phone } = layout;
  const lawnTop = slotTop + sh * 0.6;
  const vergeTop = walkTop + walk;
  const dash = phone ? 26 : 40;
  const street = curbY + 6;
  return (
    <svg className="absolute inset-0 overflow-visible" width={W} height={height} viewBox={`0 0 ${W} ${height}`} aria-hidden>
      <defs>
        <linearGradient id="hs-lawn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(P.sageDark, P.skyBottom, 0.25)} />
          <stop offset="0.35" stopColor={P.sage} />
          <stop offset="1" stopColor={mix(P.sage, P.sageLight, 0.4)} />
        </linearGradient>
        <linearGradient id="hs-road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.asphalt} />
          <stop offset="1" stopColor={mix(P.asphalt, P.asphaltLight, 0.6)} />
        </linearGradient>
      </defs>
      {/* back hedges between the houses, then the lawns */}
      <path
        d={`M-10 ${lawnTop + 6} ${Array.from({ length: Math.ceil(W / 46) + 2 }, (_, i) => `Q ${i * 46 + 23 - 10} ${lawnTop - 14 - (i % 3) * 4} ${i * 46 + 36} ${lawnTop + 4}`).join(' ')} V${walkTop} H-10Z`}
        fill={mix(P.treeDark, P.skyBottom, 0.38)}
      />
      <rect x={-10} y={lawnTop} width={W + 20} height={walkTop - lawnTop} fill="url(#hs-lawn)" />
      {/* the sidewalk (the Road runs along it) and its joints */}
      <rect x={-10} y={walkTop} width={W + 20} height={walk} fill={P.stone} />
      <rect x={-10} y={walkTop} width={W + 20} height={1.5} fill={P.stoneShade} />
      {Array.from({ length: Math.ceil(W / 64) + 1 }, (_, i) => (
        <rect key={i} x={i * 64 - 2} y={walkTop + 2} width={1} height={walk - 4} fill={P.stoneShade} opacity={0.7} />
      ))}
      {/* the verge between the sidewalk and the curb: a strip of grass where the Road's plates stand */}
      <rect x={-10} y={vergeTop} width={W + 20} height={verge} fill={mix(P.sage, P.sageDark, 0.55)} />
      <rect x={-10} y={vergeTop} width={W + 20} height={2} fill={mix(P.sageDark, P.ink, 0.12)} opacity={0.5} />
      {/* the curb, then the street with its centre line */}
      <rect x={-10} y={curbY} width={W + 20} height={3} fill={mix(P.stone, P.trim, 0.4)} />
      <rect x={-10} y={curbY + 3} width={W + 20} height={3} fill={P.stoneShade} />
      <rect x={-10} y={street} width={W + 20} height={height - street} fill="url(#hs-road)" />
      {Array.from({ length: Math.ceil(W / (dash * 2)) + 1 }, (_, i) => (
        <rect key={i} x={i * dash * 2 - dash / 2} y={street + (height - street) * 0.62} width={dash} height={3} rx={1.5} fill={P.trim} opacity={0.55} />
      ))}
    </svg>
  );
});

/** The neighbours and the street trees: stills of the parametric 3D model (day and night), placed by depth. */
const Neighbours = memo(function Neighbours({ layout }: { layout: StreetLayout }) {
  return (
    <>
      {layout.lots.map((l) => (
        <div key={`${l.name}-${l.left}`} className="pointer-events-none absolute select-none" style={{ left: l.left, top: l.top, width: l.w, height: l.h }} aria-hidden>
          <Image unoptimized src={`/house/street-${l.name}.webp`} alt="" width={l.w} height={l.h} className="still-day absolute inset-0 h-full w-full" draggable={false} priority={l.layer === 'house'} />
          <Image unoptimized src={`/house/street-${l.name}-night.webp`} alt="" width={l.w} height={l.h} className="still-night absolute inset-0 h-full w-full" draggable={false} loading="lazy" />
        </div>
      ))}
    </>
  );
});

/** Street lamps at the lawn's edge, numbered left to right (the night stagger runs along the street). */
const Lamps = memo(function Lamps({ layout }: { layout: StreetLayout }) {
  const { W, height, walkTop, sw, lamps } = layout;
  const h = Math.round(sw * 0.36);
  return (
    <svg className="pointer-events-none absolute inset-0 overflow-visible" width={W} height={height} viewBox={`0 0 ${W} ${height}`} aria-hidden>
      {lamps.map((x, i) => (
        <StreetLamp key={x} x={x} base={walkTop + 1} h={h} i={i} pool={1.5} />
      ))}
    </svg>
  );
});

/** The near side of the street: a low hedge on the near sidewalk, cut by both edges (the foreground). */
const Foreground = memo(function Foreground({ W, phone }: { W: number; phone: boolean }) {
  const r = phone ? 16 : 24;
  const bush = (x: number, k: number) => (
    <g key={x}>
      <ellipse cx={x} cy={r * 1.2} rx={r * 1.25 * k} ry={r * k} fill={P.treeDark} />
      <ellipse cx={x - r * 0.3 * k} cy={r * 1.05} rx={r * 0.8 * k} ry={r * 0.7 * k} fill={P.tree} />
      <ellipse cx={x - r * 0.45 * k} cy={r * 0.9} rx={r * 0.35 * k} ry={r * 0.28 * k} fill={P.treeLight} opacity={0.8} />
    </g>
  );
  return (
    <svg className="absolute bottom-0 left-0 overflow-visible" width={W} height={r * 1.4} viewBox={`0 0 ${W} ${r * 1.4}`} style={{ bottom: -r * 0.55 }} aria-hidden>
      {[bush(-r * 0.2, 1.1), bush(r * 1.6, 0.85), bush(W + r * 0.1, 1.15), bush(W - r * 1.7, 0.8)]}
    </svg>
  );
});

/**
 * The scene. `road` is the live Road (with the 3D house in its slot), placed on the sidewalk by `layout`;
 * until the layout is measured (first client paint) only the sky renders. The Road learns here that it is
 * on the street: its labels become plates on the verge (RoadStreetContext).
 */
export const HeroScene = memo(function HeroScene({ layout, road }: { layout: StreetLayout | null; road: ReactNode }) {
  const plates = useMemo(() => (layout ? { y: layout.walk / 2 + layout.verge / 2, room: Math.max(0, layout.W - layout.L - layout.roadW - 12) } : null), [layout]);
  return (
    <SceneRoot index={0} sky={HERO_SKY} skyArt={<SkyArt />} testId="hero-scene" interactive>
      <Layer speed={0.4}>
        <Clouds phone={!!layout?.phone} />
      </Layer>
      {layout && (
        <>
          <Layer speed={0.6}>
            <div className="absolute inset-x-0 bottom-0" style={{ height: layout.height }}>
              <Far W={layout.W} top={layout.slotTop + layout.sh * 0.6} />
            </div>
          </Layer>
          <Layer speed={1}>
            <div className="absolute inset-x-0 bottom-0" style={{ height: layout.height }} data-testid="hero-street">
              <StreetArt layout={layout} />
              <Neighbours layout={layout} />
              <Lamps layout={layout} />
              {/* the Road along the sidewalk, ending in the family's front path; it takes input */}
              <div className="pointer-events-auto absolute" style={{ left: layout.L, width: layout.roadW, top: layout.roadY - layout.trackY }} data-road-anchor>
                <RoadStreetContext.Provider value={plates}>{road}</RoadStreetContext.Provider>
              </div>
            </div>
          </Layer>
          <Layer speed={1.15}>
            <Foreground W={layout.W} phone={layout.phone} />
          </Layer>
        </>
      )}
    </SceneRoot>
  );
});
