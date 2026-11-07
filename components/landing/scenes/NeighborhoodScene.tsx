'use client';
import { memo } from 'react';
import { motion } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { P, mix } from '@/lib/illustrationPalette';
import { useTheme } from '@/lib/theme';
import { IsoHouse, isoPx, type HouseStage } from '@/components/illustrations/IsoHouse';
import { NB, NeighborhoodMap, type Lot } from '@/components/illustrations/landing/NeighborhoodMap';
import { Layer, SceneRoot, useDepthOffset, useSceneMount } from './Scene';
import { StreetLamp } from './parts';
import { ContactShadow, Kit, Tree, type TreeSpecies } from '@/components/illustrations/kit';

/**
 * Section 4, "Habitat sees it first": Habitat's early-warning view of a neighbourhood of its homeowners, seen
 * from above at an isometric angle, edge to edge: the block (NeighborhoodMap: six families' homes, families
 * walking home) runs off the right and bottom edges, the neighbouring blocks continue in every direction on
 * one clean ground plane (more homes, cleared pads, street trees, the streets that frame the block). The
 * side under the text dissolves into a soft haze.
 *
 * Over every home floats a status marker: text with a coloured rule (Stable, Watch, Act now), no filled
 * badge. Resting state (play 0): every marker at its status and the outreach note ("Draft outreach") settled
 * beside the home marked Act now. On each activation the markers replay (they rise in Stable, two turn to
 * Watch and one to Act now) and the note flies in from the text side; the homes and the ground never move.
 * The markers travel a little faster than the ground when the page moves, so they read as hovering.
 * Drawn with the shared kit (components/illustrations/kit.tsx): every home and tree stands in a soft
 * contact shadow with occlusion at its base; street trees of four species; near tree crowns in the corners.
 * One stage in the block's projection (600×350 units, scaled to fill the screen beside the text).
 * Layers: ground, homes 1 · markers 1.14 · tree crowns near the camera 1.28. Night (dark
 * theme): windows and porch lights, five street lamps along the front street.
 */
export const NeighborhoodScene = memo(function NeighborhoodScene({ play, reduce, lots, night = false }: { play: number; reduce: boolean; lots: Lot[]; night?: boolean }) {
  const mounted = useSceneMount(3);
  const dark = useTheme() === 'dark' || night;
  return (
    <SceneRoot index={3} night={night} testId="neighborhood-scene" className="[container-type:size]">
      {mounted && (
        <>
          <Layer speed={1}>
            <Site play={play} reduce={reduce} lots={lots} night={dark} />
            {/* the haze where the text sits (desktop): the streets dissolve before they reach it */}
            <div className="absolute inset-y-0 left-0 hidden w-[52cqw] lg:block" style={{ background: `linear-gradient(90deg, ${P.skyBottom} 0%, ${P.skyBottom} 58%, transparent 100%)`, opacity: 0.93 }} />
          </Layer>
          <Layer speed={1.28}>
            <Canopy className="bottom-[-9cqh] left-[-7cqw] w-[clamp(130px,15cqw,260px)]" species="oak" />
            <Canopy className="bottom-[-12cqh] right-[-6cqw] w-[clamp(150px,17cqw,300px)]" species="jacaranda" />
          </Layer>
        </>
      )}
    </SceneRoot>
  );
});

/**
 * The site's stage: the block's box (600×350 units), sized and placed with container units so the block
 * fills the right of the screen beside the text, its first home clear of the text column, its last home and
 * marker in view. --bw is the box width.
 *   desktop: --bw = min(130% of the height, what fits between the text column and the right edge)
 *   phones:  the block under the text, a little wider than the screen
 */
function Site({ play, reduce, lots, night }: { play: number; reduce: boolean; lots: Lot[]; night: boolean }) {
  const badgeY = useDepthOffset(-0.14);
  return (
    <div
      className="absolute bottom-[-2cqh] left-[-8cqw] aspect-[600/350] w-[122cqw] [--bw:122cqw] lg:bottom-auto lg:left-[calc(42cqw_+_10px_-_var(--bw)/600*136)] lg:top-[calc(50cqh_-_var(--bw)/600*200)] lg:w-[var(--bw)] lg:[--bw:min(130cqh,90.5cqw_-_61px)]"
    >
      <HomesGround />
      <Neighbours where="back" night={night} />
      <div className="absolute inset-0">
        {/* the homes stand; the markers rest at their status, and rise (and turn) again on each activation */}
        <NeighborhoodMap lots={lots} reduce={reduce} plain badgeY={badgeY} night={night} site={false} built settled={play === 0} badgeKey={play} />
      </div>
      <Outreach key={`note${play}`} lots={lots} reduce={reduce || play === 0} />
      <Neighbours where="front" night={night} />
    </div>
  );
}

/**
 * The outreach note: a folded paper with an envelope mark and "Draft outreach", flying from the text side to
 * the home marked Act now (after its marker turns) and settling beside it.
 */
function Outreach({ lots, reduce }: { lots: Lot[]; reduce: boolean }) {
  const { t } = useLang();
  const i = lots.findIndex((l) => l.status === 'act');
  if (i < 0) return null;
  const s = NB.SLOTS[i];
  const c = NB.at(s.u, s.w);
  const hf = NB.S / 92;
  // beside the home's marker (which floats at the ridge, 44 house units in, 84 up)
  const x = c.x + 44 * hf + 34;
  const y = c.y - 84 * hf + 6;
  return (
    <div className="absolute" style={{ left: `${(x / NB.VB.w) * 100}%`, top: `${(y / NB.VB.h) * 100}%`, zIndex: 2100 }}>
      <motion.div
        className="absolute left-0 top-0 flex items-center gap-[6px] whitespace-nowrap border-l-2 border-pine py-[3px] pl-[7px] pr-[9px] text-[13px] font-semibold text-pine"
        style={{ background: P.paper }}
        initial={reduce ? false : { x: '-320%', y: '-140%', opacity: 0, rotate: -10, scale: 0.9 }}
        animate={{ x: 0, y: 0, opacity: 1, rotate: -2, scale: 1 }}
        transition={{ duration: 1, delay: reduce ? 0 : 2.5, ease: [0.65, 0, 0.35, 1], opacity: { duration: 0.2, delay: reduce ? 0 : 2.5 } }}
      >
        <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden>
          <rect x="0.75" y="0.75" width="14.5" height="10.5" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1.5 1.5 8 6.5 14.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        {t('landing.watchOutreach')}
      </motion.div>
    </div>
  );
}

/** Homes on the neighbouring blocks (static): behind the block, and in front of it. */
const NEIGHBOURS: { u: number; w: number; stage: HouseStage; where: 'back' | 'front' }[] = [
  { u: 10, w: 372, stage: 'finished', where: 'back' },
  { u: 104, w: 372, stage: 'finished', where: 'back' },
  { u: 214, w: 372, stage: 'finished', where: 'back' },
  { u: 420, w: 34, stage: 'finished', where: 'back' },
  { u: 420, w: 130, stage: 'finished', where: 'back' },
  { u: 420, w: 226, stage: 'finished', where: 'back' },
  { u: 214, w: -150, stage: 'finished', where: 'front' },
  { u: 420, w: -150, stage: 'finished', where: 'front' },
];
const Neighbours = memo(function Neighbours({ where, night }: { where: 'back' | 'front'; night: boolean }) {
  const hp = isoPx(NB.S, 0, 0);
  return (
    <>
      {NEIGHBOURS.filter((n) => n.where === where)
        .sort((a, b) => b.w - a.w)
        .map((n) => {
          const c = NB.at(n.u, n.w);
          return (
            <div key={`${n.u}-${n.w}`} className="absolute" style={{ left: `${((c.x - hp.x) / NB.VB.w) * 100}%`, top: `${((c.y - hp.y) / NB.VB.h) * 100}%`, width: `${(NB.S / NB.VB.w) * 100}%` }}>
              <IsoHouse size={NB.S} stage={n.stage} lit={night && n.stage === 'finished'} porch={night && n.stage === 'finished'} ground={false} className="h-auto w-full" />
            </div>
          );
        })}
    </>
  );
});

/** A tree close to the camera in a near corner (crisp, the kit's own tree, cut by the frame). */
function Canopy({ className, species }: { className: string; species: TreeSpecies }) {
  return (
    <svg viewBox="-70 -110 140 120" className={`absolute overflow-visible ${className}`}>
      <Tree species={species} x={0} base={0} size={110} shadow={0} />
    </svg>
  );
}

const { at, STREET, SLAB, SLOTS, HOUSE_W, HOUSE_D, VB, ROWS } = NB;
const TREE_MIX: TreeSpecies[] = ['oak', 'jacaranda', 'cypress', 'palm', 'oak', 'cypress'];

/**
 * Where a home meets its lot: a tight band of occlusion just around its footprint and a soft contact shadow
 * leaning right, away from the top-left light.
 */
function HouseShadow({ u, w }: { u: number; w: number }) {
  const c = at(u + HOUSE_W * 0.5, w + HOUSE_D * 0.5);
  return (
    <>
      <ContactShadow cx={c.x + 10} cy={c.y + 4} rx={68} ry={20} strength={1.1} />
      <path d={quad(u - 2.5, w - 2.5, u + HOUSE_W + 4, w + HOUSE_D + 3)} fill={P.ink} opacity={0.14} />
    </>
  );
}
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
      <Kit>
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
      {[...SLOTS, ...NEIGHBOURS].map((s, i) => (
        <HouseShadow key={i} u={s.u} w={s.w} />
      ))}
      {/* street trees in the neighbouring blocks: four species, far to near, each in its contact shadow */}
      {[...trees].sort((a, b) => b[1] - a[1]).map(([u, w, r], i) => {
        const p = at(u, w);
        const species = TREE_MIX[i % TREE_MIX.length];
        return <Tree key={`${u}-${w}`} species={species} x={p.x} base={p.y} size={r * (species === 'palm' ? 5.4 : species === 'cypress' ? 4.2 : 3.4)} lean={species === 'palm' ? (i % 2 ? 4 : -5) : undefined} />;
      })}
      {/* street lamps along the front cross street; night slot: their pools of light */}
      {lamps.map(([u, w], i) => {
        const p = at(u, w);
        return <StreetLamp key={u} x={p.x} base={p.y} h={30} i={i} pool={1.8} />;
      })}
      {/* haze toward every edge, a little more on the text's side */}
      <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="url(#sc-hm-vignette)" />
      <rect x={box.x} y={box.y} width={-20 - box.x} height={box.h} fill="url(#sc-hm-side)" />
      </Kit>
    </svg>
  );
});
