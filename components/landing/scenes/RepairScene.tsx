'use client';
import { memo, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { P, mix } from '@/lib/illustrationPalette';
import { Layer, SceneRoot, useSceneMount } from './Scene';
import { CloudShape, Jacaranda, Palm, RoundTree, Shrub, StreetLamp, TableLamp, nightStyle } from './parts';
import { Mailbox } from '@/components/scenery/parts';

/**
 * Section 3, "Fix it before it breaks": the family's house in late-afternoon light, opened up like a
 * dollhouse. Its front wall is cut away: the living room (sofa, floor lamp, a picture), the kitchen (counter,
 * cabinets, a window onto the sky) and the garage, where the eleven-year-old water heater glows amber. On
 * each activation a savings meter on the garage wall fills ("Set aside $18/month"), and when it is full the
 * glow calms from amber to pine: the replacement is covered before anything breaks.
 *
 * Around the house: the hills and the Saddleback ridge behind, the yard with a path, a jacaranda, a palm and
 * shrubs, the sidewalk and street along the bottom with four street lamps. The sky above the left half is
 * empty for the text. One world (1600×1100) seen through two cameras like the other outdoor scenes: wide
 * screens see the whole yard, phones the house under the text.
 * Layers: sky and ridge 0.38 · hills 0.7 · yard, house, street 1 · near grass 1.2. Ambient (only while settled
 * here): the amber glow pulses until it calms; clouds drift. Night (dark theme): the street lamps come on one
 * after another, the rooms light up, the floor lamp too.
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

export const RepairScene = memo(function RepairScene({ play, reduce, night = false }: { play: number; reduce: boolean; night?: boolean }) {
  const mounted = useSceneMount(2);
  // 0 aging (amber) · 1 filling · 2 covered (calm)
  const [phase, setPhase] = useState(reduce ? 2 : 0);
  useEffect(() => {
    if (reduce) return;
    setPhase(0);
    if (play === 0) return;
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
              <div className="absolute" style={{ left: pctX(1060), top: pctY(140), width: pctX(250) }}>
                <svg viewBox="0 0 200 84" className="sc-amb sc-drift block h-auto w-full" style={{ animationDelay: '-6s' }}>
                  <CloudShape shade={0.1} />
                </svg>
              </div>
              <svg viewBox={`0 0 ${W.w} ${W.h}`} className="absolute inset-0 h-full w-full overflow-visible">
                <Ridge />
              </svg>
            </Stage>
          </Layer>
          <Layer speed={0.7}>
            <Stage>
              <svg viewBox={`0 0 ${W.w} ${W.h}`} className="absolute inset-0 h-full w-full overflow-visible">
                <Hills />
              </svg>
            </Stage>
          </Layer>
          <Layer speed={1}>
            <Stage>
              <svg viewBox={`0 0 ${W.w} ${W.h}`} className="absolute inset-0 h-full w-full overflow-visible">
                <Yard />
                <House />
                <Street />
              </svg>
              <Heater phase={phase} reduce={reduce} />
              <Meter key={play} phase={phase} reduce={reduce} />
            </Stage>
          </Layer>
          <Layer speed={1.2}>
            <Stage>
              <svg viewBox={`0 0 ${W.w} ${W.h}`} className="absolute inset-0 h-full w-full overflow-visible">
                <Near />
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
      <span className="absolute right-[calc(8%_-_26px)] top-[calc(7%_-_26px)] block h-[80px] w-[80px]" style={{ background: `radial-gradient(closest-side, ${P.honeyLight}, transparent)`, opacity: 0.35 }} />
      <span className="absolute right-[8%] top-[7%] block h-[28px] w-[28px] rounded-full" style={{ background: P.moon }} />
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

/** The yard: a lawn from the hills down to the sidewalk, light from the left, a path to the door, trees. */
const Yard = memo(function Yard() {
  return (
    <>
      <defs>
        <linearGradient id="sc-rp-lawn" x1={0} y1={560} x2={0} y2={1000} gradientUnits="userSpaceOnUse">
          <stop offset={0} stopColor={mix(P.sageLight, P.goldTop, 0.3)} />
          <stop offset={1} stopColor={P.sage} />
        </linearGradient>
      </defs>
      <path d="M-700 640C-300 626 100 612 400 616C700 620 1000 600 1300 596C1600 592 1900 600 2300 610V1300H-700Z" fill="url(#sc-rp-lawn)" />
      <path d="M-700 640C-300 626 100 612 400 616C700 620 1000 600 1300 596C1600 592 1900 600 2300 610" fill="none" stroke={P.goldTop} strokeWidth={4} opacity={0.7} />
      {/* the long shadow the house casts on the lawn, to the right */}
      <path d={`M${H.x1} ${H.base}L${H.x1 + 260} ${H.base - 18}L${H.x1 + 420} ${H.base + 14}L${H.x1 + 30} ${H.base + 22}Z`} fill={P.ink} opacity={0.07} />
      {/* path from the sidewalk to the door */}
      <path d={`M846 ${H.base + 16}L884 ${H.base + 16}L910 966H820Z`} fill={P.stone} />
      <RoundTree x={560} base={700} r={30} />
      <Jacaranda x={420} base={760} r={38} />
      <Palm x={1530} base={820} h={260} lean={-8} sway={false} />
      <RoundTree x={300} base={640} r={20} haze={0.2} hazeTo={P.goldBottom} />
      <Shrub x={680} base={H.base + 8} r={24} />
      <Shrub x={1462} base={H.base + 10} r={22} />
      <g transform={`translate(930 ${H.base + 52}) scale(1.6)`}>
        <Mailbox x={0} base={0} />
      </g>
    </>
  );
});

/**
 * The house in section: slab, thick cut walls, the gable roof with its attic, and three rooms seen from the
 * front, each with its own back wall, floor and furniture. Night slot: a warm wash in each room.
 */
const House = memo(function House() {
  const { x0, x1, base, wallTop, peak, t } = H;
  const mid = (x0 + x1) / 2;
  const room = (a: number, b: number, wall: string, floor: string) => (
    <>
      <rect x={a} y={wallTop + t} width={b - a} height={base - wallTop - t} fill={wall} />
      <rect x={a} y={base - 22} width={b - a} height={22} fill={floor} />
      <rect x={a} y={base - 24} width={b - a} height={3} fill={mix(floor, P.trim, 0.3)} />
      {/* light falling off toward the right of each room (the sun is on the left) */}
      <rect x={a + (b - a) * 0.55} y={wallTop + t} width={(b - a) * 0.45} height={base - wallTop - t - 22} fill={P.wallShade} opacity={0.35} />
    </>
  );
  return (
    <>
      {/* ground slab */}
      <rect x={x0 - 24} y={base} width={x1 - x0 + 48} height={18} fill={P.stoneShade} />
      <rect x={x0 - 24} y={base} width={x1 - x0 + 48} height={4} fill={P.stone} />
      {/* attic under the roof, then the roof in section */}
      <path d={`M${x0 + 10} ${wallTop}L${mid} ${peak + 26}L${x1 - 10} ${wallTop}Z`} fill={mix(P.timber, P.wallShade, 0.5)} />
      <path d={`M${mid - 140} ${wallTop - 6}L${mid} ${peak + 34}L${mid + 140} ${wallTop - 6}`} fill="none" stroke={P.timberShade} strokeWidth={8} />
      <rect x={x0 + 40} y={wallTop - 8} width={x1 - x0 - 80} height={8} fill={P.timberShade} />
      <path d={`M${x0 - 34} ${wallTop + 8}L${mid} ${peak - 6}L${x1 + 34} ${wallTop + 8}L${x1 + 8} ${wallTop + 8}L${mid} ${peak + 22}L${x0 - 8} ${wallTop + 8}Z`} fill={P.slate} />
      <path d={`M${x0 - 34} ${wallTop + 8}L${mid} ${peak - 6}L${mid} ${peak + 10}L${x0 - 18} ${wallTop + 8}Z`} fill={P.slateLight} />
      <rect x={mid + 120} y={peak + 40} width={34} height={70} fill={P.stone} />
      {/* rooms */}
      {room(ROOMS.living[0], ROOMS.living[1], P.wall, P.timber)}
      {room(ROOMS.kitchen[0], ROOMS.kitchen[1], mix(P.wall, P.skyTop, 0.35), mix(P.stone, P.timber, 0.3))}
      {room(ROOMS.garage[0], ROOMS.garage[1], mix(P.wall, P.stone, 0.55), P.stoneShade)}
      {/* cut walls and ceiling (thick, darker: the section) */}
      <rect x={x0} y={wallTop} width={x1 - x0} height={t} fill={P.wallDeep} />
      {[x0, ROOMS.living[1], ROOMS.kitchen[1], x1 - t].map((x) => (
        <rect key={x} x={x} y={wallTop} width={t} height={base - wallTop} fill={P.wallDeep} />
      ))}
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
      {/* a picture */}
      <rect x={a + 70} y={680} width={86} height={64} fill={P.bark} />
      <rect x={a + 76} y={686} width={74} height={52} fill={mix(P.skyTop, P.sageLight, 0.4)} />
      <path d={`M${a + 76} ${724}L${a + 104} ${704}L${a + 124} ${718}L${a + 150} ${700}V${738}H${a + 76}Z`} fill={P.sage} />
      {/* sofa: lit seat and back, shaded front */}
      <rect x={a + 40} y={b - 74} width={190} height={48} rx={14} fill={P.pineLight} />
      <rect x={a + 30} y={b - 40} width={210} height={40} rx={10} fill={P.pine} />
      <rect x={a + 40} y={b - 50} width={190} height={14} rx={7} fill={P.pineLighter} />
      <rect x={a + 26} y={b - 56} width={26} height={56} rx={9} fill={P.pineLight} />
      <rect x={a + 218} y={b - 56} width={26} height={56} rx={9} fill={P.pineDark} />
      {/* the floor lamp beside it (on at night) */}
      <g transform={`translate(${a + 262} ${b})`}>
        <rect x={-2} y={-150} width={4} height={150} fill={P.brassDark} />
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
      {/* a window onto the sky */}
      <rect x={a + 46} y={650} width={88} height={92} fill={P.trim} />
      <rect x={a + 52} y={656} width={76} height={80} fill={mix(P.skyTop, P.goldBottom, 0.4)} />
      <rect x={a + 89} y={656} width={4} height={80} fill={P.trim} />
      {/* upper cabinets, counter, lower cabinets */}
      <rect x={a + 10} y={760} width={c - a - 20} height={8} fill={P.trimShade} />
      <rect x={a + 10} y={b - 92} width={c - a - 20} height={10} fill={P.stone} />
      <rect x={a + 14} y={b - 82} width={c - a - 28} height={82} fill={mix(P.wall, P.wallShade, 0.4)} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={a + 20 + i * 52} y={b - 74} width={44} height={66} rx={3} fill={P.wall} />
      ))}
      <rect x={a + 60} y={b - 112} width={22} height={20} rx={4} fill={P.pine} />
      <rect x={a + 120} y={b - 104} width={30} height={12} rx={3} fill={P.honey} />
    </>
  );
}

function Garage() {
  const c = ROOMS.garage[1];
  const b = H.base - 22;
  return (
    <>
      {/* a shelf with a box on the back wall, beside the heater */}
      <rect x={c - 60} y={792} width={50} height={6} fill={P.timberShade} />
      <rect x={c - 54} y={768} width={30} height={24} fill={P.soil} />
      {/* the water heater: a cylinder lit on its left, pipes to the ceiling, a small tank badge */}
      <g>
        {/* cold and hot pipes: up from the tank, then into the side wall */}
        <path d={`M${HEATER.x + 21} ${HEATER.top + 6}V${HEATER.top - 36}H${H.x1 - H.t}`} fill="none" stroke={P.slateLight} strokeWidth={6} />
        <path d={`M${HEATER.x + 61} ${HEATER.top + 6}V${HEATER.top - 20}H${H.x1 - H.t}`} fill="none" stroke={P.amber} strokeWidth={6} opacity={0.8} />
        <rect x={HEATER.x} y={HEATER.top} width={HEATER.w} height={b - HEATER.top} rx={14} fill={mix(P.trim, P.stone, 0.4)} />
        <rect x={HEATER.x + HEATER.w * 0.55} y={HEATER.top} width={HEATER.w * 0.45} height={b - HEATER.top} rx={14} fill={P.stoneShade} />
        <rect x={HEATER.x + 8} y={HEATER.top + 10} width={10} height={b - HEATER.top - 20} rx={5} fill={P.trim} opacity={0.7} />
        <ellipse cx={HEATER.x + HEATER.w / 2} cy={HEATER.top + 4} rx={HEATER.w / 2} ry={8} fill={P.stone} />
        <rect x={HEATER.x + 26} y={b - 56} width={30} height={20} rx={3} fill={P.slate} />
      </g>
    </>
  );
}

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
      <div className="absolute" style={{ left: pctX(1226), top: pctY(636), fontSize: 'max(11px, calc(var(--s) * 15))' }}>
        <p className={`max-w-[9em] border-l-2 pl-[0.5em] font-medium leading-[1.3] transition-colors duration-500 lg:max-w-none lg:whitespace-nowrap ${calm ? 'border-pine text-pine' : 'border-signal-amber text-signal-amber'}`}>{t('landing.fixHeater')}</p>
      </div>
    </>
  );
}

/** The savings meter on the garage wall: a glass tube that fills pine on activation, its label above. */
function Meter({ phase, reduce }: { phase: number; reduce: boolean }) {
  const { t } = useLang();
  const fill = reduce || phase === 2 ? 1 : phase === 1 ? 1 : 0;
  return (
    <>
      <div className="absolute" style={{ left: pctX(METER.x), top: pctY(METER.top), width: pctX(24), height: pctY(METER.h) }}>
        <div className="absolute inset-0 overflow-hidden rounded-full" style={{ background: P.trim, border: `2px solid ${P.wallDeep}` }}>
          <motion.div
            className="absolute inset-x-0 bottom-0 h-full origin-bottom"
            style={{ background: P.pine }}
            initial={{ scaleY: reduce ? 1 : 0 }}
            animate={{ scaleY: fill }}
            transition={{ duration: reduce ? 0 : T.fillDur, ease: [0.45, 0, 0.55, 1] }}
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

/** Sidewalk, curb and street along the bottom of the yard, five street lamps along the sidewalk. */
const Street = memo(function Street() {
  return (
    <>
      <rect x={-700} y={966} width={3000} height={22} fill={P.stone} />
      <rect x={-700} y={988} width={3000} height={6} fill={P.stoneShade} />
      <rect x={-700} y={994} width={3000} height={200} fill={mix(P.asphaltLight, P.goldBottom, 0.2)} />
      {Array.from({ length: 40 }, (_, i) => (
        <rect key={i} x={-700 + i * 80 + 20} y={1046} width={40} height={4} rx={2} fill={P.trim} opacity={0.8} />
      ))}
      {[80, 380, 620, 1530].map((x, i) => (
        <StreetLamp key={x} x={x} base={978} h={112} i={i} pool={2.4} />
      ))}
    </>
  );
});

/** Near grass and flowers at the bottom corners (the fastest layer). */
const Near = memo(function Near() {
  return (
    <>
      <path d="M-700 1010C-300 1000 -40 996 80 1004C130 1008 160 1020 170 1040V1300H-700Z" fill={mix(P.sageDark, P.tree, 0.3)} />
      <path d="M1440 1030C1520 1004 1700 1000 2300 1006V1300H1440Z" fill={mix(P.sageDark, P.tree, 0.3)} />
      {[[30, 1000, P.honey], [96, 994, P.jacaranda], [1500, 1000, P.honey], [1580, 994, P.jacaranda]].map(([x, y, c], i) => (
        <g key={i}>
          <path d={`M${x} ${(y as number) + 40}V${(y as number) + 4}`} stroke={P.treeLight} strokeWidth={2} />
          <circle cx={x as number} cy={y as number} r={6} fill={c as string} />
        </g>
      ))}
    </>
  );
});

/** The far ridge (Santiago and Modjeska, the Saddleback), pale with distance, lit on its left faces. */
const Ridge = memo(function Ridge() {
  const far = mix(P.skyTop, P.slateLight, 0.3);
  return (
    <>
      <path d="M-700 500C-300 492 100 488 400 486C560 485 680 484 760 480C840 474 900 446 960 404C1000 376 1040 348 1080 330L1112 340L1140 344L1176 328L1210 318L1250 332C1300 350 1360 368 1440 384C1560 408 1720 426 1900 440C2100 454 2200 466 2300 470V700H-700Z" fill={far} opacity={0.55} />
      <path d="M1080 330L1112 340L1100 352C1090 346 1086 340 1080 330Z M1176 328L1210 318L1230 326C1210 330 1196 332 1176 328Z" fill={P.trim} opacity={0.35} />
      <path d="M960 404C1000 376 1040 348 1080 330L1070 352C1030 372 1000 392 960 404Z" fill={P.goldBottom} opacity={0.5} />
    </>
  );
});

/** Rolling hills: an orange grove in rows on the left, oaks on the right, rim-lit by the low sun. */
const Hills = memo(function Hills() {
  const haze = (c: string, k = 0.3) => mix(c, P.goldBottom, k);
  const grove: [number, number][] = [];
  for (let row = 0; row < 4; row++) for (let i = 0; i < 30 - row * 2; i++) grove.push([150 + i * 14 + row * 12, 522 + row * 11]);
  return (
    <>
      <defs>
        <linearGradient id="sc-rd-hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={haze(P.sageLight, 0.32)} />
          <stop offset="1" stopColor={haze(P.sage, 0.2)} />
        </linearGradient>
      </defs>
      <path d="M-700 530C-400 522 -100 516 0 515C120 512 200 505 250 505C360 506 440 520 500 520C600 520 680 506 750 500C840 492 900 474 950 455C1010 432 1060 416 1100 410C1170 396 1210 384 1250 380C1320 374 1360 372 1400 372C1460 374 1500 378 1550 385C1640 398 1700 410 1750 420C1900 436 2100 446 2300 450V800H-700Z" fill="url(#sc-rd-hill)" />
      {/* rim light along the crest (the sun is low on the left) */}
      <path d="M-700 530C-400 522 -100 516 0 515C120 512 200 505 250 505C360 506 440 520 500 520C600 520 680 506 750 500C840 492 900 474 950 455C1010 432 1060 416 1100 410C1170 396 1210 384 1250 380C1320 374 1360 372 1400 372" fill="none" stroke={P.goldTop} strokeWidth={4} opacity={0.8} />
      {/* the grove: rows of crowns merged into hedgerows, a lit top edge, long shadows to the right */}
      <path d={grove.map(([x, y]) => `M${x - 2} ${y + 1.5}h20v1.6h-20Z`).join('')} fill={P.ink} opacity={0.05} />
      <path d={grove.map(([x, y]) => `M${x - 6.4} ${y - 5}a6.4 6.4 0 1 0 12.8 0a6.4 6.4 0 1 0 -12.8 0Z`).join('')} fill={haze(P.tree, 0.52)} />
      <path d={grove.map(([x, y]) => `M${x - 5} ${y - 7.4}a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0 -6.4 0Z`).join('')} fill={haze(P.treeLight, 0.5)} />
      <path d={grove.filter((_, i) => i % 5 === 0).map(([x, y]) => `M${x + 1} ${y - 4}a1 1 0 1 0 2 0a1 1 0 1 0 -2 0Z`).join('')} fill={haze(P.amber, 0.35)} />
      {[[1560, 400, 15], [1610, 404, 12], [1700, 418, 16], [1850, 430, 14], [-120, 520, 14], [60, 512, 12]].map(([x, y, r]) => (
        <RoundTree key={x} x={x} base={y} r={r} haze={0.34} hazeTo={P.goldBottom} />
      ))}
      {/* a farmhouse far off on the right hill */}
      <g transform="translate(1480 392) scale(0.5)" opacity={0.85}>
        <path d="M0 0V-34L26 -54L52 -34V0Z" fill={haze(P.wall, 0.25)} />
        <path d="M26 -54L48 -66L76 -46L52 -34Z" fill={haze(P.slateLight, 0.3)} />
        <path d="M52 0V-34L76 -46V-12Z" fill={haze(P.wallShade, 0.3)} />
      </g>
    </>
  );
});

