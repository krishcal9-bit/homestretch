'use client';
import Image from 'next/image';
import { memo, type ReactNode } from 'react';
import { P, mix } from '@/lib/illustrationPalette';
import { Layer, SceneRoot } from './Scene';
import { CloudShape, StreetLamp, nightStyle } from './parts';
import { roadTrackY } from '@/components/result/Road';

/**
 * Hero: a residential street at late afternoon (at night under the dark theme). One stage, edge to edge:
 * the sky (where the headline, the ready date and the slider sit), distant hills and rooftops, then the
 * street — front lawns behind a picket fence, the sidewalk, the curb and the asphalt — with a row of houses
 * running off both edges. The family's house is the live 3D one (components/three/HeroHouse.tsx) standing
 * among its neighbours (stills of the same model, same camera and light: scripts/render-street.ts). The Road
 * demo is painted along the sidewalk and runs into that house's front path (the Road's 'street' slot).
 *
 * Geometry is in CSS px from one layout (streetLayout), shared by the drawing, the neighbours and the Road,
 * so the line, the path and the houses can't drift apart at any size. Layers move at their own speeds when
 * the camera changes section (Scene.tsx): far 0.6, the street 1, the foreground hedge 1.15.
 */

/** Where the family's front path meets the sidewalk, as a share of its slot's width (projected, STREET_FRAME). */
const PATH_X = 0.427;
const AY = 0.935;

export type StreetLayout = {
  W: number;
  phone: boolean;
  /** a house slot's width and height (5:4) */
  sw: number;
  sh: number;
  /** the street block's height (from the houses' tops to the section's bottom) */
  height: number;
  /** inside the block: the Road's line (the sidewalk's middle), the sidewalk's depth, the curb's top */
  roadY: number;
  walk: number;
  curbY: number;
  /** the family's house slot */
  slotLeft: number;
  slotTop: number;
  /** the Road's box: from L, `roadW` wide; its keys end lands on the house's path */
  L: number;
  roadW: number;
  /** the Road's own track offset inside its box (so the track lands on roadY) */
  trackY: number;
  /** neighbours: [left, variant] */
  lots: { left: number; variant: number }[];
  lamps: number[];
};

const clamp = (lo: number, v: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * The street, laid out for a section `W` wide in a window `vh` tall. `Xc`: where the family's house should
 * stand (the middle of the ready-date column on desktop).
 */
export function streetLayout(W: number, vh: number, Xc?: number): StreetLayout {
  const phone = W < 640;
  const avail = vh - 64;
  const sw = Math.round(phone ? clamp(228, Math.min(W * 0.68, avail * 0.36), 300) : clamp(260, Math.min(W * 0.27, avail * 0.44), 420));
  const sh = Math.round(sw * 0.8);
  const walk = phone ? 22 : 30;
  const asphalt = phone ? 40 : Math.round(clamp(70, avail * 0.1, 96));
  const above = Math.round(sh * AY);
  const height = above + walk / 2 + asphalt + 8;
  const roadY = height - asphalt - walk / 2;
  const curbY = roadY + walk / 2;
  const cx = Xc ?? (phone ? W / 2 : W * (W < 1024 ? 0.62 : 0.68));
  const slotLeft = Math.round(cx - sw / 2);
  const slotTop = roadY - above;
  const L = phone ? 20 : W >= 1280 ? Math.round((W - 1280) / 2 + 32) : 32;
  // the Road's keys end is at L + roadW − sw + ax − 4 (components/result/Road.tsx, slot reserve)
  const ax = Math.round(PATH_X * sw);
  const keysX = slotLeft + ax;
  const roadW = keysX - L + sw - ax + 4;
  // neighbours every 0.82 slots, off both edges
  const step = Math.round(sw * 0.82);
  const order = [2, 1, 3];
  const lots: { left: number; variant: number }[] = [];
  for (let k = 1; slotLeft - k * step + sw > -8; k++) lots.push({ left: slotLeft - k * step, variant: order[(k + 1) % 3] });
  for (let k = 1; slotLeft + k * step < W + 8; k++) lots.push({ left: slotLeft + k * step, variant: order[k % 3] });
  // street lamps on the curb between the lots (never in front of the family's path), 3–6 of them
  const lampXs: number[] = [];
  for (let k = -6; k <= 6; k++) {
    const x = Math.round(slotLeft + k * step + sw * 0.9);
    if (x < -20 || x > W + 20) continue;
    if (Math.abs(x - keysX) < sw * 0.3) continue;
    lampXs.push(x);
  }
  const lamps = lampXs.length > 6 ? lampXs.filter((_, i) => i % 2 === 0) : lampXs;
  const trackY = roadTrackY(phone ? 'md' : 'lg', 'street', roadW, sw);
  return { W, phone, sw, sh, height, roadY, walk, curbY, slotLeft, slotTop, L, roadW, trackY, lots, lamps };
}

/** The hero's sky: pale behind the date (the brass reads on it), warming toward the horizon. */
const HERO_SKY = `linear-gradient(180deg, ${P.skyTop} 0%, ${mix(P.skyTop, P.skyBottom, 0.7)} 26%, ${P.skyBottom} 48%, ${mix(P.skyBottom, P.goldBottom, 0.7)} 74%, ${mix(P.goldBottom, P.goldTop, 0.5)} 100%)`;

function SkyArt() {
  const stars: [number, number, number][] = [
    [8, 9, 1], [17, 4, 1.3], [29, 12, 0.9], [41, 6, 1.1], [52, 14, 0.8], [58, 5, 1.2], [66, 10, 0.9], [74, 3, 1], [83, 13, 1.2], [91, 7, 0.9], [96, 16, 0.8], [35, 20, 0.8],
  ];
  return (
    <div className="absolute inset-0 [container-type:size]">
      {/* day: the bright haze of an afternoon sky where the ready date sits, so the brass keeps its contrast */}
      <div
        className="il-day absolute left-1/2 top-[54%] h-[36%] w-[120%] -translate-x-1/2 -translate-y-1/2 lg:left-[68%] lg:top-[30%] lg:h-[44%] lg:w-[64%]"
        style={{ background: `radial-gradient(closest-side, ${P.trim} 0%, ${P.trim} 55%, transparent 100%)`, opacity: 0.92 }}
      />
      {stars.map(([x, y, r], i) => (
        <span key={i} className="sc-light absolute block rounded-full" style={{ ...nightStyle(0.15 + i * 0.04), left: `${x}cqw`, top: `${y}cqh`, width: r * 2, height: r * 2, background: P.trim }} />
      ))}
      {/* the moon, high on the right, with a soft glow */}
      <svg viewBox="0 0 80 80" className="sc-light absolute right-[7cqw] top-[9cqh] w-[clamp(44px,4.5cqw,72px)]" style={nightStyle(0.05)}>
        <circle cx={40} cy={40} r={36} fill={P.glow} opacity={0.12} />
        <circle cx={40} cy={40} r={24} fill={P.glow} opacity={0.14} />
        <path d="M46 24a17 17 0 1 0 12 27a14 14 0 1 1 -12 -27Z" fill={P.honeyLight} />
      </svg>
    </div>
  );
}

/** Two drifting clouds, kept clear of the headline (day; the dark theme hides them). */
const Clouds = memo(function Clouds({ phone }: { phone: boolean }) {
  return (
    <div className="il-day absolute inset-0 transition-opacity duration-500">
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
    <svg className="absolute left-0 overflow-visible" width={W} height={120} viewBox={`0 0 ${W} 120`} style={{ top: top - 96 }}>
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

/** Lawns, the sidewalk, the curb and the street (the Road's labels sit on the lawns, so no fence there). */
const StreetArt = memo(function StreetArt({ layout }: { layout: StreetLayout }) {
  const { W, height, roadY, walk, curbY, sh, slotTop, phone } = layout;
  const lawnTop = slotTop + sh * 0.6;
  const walkTop = roadY - walk / 2;
  const dash = phone ? 26 : 40;
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
      {/* the sidewalk (the Road runs along it), its joints, the curb */}
      <rect x={-10} y={walkTop} width={W + 20} height={walk} fill={P.stone} />
      <rect x={-10} y={walkTop} width={W + 20} height={1.5} fill={P.stoneShade} />
      {Array.from({ length: Math.ceil(W / 64) + 1 }, (_, i) => (
        <rect key={i} x={i * 64 - 2} y={walkTop + 2} width={1} height={walk - 4} fill={P.stoneShade} opacity={0.7} />
      ))}
      <rect x={-10} y={curbY} width={W + 20} height={5} fill={mix(P.stone, P.trim, 0.4)} />
      <rect x={-10} y={curbY + 5} width={W + 20} height={3} fill={P.stoneShade} />
      {/* the street, with its centre line */}
      <rect x={-10} y={curbY + 8} width={W + 20} height={height - curbY - 8} fill="url(#hs-road)" />
      {Array.from({ length: Math.ceil(W / (dash * 2)) + 1 }, (_, i) => (
        <rect key={i} x={i * dash * 2 - dash / 2} y={curbY + 8 + (height - curbY - 8) * 0.55} width={dash} height={3} rx={1.5} fill={P.trim} opacity={0.55} />
      ))}
    </svg>
  );
});

/** The neighbours: stills of the same 3D house in other colours, day and night. */
const Neighbours = memo(function Neighbours({ layout }: { layout: StreetLayout }) {
  const { lots, sw, sh, slotTop } = layout;
  return (
    <>
      {lots.map((l, i) => (
        <div key={i} className="absolute" style={{ left: l.left, top: slotTop, width: sw, height: sh }}>
          <Image unoptimized src={`/house/street-n${l.variant}.webp`} alt="" width={sw} height={sh} className="still-day absolute inset-0 h-full w-full select-none" draggable={false} priority={i < 3} />
          <Image unoptimized src={`/house/street-n${l.variant}-night.webp`} alt="" width={sw} height={sh} className="still-night absolute inset-0 h-full w-full select-none" draggable={false} />
        </div>
      ))}
    </>
  );
});

/** Street lamps on the curb, numbered left to right (the night stagger runs along the street). */
const Lamps = memo(function Lamps({ layout }: { layout: StreetLayout }) {
  const { W, height, curbY, sw, lamps } = layout;
  const h = Math.round(sw * 0.34);
  return (
    <svg className="pointer-events-none absolute inset-0 overflow-visible" width={W} height={height} viewBox={`0 0 ${W} ${height}`} aria-hidden>
      {lamps.map((x, i) => (
        <StreetLamp key={x} x={x} base={curbY + 2} h={h} i={i} pool={1.9} />
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
 * until the layout is measured (first client paint) only the sky renders.
 */
export const HeroScene = memo(function HeroScene({ layout, road }: { layout: StreetLayout | null; road: ReactNode }) {
  return (
    <SceneRoot index={0} sky={HERO_SKY} skyArt={<SkyArt />} testId="hero-scene">
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
              {/* the Road along the sidewalk, ending in the family's front path; it takes input */}
              <div className="pointer-events-auto absolute" style={{ left: layout.L, width: layout.roadW, top: layout.roadY - layout.trackY }} data-road-anchor>
                {road}
              </div>
              <Lamps layout={layout} />
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
