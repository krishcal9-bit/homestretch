'use client';
import { memo, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { ease } from '@/lib/motion';
import { P, mix } from '@/lib/illustrationPalette';
import { Bush, Cloud, ContactShadow, Ground, GroundPath, Hills, Kit, Tree, smoothPath } from '@/components/illustrations/kit';
import { Layer, SceneRoot, useSceneMount } from './Scene';
import { StreetLamp, TableLamp, nightStyle } from './parts';

/**
 * Section 3, "Fix it before it breaks": the family's house in late-afternoon light, opened up like a
 * dollhouse and set into its yard. Its front wall is cut away: the living room (sofa, floor lamp, a
 * picture), the kitchen (counter, cabinets, a window onto the sky) and the garage, where the
 * eleven-year-old water heater stands beside a savings meter ("Set aside $18/month").
 *
 * Resting state (play 0): the meter is full and the heater calm ("Replacement covered"): the whole story
 * at a glance. On each activation it replays: the heater glows amber, the meter empties and fills, and when
 * it is full the glow calms to pine. The house, yard and sky never leave the screen.
 *
 * The house sits on a low foundation in a planting bed (bushes against its base, a stone path from the
 * sidewalk to the front step), with the hills and the Saddleback ridge layered behind it in haze,
 * a jacaranda, an oak and cypresses on the left and two palms on the right. All drawn with the shared kit
 * (components/illustrations/kit.tsx). One world (1600×1100) seen through two cameras: wide screens see the
 * whole yard, phones the house under the text.
 * Layers: ridge 0.38 · hills 0.7 · yard, house, street 1 · near planting 1.2. Ambient (one, only while
 * settled here): the heater's amber glow pulses until the replacement is covered. Night (dark theme):
 * the street lamps come on one after another, the rooms light up, the floor lamp too.
 */
const W = { w: 1600, h: 1100 };
const pctX = (x: number) => `${((x / W.w) * 100).toFixed(3)}%`;
const pctY = (y: number) => `${((y / W.h) * 100).toFixed(3)}%`;
/** the house, in world units: walls from x0 to x1 standing on the ground at `base` */
const H = { x0: 700, x1: 1440, base: 900, wallTop: 600, peak: 432, t: 16 };
const ROOMS = { living: [H.x0 + H.t, 950], kitchen: [966, 1120], garage: [1136, H.x1 - H.t] } as const;
const HEATER = { x: 1320, w: 84, top: 712 };
const METER = { x: 1170, top: 724, h: 136 };
const T = { fill: 1.1, fillDur: 2.1 };
/** the golden-hour haze the far layers sink into */
const HAZE = mix(P.goldBottom, P.skyTop, 0.35);

export const RepairScene = memo(function RepairScene({ play, reduce, night = false }: { play: number; reduce: boolean; night?: boolean }) {
  const mounted = useSceneMount(2);
  // 0 aging (amber) · 1 filling · 2 covered (calm). Rests covered; each activation replays the story.
  const [phase, setPhase] = useState(2);
  useEffect(() => {
    if (reduce || play === 0) return setPhase(2);
    setPhase(0);
    const a = setTimeout(() => setPhase(1), T.fill * 1000);
    const b = setTimeout(() => setPhase(2), (T.fill + T.fillDur + 0.1) * 1000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [play, reduce]);
  return (
    <SceneRoot
      index={2}
      night={night}
      testId="repair-scene"
      skyArt={REPAIR_SKY}
      className="[container-type:size] [--by:1000] [--cx:800] [--s:min(calc(100cqw/1600),calc(100cqh/760))] portrait:[--by:1010] portrait:[--cx:1070] portrait:[--s:min(calc(100cqw/840),calc(100cqh/1150))]"
    >
      {mounted && (
        <>
          <Layer speed={0.38}>
            <Stage>
              <svg viewBox={`0 0 ${W.w} ${W.h}`} className="absolute inset-0 h-full w-full overflow-visible">
                <Ridge />
              </svg>
            </Stage>
          </Layer>
          <Layer speed={0.7}>
            <Stage>
              <svg viewBox={`0 0 ${W.w} ${W.h}`} className="absolute inset-0 h-full w-full overflow-visible">
                <Slopes />
              </svg>
            </Stage>
          </Layer>
          <Layer speed={1}>
            <Stage>
              <svg viewBox={`0 0 ${W.w} ${W.h}`} className="absolute inset-0 h-full w-full overflow-visible">
                <Kit>
                  <Yard />
                  <House />
                  <Planting />
                  <Street />
                </Kit>
              </svg>
              <Heater phase={phase} reduce={reduce} />
              <Meter phase={phase} reduce={reduce} />
            </Stage>
          </Layer>
          <Layer speed={1.2}>
            <Stage>
              <svg viewBox={`0 0 ${W.w} ${W.h}`} className="absolute inset-0 h-full w-full overflow-visible">
                <Kit>
                  <Near />
                </Kit>
              </svg>
            </Stage>
          </Layer>
        </>
      )}
    </SceneRoot>
  );
});

/** The low sun's glow on the left horizon (day only), stars and the moon at night: painted into the sky. */
const REPAIR_SKY = (
  <>
    <div className="il-day absolute left-[-34%] top-[26%] h-[64%] w-[84%]" style={{ background: `radial-gradient(closest-side, ${P.glow}, transparent)`, opacity: 0.55 }} />
    <div className="il-night absolute inset-0">
      {[[62, 8], [70, 4], [78, 11], [86, 6], [93, 13], [55, 3], [47, 9]].map(([x, y], i) => (
        <span key={i} className="absolute block h-[3px] w-[3px] rounded-full" style={{ left: `${x}%`, top: `${y}%`, background: P.star }} />
      ))}
      <span className="absolute left-[calc(12%_-_26px)] top-[calc(42%_-_26px)] block lg:left-[calc(45%_-_26px)] lg:top-[calc(7%_-_26px)] h-[80px] w-[80px]" style={{ background: `radial-gradient(closest-side, ${P.honeyLight}, transparent)`, opacity: 0.35 }} />
      <span className="absolute left-[12%] top-[42%] block h-[28px] lg:left-[45%] lg:top-[7%] w-[28px] rounded-full" style={{ background: P.moon }} />
    </div>
  </>
);

/** The world box: 1600×1100 units at the camera's scale (--s px per unit), positioned by the camera (--cx, --by). */
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute" style={{ left: 'calc(50cqw - var(--s) * var(--cx))', top: 'calc(100cqh - var(--s) * var(--by))', width: 'calc(var(--s) * 1600)', height: 'calc(var(--s) * 1100)' }}>
      {children}
    </div>
  );
}

const MOUNTAIN: [string, string, string] = [mix(P.meadow, P.skyTop, 0.5), mix(P.sage, P.slateLight, 0.32), mix(P.sageDark, P.slateLight, 0.5)];
const WARM: [string, string, string] = [mix(P.meadow, P.goldTop, 0.3), mix(P.sageLight, P.sage, 0.4), mix(P.sageDark, P.sage, 0.3)];

/** The far ridge (Santiago and Modjeska, the Saddleback) and the range in front of it, deep in the haze. */
const Ridge = memo(function Ridge() {
  return (
    <>
      <Cloud x={1210} base={250} w={250} />
      <Cloud x={930} base={322} w={130} haze={0.35} hazeTo={HAZE} />
      <Hills
        x0={-700}
        x1={2300}
        bottom={1100}
        hazeTo={HAZE}
        layers={[
          { y: 420, haze: 0.62, waves: 4, tones: MOUNTAIN, points: [[-700, 500], [0, 494], [500, 484], [820, 462], [980, 398], [1110, 336], [1190, 330], [1300, 364], [1480, 408], [1800, 438], [2300, 466]] },
          { y: 480, haze: 0.46, waves: 5, tones: MOUNTAIN, points: [[-700, 528], [100, 506], [460, 518], [780, 500], [1060, 470], [1380, 462], [1700, 480], [2300, 500]] },
        ]}
      />
    </>
  );
});

/** The rolling hills nearer in: a row of small trees on the left, cypresses and an oak on the right crest. */
const Slopes = memo(function Slopes() {
  return (
    <Kit>
      <Hills
        x0={-700}
        x1={2300}
        bottom={1100}
        hazeTo={HAZE}
        layers={[{ y: 540, haze: 0.26, waves: 6, tones: WARM, points: [[-700, 548], [0, 536], [260, 524], [520, 536], [760, 520], [1000, 482], [1240, 452], [1480, 458], [1800, 470], [2300, 478]] }]}
      />
      {/* an orchard row and a farm windbreak, small and hazy, standing in the grass */}
      {[60, 112, 160, 214, 262, 316, 366, 418].map((x, i) => (
        <Tree key={x} species="oak" x={x} base={548 + (i % 2) * 6} size={34 + (i % 3) * 4} haze={0.34} hazeTo={HAZE} shadow={0.6} />
      ))}
      {[1520, 1548, 1580, 1612, 1644].map((x, i) => (
        <Tree key={x} species="cypress" x={x} base={476 + i * 1.5} size={78 - (i % 2) * 12} haze={0.3} hazeTo={HAZE} shadow={0.6} />
      ))}
      <Tree species="oak" x={-80} base={556} size={70} haze={0.3} hazeTo={HAZE} />
      <Hills x0={-700} x1={2300} bottom={1100} hazeTo={HAZE} layers={[{ y: 600, haze: 0.12, waves: 6, tones: WARM, points: [[-700, 612], [160, 594], [600, 604], [1000, 586], [1400, 580], [1800, 592], [2300, 596]] }]} />
    </Kit>
  );
});

/** The yard: lawn from the hills down to the sidewalk, the house's soft shadow, trees, the path, the mailbox. */
const Yard = memo(function Yard() {
  return (
    <>
      <Ground x0={-700} x1={2300} y={612} bottom={1000} tones={[mix(P.meadow, P.sageLight, 0.5), P.sage]} haze={0.1} hazeTo={HAZE} edge={smoothPath([{ x: -700, y: 646 }, { x: 200, y: 634 }, { x: 800, y: 622 }, { x: 1300, y: 616 }, { x: 2300, y: 624 }])} />
      {/* trees behind the house: a palm over the roof, an oak on the left */}
      <Tree species="palm" x={1372} base={652} size={300} lean={12} haze={0.12} hazeTo={HAZE} />
      <Tree species="palm" x={1540} base={660} size={250} lean={-10} haze={0.14} hazeTo={HAZE} />
      <Tree species="oak" x={1590} base={700} size={120} haze={0.1} hazeTo={HAZE} />
      <Tree species="oak" x={246} base={706} size={170} haze={0.08} hazeTo={HAZE} />
      <Tree species="cypress" x={600} base={826} size={176} />
      <Tree species="cypress" x={642} base={836} size={142} />
      <Tree species="jacaranda" x={430} base={836} size={250} />
      {/* the house's long shadow across the lawn, to the right (the sun is low on the left) */}
      <path d={`M${H.x1 - 40} ${H.base + 4}C${H.x1 + 120} ${H.base - 8} ${H.x1 + 300} ${H.base - 4} ${H.x1 + 420} ${H.base + 16}C${H.x1 + 300} ${H.base + 30} ${H.x1 + 60} ${H.base + 30} ${H.x1 - 40} ${H.base + 22}Z`} fill={P.ink} opacity={0.06} />
      {/* the path from the sidewalk to the front step */}
      <GroundPath points={[{ x: 812, y: 912, w: 44 }, { x: 800, y: 926, w: 48 }, { x: 772, y: 944, w: 54 }, { x: 750, y: 966, w: 62 }]} />
    </>
  );
});

/** A post-mounted mailbox: lit left faces, shaded right, a raised honey flag, its contact shadow. */
function Mailbox({ x, base }: { x: number; base: number }) {
  return (
    <g>
      <ContactShadow cx={x + 6} cy={base} rx={20} ry={4} />
      <rect x={x - 3} y={base - 46} width={6} height={46} fill={mix(P.bark, P.ink, 0.2)} />
      <rect x={x - 3} y={base - 46} width={2.6} height={46} fill={P.bark} />
      <path d={`M${x - 14} ${base - 46}V${base - 58}a14 12 0 0 1 28 0V${base - 46}Z`} fill={P.slate} />
      <path d={`M${x - 14} ${base - 46}V${base - 58}a14 12 0 0 1 12 -11.6V${base - 46}Z`} fill={P.slateLight} />
      <rect x={x + 14} y={base - 74} width={3} height={18} fill={P.amber} />
      <rect x={x + 14} y={base - 74} width={10} height={6} fill={P.amber} />
    </g>
  );
}

/**
 * The house in section: a low foundation in the ground, thick cut walls, the gable roof with its attic,
 * and three rooms seen from the front, each lit from the top-left with soft occlusion in its corners.
 * Night slot: a warm wash in each room.
 */
const House = memo(function House() {
  const { x0, x1, base, wallTop, peak, t } = H;
  const mid = (x0 + x1) / 2;
  const room = (a: number, b: number, wall: string, floor: string) => (
    <>
      <rect x={a} y={wallTop + t} width={b - a} height={base - wallTop - t} fill={wall} />
      <rect x={a} y={wallTop + t} width={b - a} height={base - wallTop - t - 22} fill="url(#rp-room)" />
      <rect x={a} y={base - 22} width={b - a} height={22} fill={floor} />
      <rect x={a} y={base - 22} width={b - a} height={22} fill="url(#rp-floor)" />
      <rect x={a} y={base - 24} width={b - a} height={3} fill={mix(floor, P.trim, 0.3)} />
      {/* occlusion: under the ceiling, along the floor, in both corners */}
      <rect x={a} y={wallTop + t} width={b - a} height={46} fill="url(#rp-ceil)" />
      <rect x={a} y={base - 82} width={b - a} height={60} fill="url(#rp-base)" />
      <rect x={a} y={wallTop + t} width={30} height={base - wallTop - t} fill="url(#rp-left)" />
      <rect x={b - 30} y={wallTop + t} width={30} height={base - wallTop - t} fill="url(#rp-right)" />
    </>
  );
  const roofOuter = `M${x0 - 34} ${wallTop + 8}L${mid} ${peak - 6}L${x1 + 34} ${wallTop + 8}`;
  return (
    <>
      <defs>
        <linearGradient id="rp-room" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.sheen} stopOpacity="0.26" />
          <stop offset="0.5" stopColor={P.sheen} stopOpacity="0" />
          <stop offset="1" stopColor={P.ink} stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="rp-floor" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={P.sheen} stopOpacity="0.18" />
          <stop offset="1" stopColor={P.ink} stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id="rp-ceil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.ink} stopOpacity="0.2" />
          <stop offset="1" stopColor={P.ink} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rp-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.ink} stopOpacity="0" />
          <stop offset="1" stopColor={P.ink} stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id="rp-left" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={P.ink} stopOpacity="0.14" />
          <stop offset="1" stopColor={P.ink} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rp-right" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor={P.ink} stopOpacity="0.2" />
          <stop offset="1" stopColor={P.ink} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rp-attic" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(P.timberShade, P.ink, 0.25)} />
          <stop offset="1" stopColor={mix(P.timber, P.wallShade, 0.4)} />
        </linearGradient>
        <linearGradient id="rp-roofL" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={P.slateLight} />
          <stop offset="1" stopColor={mix(P.slateLight, P.trim, 0.14)} />
        </linearGradient>
      </defs>
      {/* contact shadow where the house meets the ground, leaning right */}
      <ContactShadow cx={mid + 40} cy={base + 10} rx={460} ry={22} strength={1.2} />
      {/* foundation: a low concrete course, lit top, shaded face, set into the ground */}
      <rect x={x0 - 8} y={base - 2} width={x1 - x0 + 16} height={14} fill={P.stoneShade} />
      <rect x={x0 - 8} y={base - 2} width={x1 - x0 + 16} height={3} fill={P.stone} />
      {/* chimney behind the roof plane */}
      <rect x={mid + 120} y={peak + 30} width={36} height={86} fill={P.stoneShade} />
      <rect x={mid + 120} y={peak + 30} width={16} height={86} fill={P.stone} />
      <rect x={mid + 116} y={peak + 24} width={44} height={8} fill={mix(P.stoneShade, P.ink, 0.15)} />
      {/* attic under the roof (darker toward the ridge), the truss, the ceiling joist */}
      <path d={`M${x0 + 10} ${wallTop}L${mid} ${peak + 26}L${x1 - 10} ${wallTop}Z`} fill="url(#rp-attic)" />
      <path d={`M${mid - 140} ${wallTop - 6}L${mid} ${peak + 34}L${mid + 140} ${wallTop - 6}`} fill="none" stroke={P.timberShade} strokeWidth={8} />
      <path d={`M${mid - 140} ${wallTop - 6}L${mid} ${peak + 34}`} fill="none" stroke={P.timber} strokeWidth={3} transform="translate(-2 -2)" />
      <rect x={x0 + 40} y={wallTop - 8} width={x1 - x0 - 80} height={8} fill={P.timberShade} />
      {/* the roof in section: the lit left slope, the right slope in shade, a trim fascia along the edge */}
      <path d={`M${x0 - 34} ${wallTop + 8}L${mid} ${peak - 6}L${mid} ${peak + 22}L${x0 - 8} ${wallTop + 8}Z`} fill="url(#rp-roofL)" />
      <path d={`M${mid} ${peak - 6}L${x1 + 34} ${wallTop + 8}L${x1 + 8} ${wallTop + 8}L${mid} ${peak + 22}Z`} fill={P.slate} />
      <path d={`M${mid} ${peak + 22}L${x1 + 8} ${wallTop + 8}L${x1 + 8} ${wallTop + 14}L${mid} ${peak + 28}Z`} fill={P.slateDark} />
      <path d={roofOuter} fill="none" stroke={P.trim} strokeWidth={3} strokeLinejoin="round" opacity={0.85} />
      {/* rooms */}
      {room(ROOMS.living[0], ROOMS.living[1], P.wall, P.timber)}
      {room(ROOMS.kitchen[0], ROOMS.kitchen[1], mix(P.wall, P.skyTop, 0.35), mix(P.stone, P.timber, 0.3))}
      {room(ROOMS.garage[0], ROOMS.garage[1], mix(P.wall, P.stone, 0.55), P.stoneShade)}
      {/* cut walls and ceiling (the section: thick, darker, a lit top-left edge) */}
      <rect x={x0} y={wallTop} width={x1 - x0} height={t} fill={P.wallDeep} />
      <rect x={x0} y={wallTop} width={x1 - x0} height={3} fill={P.wallShade} />
      {[x0, ROOMS.living[1], ROOMS.kitchen[1], x1 - t].map((x) => (
        <g key={x}>
          <rect x={x} y={wallTop} width={t} height={base - wallTop} fill={P.wallDeep} />
          <rect x={x} y={wallTop} width={3} height={base - wallTop} fill={P.wallShade} />
        </g>
      ))}
      {/* the eaves' shadow on the cut wall tops */}
      <rect x={x0} y={wallTop + 8} width={x1 - x0} height={10} fill={P.ink} opacity={0.08} />
      <Living />
      <Kitchen />
      <Garage />
      {/* night: the rooms glow warm */}
      {[ROOMS.living, ROOMS.kitchen, ROOMS.garage].map(([a, b], i) => (
        <g key={a} className="sc-light" style={nightStyle(0.3 + i * 0.1)}>
          <rect x={a} y={wallTop + t} width={b - a} height={base - wallTop - t} fill={P.honeyLight} opacity={0.14} />
        </g>
      ))}
    </>
  );
});

function Living() {
  const [a] = ROOMS.living;
  const b = H.base - 22;
  return (
    <>
      {/* a picture with its shadow on the wall */}
      <rect x={a + 74} y={684} width={86} height={64} fill={P.ink} opacity={0.08} />
      <rect x={a + 70} y={680} width={86} height={64} fill={P.bark} />
      <rect x={a + 70} y={680} width={86} height={3} fill={mix(P.bark, P.trim, 0.3)} />
      <rect x={a + 76} y={686} width={74} height={52} fill={mix(P.skyTop, P.sageLight, 0.4)} />
      <path d={`M${a + 76} ${724}L${a + 104} ${704}L${a + 124} ${718}L${a + 150} ${700}V${738}H${a + 76}Z`} fill={P.sage} />
      {/* a rug and the sofa: lit seat and back, shaded front and right arm, its shadow on the floor */}
      <ellipse cx={a + 140} cy={b + 8} rx={130} ry={8} fill={mix(P.clothSky, P.wall, 0.4)} />
      <ellipse cx={a + 150} cy={b} rx={126} ry={7} fill={P.ink} opacity={0.16} />
      <rect x={a + 40} y={b - 74} width={190} height={48} rx={14} fill={P.pineLight} />
      <rect x={a + 30} y={b - 40} width={210} height={40} rx={10} fill={P.pine} />
      <rect x={a + 40} y={b - 50} width={190} height={14} rx={7} fill={P.pineLighter} />
      <rect x={a + 46} y={b - 70} width={90} height={8} rx={4} fill={P.pineLighter} opacity={0.6} />
      <rect x={a + 26} y={b - 56} width={26} height={56} rx={9} fill={P.pineLight} />
      <rect x={a + 218} y={b - 56} width={26} height={56} rx={9} fill={P.pineDark} />
      {/* the floor lamp beside it (on at night) */}
      <g transform={`translate(${a + 262} ${b})`}>
        <ellipse cx={4} cy={0} rx={18} ry={3} fill={P.ink} opacity={0.14} />
        <rect x={-2} y={-150} width={4} height={150} fill={P.brassDark} />
        <rect x={-2} y={-150} width={1.6} height={150} fill={P.honey} />
        <TableLamp x={0} base={-120} h={60} i={0} />
      </g>
    </>
  );
}

function Kitchen() {
  const [a, c] = ROOMS.kitchen;
  const b = H.base - 22;
  return (
    <>
      {/* a window onto the sky, its sill casting a line of shadow */}
      <rect x={a + 46} y={650} width={88} height={92} fill={P.trim} />
      <rect x={a + 52} y={656} width={76} height={80} fill={mix(P.skyTop, P.goldBottom, 0.4)} />
      <path d={`M${a + 52} ${720}C${a + 80} ${708} ${a + 104} ${712} ${a + 128} ${704}V736H${a + 52}Z`} fill={mix(P.sage, P.skyTop, 0.3)} />
      <rect x={a + 52} y={656} width={76} height={5} fill={P.ink} opacity={0.1} />
      <rect x={a + 89} y={656} width={4} height={80} fill={P.trim} />
      <rect x={a + 40} y={742} width={100} height={6} fill={P.trimShade} />
      {/* upper shelf, counter, lower cabinets */}
      <rect x={a + 10} y={762} width={c - a - 20} height={8} fill={P.trimShade} />
      <rect x={a + 12} y={770} width={c - a - 24} height={6} fill={P.ink} opacity={0.06} />
      <rect x={a + 14} y={b - 82} width={c - a - 28} height={82} fill={mix(P.wall, P.wallShade, 0.4)} />
      <rect x={a + 10} y={b - 92} width={c - a - 20} height={10} fill={P.stone} />
      <rect x={a + 10} y={b - 92} width={c - a - 20} height={3} fill={mix(P.stone, P.trim, 0.5)} />
      <rect x={a + 14} y={b - 82} width={c - a - 28} height={6} fill={P.ink} opacity={0.1} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={a + 20 + i * 52} y={b - 74} width={44} height={66} rx={3} fill={P.wall} />
          <rect x={a + 20 + i * 52 + 30} y={b - 74} width={14} height={66} rx={3} fill={P.wallShade} opacity={0.6} />
          <rect x={a + 36 + i * 52} y={b - 66} width={12} height={3} rx={1.5} fill={P.brass} />
        </g>
      ))}
      <rect x={a + 14} y={b - 4} width={c - a - 28} height={4} fill={P.ink} opacity={0.14} />
      {/* a pot and a bread tin on the counter, each with its shadow */}
      <ellipse cx={a + 74} cy={b - 92} rx={16} ry={2.5} fill={P.ink} opacity={0.18} />
      <rect x={a + 60} y={b - 112} width={22} height={20} rx={4} fill={P.pine} />
      <rect x={a + 60} y={b - 112} width={9} height={20} rx={4} fill={P.pineLight} />
      <ellipse cx={a + 138} cy={b - 92} rx={18} ry={2.5} fill={P.ink} opacity={0.18} />
      <rect x={a + 120} y={b - 104} width={30} height={12} rx={3} fill={P.honey} />
      <rect x={a + 120} y={b - 104} width={30} height={3} rx={1.5} fill={P.honeyLight} />
    </>
  );
}

function Garage() {
  const c = ROOMS.garage[1];
  const b = H.base - 22;
  const hx = HEATER.x;
  return (
    <>
      {/* a shelf with a box on the back wall, beside the heater */}
      <rect x={c - 60} y={792} width={50} height={6} fill={P.timberShade} />
      <rect x={c - 58} y={798} width={46} height={5} fill={P.ink} opacity={0.08} />
      <rect x={c - 54} y={768} width={30} height={24} fill={P.soil} />
      <rect x={c - 54} y={768} width={12} height={24} fill={mix(P.soil, P.trim, 0.25)} />
      {/* the water heater: a cylinder lit on its left, pipes to the ceiling, a small tank badge */}
      <g>
        <path d={`M${hx + 21} ${HEATER.top + 6}V${HEATER.top - 36}H${H.x1 - H.t}`} fill="none" stroke={P.slateLight} strokeWidth={6} />
        <path d={`M${hx + 61} ${HEATER.top + 6}V${HEATER.top - 20}H${H.x1 - H.t}`} fill="none" stroke={P.amber} strokeWidth={6} opacity={0.8} />
        <ContactShadow cx={hx + HEATER.w / 2 + 8} cy={b} rx={60} ry={7} strength={1.3} />
        <rect x={hx} y={HEATER.top} width={HEATER.w} height={b - HEATER.top} rx={14} fill={mix(P.trim, P.stone, 0.4)} />
        <rect x={hx + HEATER.w * 0.55} y={HEATER.top} width={HEATER.w * 0.45} height={b - HEATER.top} rx={14} fill={P.stoneShade} />
        <rect x={hx + 8} y={HEATER.top + 10} width={10} height={b - HEATER.top - 20} rx={5} fill={P.trim} opacity={0.7} />
        <ellipse cx={hx + HEATER.w / 2} cy={HEATER.top + 4} rx={HEATER.w / 2} ry={8} fill={P.stone} />
        <ellipse cx={hx + HEATER.w / 2 - 6} cy={HEATER.top + 2} rx={HEATER.w / 4} ry={4} fill={mix(P.stone, P.trim, 0.5)} />
        <rect x={hx + 26} y={b - 56} width={30} height={20} rx={3} fill={P.slate} />
        <rect x={hx + 26} y={b - 56} width={30} height={4} rx={2} fill={P.slateLight} />
      </g>
    </>
  );
}

/** The planting along the foundation: bushes against the base, the front step, the mailbox. */
const Planting = memo(function Planting() {
  const { base } = H;
  return (
    <>
      {/* the front step (lit tread, shaded riser) */}
      <rect x={784} y={base + 1} width={60} height={12} fill={P.stoneShade} />
      <rect x={784} y={base + 1} width={60} height={4} fill={P.stone} />
      <Bush x={694} base={base + 20} size={84} seed={2} />
      <Bush x={742} base={base + 22} size={40} seed={5} bloom={P.honey} />
      <Bush x={1036} base={base + 22} size={50} seed={7} bloom={P.jacarandaLight} />
      <Bush x={1094} base={base + 22} size={34} seed={9} />
      <Bush x={1460} base={base + 20} size={88} seed={4} />
      <Mailbox x={650} base={960} />
    </>
  );
});

/**
 * The heater's glow (amber while it ages, pulsing; pine once the replacement is covered) and its label (a
 * status line with a coloured rule, amber then pine). HTML over the world, positioned in world units.
 */
function Heater({ phase, reduce }: { phase: number; reduce: boolean }) {
  const { t } = useLang();
  const calm = phase === 2;
  const box = { left: pctX(HEATER.x - 90), top: pctY(HEATER.top - 50), width: pctX(HEATER.w + 180), height: pctY(H.base - HEATER.top + 70) };
  return (
    <>
      <motion.div className="absolute" style={box} initial={false} animate={{ opacity: calm ? 0 : 1 }} transition={{ duration: reduce ? 0 : 0.8 }}>
        <div className={`h-full w-full ${reduce ? '' : 'sc-amb sc-pulse'}`} style={{ background: `radial-gradient(closest-side, ${P.honey}, transparent)`, opacity: 0.7 }} />
      </motion.div>
      <motion.div className="absolute" style={{ ...box, background: `radial-gradient(closest-side, ${P.pineLighter}, transparent)` }} initial={false} animate={{ opacity: calm ? 0.32 : 0 }} transition={{ duration: reduce ? 0 : 0.8 }} />
      <div className="absolute portrait:-translate-y-[1.3em]" style={{ left: pctX(1226), top: pctY(636), fontSize: 'max(11px, calc(var(--s) * 15))' }}>
        <p className={`max-w-[9em] border-l-2 pl-[0.5em] font-medium leading-[1.3] transition-colors duration-500 lg:max-w-none lg:whitespace-nowrap ${calm ? 'border-pine text-pine' : 'border-signal-amber text-signal-amber'}`}>{t('landing.fixHeater')}</p>
      </div>
    </>
  );
}

/** The savings meter on the garage wall: a glass tube full of pine at rest; on a replay it empties and fills. */
function Meter({ phase, reduce }: { phase: number; reduce: boolean }) {
  const { t } = useLang();
  const fill = phase === 0 ? 0 : 1;
  return (
    <>
      <div className="absolute" style={{ left: pctX(METER.x), top: pctY(METER.top), width: pctX(24), height: pctY(METER.h) }}>
        <div className="absolute inset-0 overflow-hidden rounded-full" style={{ background: P.trim, border: `2px solid ${P.wallDeep}` }}>
          <motion.div
            className="absolute inset-x-0 bottom-0 h-full origin-bottom"
            style={{ background: P.pine }}
            initial={false}
            animate={{ scaleY: fill }}
            transition={reduce ? { duration: 0 } : phase === 1 ? { duration: T.fillDur, ease: ease.inOut } : { duration: 0.3, ease: ease.out }}
          />
        </div>
      </div>
      <div className="absolute" style={{ left: pctX(METER.x - 22), top: pctY(METER.top - 40), fontSize: 'max(11px, calc(var(--s) * 15))' }}>
        <p className="tnum whitespace-nowrap border-l-2 border-pine pl-[0.5em] font-medium leading-[1.3] text-ink">{t('landing.fixMeter')}</p>
      </div>
      <motion.div className="absolute" style={{ left: pctX(METER.x - 22), top: pctY(METER.top + METER.h + 12), fontSize: 'max(11px, calc(var(--s) * 14))' }} initial={false} animate={{ opacity: phase === 2 ? 1 : 0, y: phase === 2 ? 0 : 4 }} transition={{ duration: reduce ? 0 : 0.3 }}>
        <p className="whitespace-nowrap font-medium text-pine">{t('landing.fixReady')}</p>
      </motion.div>
    </>
  );
}

/** Sidewalk, curb and street along the bottom of the yard, street lamps along the sidewalk. */
const Street = memo(function Street() {
  return (
    <>
      <defs>
        <linearGradient id="rp-walk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(P.stone, P.trim, 0.3)} />
          <stop offset="1" stopColor={P.stone} />
        </linearGradient>
        <linearGradient id="rp-road" x1="0" y1="994" x2="0" y2="1200" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={mix(P.asphaltLight, P.goldBottom, 0.25)} />
          <stop offset="1" stopColor={P.asphalt} />
        </linearGradient>
      </defs>
      <rect x={-700} y={962} width={3000} height={6} fill={P.ink} opacity={0.06} />
      <rect x={-700} y={966} width={3000} height={22} fill="url(#rp-walk)" />
      {Array.from({ length: 38 }, (_, i) => (
        <rect key={i} x={-700 + i * 80} y={966} width={2} height={22} fill={P.stoneShade} />
      ))}
      <rect x={-700} y={988} width={3000} height={6} fill={P.stoneShade} />
      <rect x={-700} y={994} width={3000} height={200} fill="url(#rp-road)" />
      <rect x={-700} y={994} width={3000} height={5} fill={P.ink} opacity={0.12} />
      {Array.from({ length: 40 }, (_, i) => (
        <rect key={i} x={-700 + i * 80 + 20} y={1046} width={40} height={4} rx={2} fill={P.trim} opacity={0.7} />
      ))}
      {[80, 380, 600].map((x, i) => (
        <StreetLamp key={x} x={x} base={978} h={112} i={i} pool={2.4} />
      ))}
    </>
  );
});

/** Near planting at the bottom corners (the fastest layer): grassy mounds with flowering bushes. */
const Near = memo(function Near() {
  return (
    <>
      <defs>
        <linearGradient id="rp-near" x1="0" y1="990" x2="0" y2="1100" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={mix(P.sage, P.foliageLight, 0.4)} />
          <stop offset="1" stopColor={P.foliage} />
        </linearGradient>
      </defs>
      <path d="M-700 1004C-300 996 -20 990 90 998C150 1004 196 1022 210 1060V1300H-700Z" fill="url(#rp-near)" />
      <path d="M1410 1064C1430 1026 1490 1006 1600 1000C1900 994 2100 998 2300 1002V1300H1410Z" fill="url(#rp-near)" />
      <Bush x={40} base={1018} size={130} seed={11} bloom={P.honey} />
      <Bush x={160} base={1040} size={70} seed={12} />
      <Bush x={1520} base={1026} size={124} seed={13} bloom={P.jacarandaLight} />
    </>
  );
});
