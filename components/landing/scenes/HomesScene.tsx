'use client';
import { memo, type RefObject } from 'react';
import { useReducedMotion, useTransform } from 'motion/react';
import { P, mix } from '@/lib/illustrationPalette';
import { NB } from '@/components/illustrations/landing/NeighborhoodMap';
import { Layer, SceneRoot, useRestOffset, useSceneMount } from './Scene';
import { nightStyle } from './parts';

/**
 * Section 4, "Habitat sees who's ready": an elevated, isometric view of a block under construction on a
 * clean ground plane. The plane (HomesGround) is drawn in the block's own projection and runs out to every
 * edge of the section: the block's street continues front and back, cross streets frame it, neighbouring
 * lots are quiet lawns with a few trees and two cleared pads waiting for the next builds. The far ground
 * dissolves into a high, pale haze; the side under the text is hazed too, so it stays calm. Count badges
 * float above the homes: they travel a little faster than the block when the page moves, so they read as
 * hovering. Ambient (the block's own, only while on screen): the crane slews.
 *
 * The plane lives with the block in the section's content (it must stay registered with the block's
 * streets); the scene root adds two out-of-focus tree crowns near the camera at the bottom corners (the
 * fastest layer, above the plane). Night slots: street lamps along the front cross street, work lights
 * by the frames.
 */
export const HomesScene = memo(function HomesScene({ night = false }: { night?: boolean }) {
  const mounted = useSceneMount(3);
  return (
    <SceneRoot index={3} night={night} testId="homes-scene" className="z-[2] [container-type:size]">
      {mounted && (
        <Layer speed={1.28}>
          <Canopy className="bottom-[-11cqh] left-[-6cqw] w-[clamp(120px,13cqw,230px)]" />
          <Canopy className="bottom-[-13cqh] right-[-5cqw] w-[clamp(140px,15cqw,270px)]" flip />
        </Layer>
      )}
    </SceneRoot>
  );
});

/** A tree crown close to the camera, seen from above and out of focus. */
function Canopy({ className, flip = false }: { className: string; flip?: boolean }) {
  return (
    <svg viewBox="0 0 200 180" className={`absolute opacity-80 ${className}`} style={{ filter: 'blur(8px)', transform: flip ? 'scaleX(-1)' : undefined }}>
      <circle cx={110} cy={110} r={74} fill={P.tree} />
      <circle cx={84} cy={92} r={58} fill={P.treeLight} />
      <circle cx={130} cy={70} r={44} fill={P.treeLight} />
      <circle cx={66} cy={66} r={30} fill={P.pineLighter} />
      <circle cx={58} cy={56} r={14} fill={P.sageLight} opacity={0.7} />
    </svg>
  );
}

/** Extra travel for the block's count badges (they hover above it), from the section's scroll offset. */
export function useBadgeFloat(ref: RefObject<HTMLElement | null>) {
  const reduce = !!useReducedMotion();
  const { d } = useRestOffset(ref);
  return useTransform(d, (v) => (reduce ? 0 : v * -0.14));
}

const { at, STREET, SLAB, SLOTS, HOUSE_W, HOUSE_D, VB, ROWS } = NB;
const quad = (u0: number, w0: number, u1: number, w1: number) => {
  const a = at(u0, w0);
  const b = at(u1, w0);
  const c = at(u1, w1);
  const d = at(u0, w1);
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}L${c.x.toFixed(1)} ${c.y.toFixed(1)}L${d.x.toFixed(1)} ${d.y.toFixed(1)}Z`;
};
/** the plane's extent (block units): far enough to reach every edge of the section */
const EXT = { u0: -1900, u1: 2100, w0: -800, w1: 1500 };
const SIDEWALK = 12;
/** streets near the block, [u0, u1, w0, w1] of the asphalt; they run out into the haze */
const AVES: [number, number, number, number][] = [
  [STREET.u0, STREET.u1, -900, 1300],
  [-74, -42, -900, 1300],
  [348, 380, -900, 1300],
];
const CROSS: [number, number, number, number][] = [
  [-1600, 1800, -56, -24],
  [-1600, 1800, 302, 334],
];

/**
 * The ground plane around the block, in its projection (viewBox 600×350, overflowing to every side): a clean
 * lawn with the streets that frame the block running out into a soft vignette of haze (the sky's own colour),
 * which also keeps the side under the text quiet. Rendered behind the block, inside the block's own box.
 */
export const HomesGround = memo(function HomesGround() {
  // lot lines: the block's own, and a few in the neighbouring blocks
  const lotLines: string[] = [];
  [ROWS[0] + 74, ROWS[1] + 74].forEach((w) => {
    lotLines.push(quad(4, w, STREET.u0 - 14, w + 3), quad(STREET.u1 + 14, w, SLAB.u - 4, w + 3));
  });
  for (const w of [70, 166, 262]) lotLines.push(quad(-380, w, -90, w + 2.5), quad(396, w, 700, w + 2.5));
  for (const u of [-250, 560]) lotLines.push(quad(u, -10, u + 2.5, 290));
  const trees: [number, number, number][] = [
    [-120, 40, 13], [-260, 150, 15], [-160, 250, 12], [460, 60, 14], [560, 210, 13], [470, 380, 12], [180, 420, 14], [-60, 400, 12], [640, 120, 13], [80, -150, 13], [420, -130, 15], [-300, -120, 13],
  ];
  const pads: [number, number][] = [[420, 120], [-230, 330]];
  const lamps: [number, number][] = [[-30, -20], [110, -20], [200, -20], [330, -20], [470, -20]];
  // work lights on the lots still being built (two framing, one roofing): a mast and a lamp head
  const works: [number, number][] = [[SLOTS[4].u + HOUSE_W + 10, SLOTS[4].w - 6], [SLOTS[5].u + HOUSE_W + 10, SLOTS[5].w - 6]];
  const drives = SLOTS.map((s) => (s.side === 'L' ? quad(s.u + HOUSE_W * 0.5, s.w - 22, STREET.u0 - 12, s.w - 12) : quad(STREET.u1 + 12, s.w - 22, s.u + HOUSE_W * 0.5, s.w - 12))).join('');
  const walks = SLOTS.map((s) => quad(s.u + HOUSE_W * 0.4, s.w - 22, s.u + HOUSE_W * 0.6, s.w)).join('');
  let dashes = '';
  const mid = (STREET.u0 + STREET.u1) / 2;
  for (let w = -900; w < 1300; w += 30) dashes += quad(mid - 1, w, mid + 1, w + 14);
  const tl = at(EXT.u0, EXT.w1);
  const br = at(EXT.u1, EXT.w0);
  const box = { x: tl.x - 2400, y: tl.y - 600, w: br.x - tl.x + 4800, h: br.y - tl.y + 1200 };
  const streets = [...AVES.map(([u0, u1, w0, w1]) => ({ walk: quad(u0 - SIDEWALK, w0, u1 + SIDEWALK, w1), road: quad(u0, w0, u1, w1) })), ...CROSS.map(([u0, u1, w0, w1]) => ({ walk: quad(u0, w0 - SIDEWALK, u1, w1 + SIDEWALK), road: quad(u0, w0, u1, w1) }))];
  return (
    <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden data-testid="homes-ground">
      <defs>
        {/* the haze: clear around the block, the sky's colour toward every edge (a little more on the left) */}
        <radialGradient id="sc-hm-vignette" gradientUnits="userSpaceOnUse" cx={360} cy={190} r={520} gradientTransform="translate(360 190) scale(1.5 0.78) translate(-360 -190)">
          <stop offset={0.42} stopColor={P.skyBottom} stopOpacity={0} />
          <stop offset={0.78} stopColor={P.skyBottom} stopOpacity={0.62} />
          <stop offset={1} stopColor={P.skyBottom} stopOpacity={0.94} />
        </radialGradient>
        <linearGradient id="sc-hm-side" x1={-620} y1={0} x2={-20} y2={0} gradientUnits="userSpaceOnUse">
          <stop offset={0} stopColor={P.skyBottom} stopOpacity={0.5} />
          <stop offset={1} stopColor={P.skyBottom} stopOpacity={0} />
        </linearGradient>
        <linearGradient id="sc-hm-lawn" x1={0} y1={350} x2={0} y2={-200} gradientUnits="userSpaceOnUse">
          <stop offset={0} stopColor={mix(P.sageLight, P.sage, 0.3)} />
          <stop offset={1} stopColor={mix(P.sageLight, P.skyBottom, 0.25)} />
        </linearGradient>
        <radialGradient id="sc-hm-pool">
          <stop offset="0" stopColor={P.honeyLight} stopOpacity="0.6" />
          <stop offset="1" stopColor={P.honey} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* the plane: lawns everywhere */}
      <path d={quad(EXT.u0, EXT.w0, EXT.u1, EXT.w1)} fill="url(#sc-hm-lawn)" />
      <path d={lotLines.join('')} fill={P.sageDark} opacity={0.16} />
      {/* cleared pads waiting for the next builds, with corner stakes */}
      {pads.map(([u, w]) => (
        <g key={`${u}-${w}`}>
          <path d={quad(u, w, u + 76, w + 50)} fill={mix(P.soil, P.sageLight, 0.3)} />
          <path d={quad(u + 4, w + 4, u + 72, w + 46)} fill="none" stroke={P.timberShade} strokeWidth={0.8} strokeDasharray="3 3" opacity={0.7} />
          {[[u + 4, w + 4], [u + 72, w + 4], [u + 72, w + 46], [u + 4, w + 46]].map(([a, b2], i) => {
            const p = at(a, b2);
            return <rect key={i} x={p.x - 0.7} y={p.y - 6} width={1.4} height={6} fill={P.timber} />;
          })}
        </g>
      ))}
      {/* streets around the block: sidewalks, then asphalt, then the avenue's centre dashes */}
      <path d={streets.map((s) => s.walk).join('')} fill={P.stone} />
      <path d={streets.map((s) => s.road).join('')} fill={mix(P.asphaltLight, P.skyBottom, 0.18)} />
      <path d={dashes} fill={P.trim} opacity={0.75} />
      {/* the block's own lot: driveways, front walks, the shadows its homes cast (falling right) */}
      <path d={drives} fill={P.stone} />
      <path d={walks} fill={P.stone} />
      {SLOTS.map((s, i) => {
        const c = at(s.u + HOUSE_W * 0.7, s.w + HOUSE_D * 0.5);
        return <ellipse key={i} cx={c.x + 12} cy={c.y + 4} rx={58} ry={15} fill={P.ink} opacity={0.08} />;
      })}
      {/* street trees in the neighbouring blocks (round crowns, shadows falling right) */}
      {trees.map(([u, w, r]) => {
        const p = at(u, w);
        return (
          <g key={`${u}-${w}`}>
            <ellipse cx={p.x + r * 0.9} cy={p.y + 1} rx={r * 1.3} ry={r * 0.45} fill={P.ink} opacity={0.08} />
            <rect x={p.x - 1} y={p.y - r} width={2} height={r} fill={P.bark} />
            <circle cx={p.x} cy={p.y - r * 1.3} r={r} fill={P.tree} />
            <circle cx={p.x - r * 0.3} cy={p.y - r * 1.55} r={r * 0.6} fill={P.treeLight} />
          </g>
        );
      })}
      {/* street lamps along the front cross street; night slot: their pools of light */}
      {lamps.map(([u, w], i) => {
        const p = at(u, w);
        return (
          <g key={u}>
            <ellipse className="sc-light" style={nightStyle(0.2 + i * 0.12)} cx={p.x} cy={p.y + 1} rx={22} ry={8} fill="url(#sc-hm-pool)" />
            <rect x={p.x - 0.5} y={p.y - 14} width={1} height={14} fill={P.slate} />
            <rect x={p.x - 1.6} y={p.y - 16} width={3.2} height={2.4} rx={1} fill={P.slateDark} />
            <circle className="sc-light" style={nightStyle(0.2 + i * 0.12)} cx={p.x} cy={p.y - 14.6} r={1.6} fill={P.glow} />
          </g>
        );
      })}
      {/* work lights by the frames; night slot: the lamps and the pools they throw */}
      {works.map(([u, w], i) => {
        const p = at(u, w);
        return (
          <g key={`w${i}`}>
            <ellipse className="sc-light" style={nightStyle(0.5 + i * 0.15)} cx={p.x - 10} cy={p.y + 2} rx={34} ry={12} fill="url(#sc-hm-pool)" />
            <rect x={p.x - 0.6} y={p.y - 22} width={1.2} height={22} fill={P.slate} />
            <rect x={p.x - 3.5} y={p.y - 25} width={7} height={3.4} rx={0.8} fill={P.honey} />
            <rect className="sc-light" style={nightStyle(0.5 + i * 0.15)} x={p.x - 3} y={p.y - 22.4} width={6} height={1.4} fill={P.glow} />
          </g>
        );
      })}
      {/* haze toward every edge, a little more on the text's side */}
      <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="url(#sc-hm-vignette)" />
      <rect x={box.x} y={box.y} width={-20 - box.x} height={box.h} fill="url(#sc-hm-side)" />
    </svg>
  );
});
