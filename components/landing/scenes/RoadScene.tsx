'use client';
import { memo, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useLang } from '@/lib/i18n';
import { IsoHouse, isoPaths, isoPx } from '@/components/illustrations/IsoHouse';
import { HAIR, P, SKIN, mix } from '@/lib/illustrationPalette';
import { arcPath, type Pt } from '@/components/illustrations/landing/kit';
import { Layer, SceneRoot, useSceneMount } from './Scene';
import { BirdsShape, CloudShape, Cypress, Jacaranda, Lamp, Palm, RoundTree, Shrub, nightStyle, r1 } from './parts';

/**
 * Section 3, "See the road to your keys": a wide open landscape at golden hour, built for the car. The road
 * IS the background: it enters at the bottom-left foreground, sweeps right across the meadow, hairpins up,
 * crosses back left, hairpins again and climbs to the house on the hill at the upper right, where it ends in
 * the driveway. Layered hills (a Saddleback-style ridge, rolling hills with an orange grove, the meadow) and
 * trees are composed around that curve; the sky above the left half stays empty for the text. Light is low
 * from the left: warm glow on the horizon, long shadows falling right.
 *
 * The world is one 1600×1100 drawing seen through two cameras: wide screens see the whole valley
 * (scaled to the width, anchored at the bottom, extra height is sky); portrait phones see the right part,
 * hairpins and house, low in the frame under the text. Everything is placed in world units (% of the stage),
 * so the car drives exactly the road's path.
 *
 * On each activation the family's car drives in from the bottom-left (compositor: a Web Animation of
 * translate/scale/rotate sampled along the road; wheels turn with the distance travelled; it slows past each
 * milestone and around the hairpins, turning to face its way). Signposts pop up as it passes. It pulls into
 * the driveway, the porch light comes on, the door opens, a window lights. Then it idles.
 * Layers: sky and ridge 0.38 · hills 0.7 · valley, road, house, car 1 · near grass 1.2.
 * Night slots: headlights, porch, windows, two lamps by the house, stars.
 */
const W = { w: 1600, h: 1100 };
const pt = (x: number, y: number): Pt => ({ x, y });
const ROAD = arcPath([
  [pt(40, 1090), pt(160, 900), pt(420, 800), pt(660, 792)],
  [pt(660, 792), pt(900, 788), pt(1070, 744), pt(1006, 684)],
  [pt(1006, 684), pt(964, 646), pt(790, 676), pt(700, 630)],
  [pt(700, 630), pt(596, 584), pt(690, 546), pt(860, 540)],
  [pt(860, 540), pt(1000, 532), pt(1080, 520), pt(1150, 482)],
  [pt(1150, 482), pt(1200, 456), pt(1230, 450), pt(1268, 448)],
]);
const NEAR = 1090;
const FAR = 448;
/** depth 0 (far, at the house) … 1 (near, the bottom of the frame) */
const near = (y: number) => Math.max(0, Math.min(1, (y - FAR) / (NEAR - FAR)));
const roadW = (y: number) => 14 + near(y) * 150;
const carScale = (y: number) => 0.4 + near(y) * 1.15;
const HOUSE = { x: 1286, y: 454, size: 170 };
const HF = HOUSE.size / 92;
const DOOR = { x: HOUSE.x + (isoPaths.door.x + isoPaths.door.w / 2) * HF, y: HOUSE.y - 1 };
const DRIVE = { start: 0.35, dur: 4.6 };
const CAR = { w: 104, h: 58, ox: 52, oy: 50 };

type SignKey = 'collections' | 'savings' | 'orientation' | 'keys';
/** Signposts beside the road (world position of the post's foot) and where along the road the car passes them. */
const SIGN_DEFS: { key: SignKey; f: number; x: number; y: number }[] = [
  { key: 'collections', f: 0.16, x: 236, y: 846 },
  { key: 'savings', f: 0.43, x: 846, y: 744 },
  { key: 'orientation', f: 0.665, x: 612, y: 606 },
  { key: 'keys', f: 0.9, x: 1052, y: 497 },
];

const f1 = (v: number) => v.toFixed(1);

/** Everything about the drive, computed once: road shapes, signposts, keyframes, timings. */
const GEO = (() => {
  const N = 260;
  const L: Pt[] = [];
  const R: Pt[] = [];
  const CL: Pt[] = [];
  const CR: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const p = ROAD.at(i / N);
    const w = roadW(p.y) / 2;
    // the road's width lies on the ground: lateral offsets are foreshortened vertically
    const nx = -p.ty;
    const ny = p.tx * 0.42;
    L.push(pt(p.x - nx * w, p.y - ny * w));
    R.push(pt(p.x + nx * w, p.y + ny * w));
    const c = w * 1.12 + 2;
    CL.push(pt(p.x - nx * c, p.y - ny * c));
    CR.push(pt(p.x + nx * c, p.y + ny * c));
  }
  const poly = (a: Pt[], b: Pt[]) => `M${a.map((q) => `${f1(q.x)} ${f1(q.y)}`).join('L')}L${[...b].reverse().map((q) => `${f1(q.x)} ${f1(q.y)}`).join('L')}Z`;
  // centre dashes, shorter and thinner with distance
  let dashes = '';
  for (let f = 0.02; f < 0.97; ) {
    const p = ROAD.at(f);
    const s = carScale(p.y);
    const len = 15 * s;
    const q = ROAD.at(f + len / ROAD.total);
    const hw = 1.5 * s;
    const nx = -p.ty * hw;
    const ny = p.tx * hw * 0.5;
    dashes += `M${f1(p.x + nx)} ${f1(p.y + ny)}L${f1(q.x + nx)} ${f1(q.y + ny)}L${f1(q.x - nx)} ${f1(q.y - ny)}L${f1(p.x - nx)} ${f1(p.y - ny)}Z`;
    f += (len * 2.1) / ROAD.total;
  }
  // samples at even screen arc length → ground distance (wheel turns), curvature
  const M = 600;
  const S = Array.from({ length: M + 1 }, (_, i) => ROAD.at(i / M));
  const ground = [0];
  for (let i = 1; i <= M; i++) ground.push(ground[i - 1] + Math.hypot(S[i].x - S[i - 1].x, S[i].y - S[i - 1].y) / carScale((S[i].y + S[i - 1].y) / 2));
  const G = ground[M];
  const turn = S.map((p, i) => {
    const a = S[Math.max(0, i - 6)];
    const b = S[Math.min(M, i + 6)];
    return Math.abs(Math.atan2(b.ty, b.tx) - Math.atan2(a.ty, a.tx)) % (2 * Math.PI);
  });
  const signs = SIGN_DEFS.map((d) => ({ ...d, g: ground[Math.round(d.f * M)] / G, s: carScale(d.y) }));
  // speed along the ground: eases in, slows past each milestone and around the hairpins, brakes at the end
  const speed = (g: number, i: number) => {
    let v = Math.min(1, 0.35 + g / 0.08) * Math.min(1, 0.08 + (1 - g) / 0.12);
    for (const sg of signs) v *= 1 - 0.38 * Math.exp(-(((g - sg.g) / 0.035) ** 2));
    v *= 1 - Math.min(0.55, turn[i] * 0.9);
    return Math.max(0.06, v);
  };
  const time = [0];
  for (let i = 1; i <= M; i++) {
    const g0 = ground[i - 1] / G;
    const g1 = ground[i] / G;
    time.push(time[i - 1] + (g1 - g0) / speed((g0 + g1) / 2, i));
  }
  const T = time[M];
  const K = 150;
  const frames: Keyframe[] = [];
  const wheels: Keyframe[] = [];
  for (let k = 0; k <= K; k++) {
    const i = Math.round((k / K) * M);
    const p = S[i];
    const s = carScale(p.y);
    // facing: the car turns to face its way (a side view mirrored when heading left; narrow when heading away)
    const sx = Math.sign(p.tx || 1) * Math.max(0.08, Math.abs(p.tx));
    const tilt = Math.max(-12, Math.min(12, ((Math.atan(p.ty / (Math.abs(p.tx) < 0.02 ? 0.02 * Math.sign(p.tx || 1) : p.tx)) * 180) / Math.PI) * 0.5));
    const offset = time[i] / T;
    frames.push({
      offset,
      transform: `translate(${(((p.x - CAR.ox) / CAR.w) * 100).toFixed(2)}%, ${(((p.y - CAR.oy) / CAR.h) * 100).toFixed(2)}%) scale(${(s * sx).toFixed(3)}, ${s.toFixed(3)}) rotate(${tilt.toFixed(2)}deg)`,
    });
    wheels.push({ offset, transform: `rotate(${((ground[i] / 8) * (180 / Math.PI)).toFixed(1)}deg)` });
  }
  frames[0].offset = 0;
  frames[K].offset = 1;
  wheels[0].offset = 0;
  wheels[K].offset = 1;
  /** seconds after mount at which the car reaches ground fraction g */
  const at = (g: number) => {
    const i = Math.max(0, ground.findIndex((v) => v >= g * G));
    return DRIVE.start + (time[i] / T) * DRIVE.dur;
  };
  return { curb: poly(CL, CR), road: poly(L, R), dashes, signs, frames, wheels, at, end: DRIVE.start + DRIVE.dur };
})();
const END_FRAME = GEO.frames[GEO.frames.length - 1].transform as string;
const pctX = (x: number) => `${((x / W.w) * 100).toFixed(3)}%`;
const pctY = (y: number) => `${((y / W.h) * 100).toFixed(3)}%`;

export const RoadScene = memo(function RoadScene({ play, reduce, night = false }: { play: number; reduce: boolean; night?: boolean }) {
  const mounted = useSceneMount(2);
  return (
    <SceneRoot
      index={2}
      night={night}
      testId="road-scene"
      skyArt={ROAD_SKY}
      className="[container-type:size] [--by:1000] [--cx:800] [--s:min(calc(100cqw/1600),calc(100cqh/760))] portrait:[--by:960] portrait:[--cx:1000] portrait:[--s:min(calc(100cqw/960),calc(100cqh/1150))]"
    >
      {mounted && (
        <>
          <Layer speed={0.38}>
            <Stage>
              <Sky />
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
                <Valley />
              </svg>
              <Drive key={play} play={play} reduce={reduce} night={night} />
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

/** The low sun's glow on the left horizon, painted into the sky (it never moves with the ground); stars at night. */
const ROAD_SKY = (
  <>
    <div className="absolute left-[-34%] top-[26%] h-[64%] w-[84%]" style={{ background: `radial-gradient(closest-side, ${P.glow}, transparent)`, opacity: 0.62 }} />
    <div className="il-night absolute inset-0">
      {[[62, 8], [70, 4], [78, 11], [86, 6], [93, 13], [55, 3], [47, 9]].map(([x, y], i) => (
        <span key={i} className="absolute block h-[3px] w-[3px] rounded-full" style={{ left: `${x}%`, top: `${y}%`, background: P.star }} />
      ))}
      <span className="absolute right-[calc(8%-26px)] top-[calc(7%-26px)] block h-[80px] w-[80px]" style={{ background: `radial-gradient(closest-side, ${P.honeyLight}, transparent)`, opacity: 0.35 }} />
      <span className="absolute right-[8%] top-[7%] block h-[28px] w-[28px] rounded-full" style={{ background: P.moon }} />
    </div>
  </>
);

/** The world box: 1600×1100 units at the camera's scale (--s px per unit), positioned by the camera (--cx, --by). */
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="absolute"
      style={{
        left: 'calc(50cqw - var(--s) * var(--cx))',
        top: 'calc(100cqh - var(--s) * var(--by))',
        width: 'calc(var(--s) * 1600)',
        height: 'calc(var(--s) * 1100)',
      }}
    >
      {children}
    </div>
  );
}

/** Two clouds on the right, birds now and then; stars at night. (The low sun's glow is in the sky itself.) */
const Sky = memo(function Sky() {
  return (
    <>
      <svg viewBox={`0 0 ${W.w} ${W.h}`} className="absolute inset-0 h-full w-full overflow-visible">
        {[[1120, 120, 1.2], [1210, 70, 0.9], [1330, 140, 1], [1460, 90, 1.1], [1560, 160, 0.8], [980, 60, 0.8], [1400, 30, 0.9]].map(([x, y, r], i) => (
          <circle key={i} className="sc-light" style={nightStyle(0.2 + i * 0.06)} cx={x} cy={y} r={r * 2.2} fill={P.trim} />
        ))}
      </svg>
      <div className="absolute" style={{ left: pctX(1080), top: pctY(150), width: pctX(260) }}>
        <svg viewBox="0 0 200 84" className="sc-amb sc-drift block h-auto w-full" style={{ animationDelay: '-6s' }}>
          <CloudShape shade={0.1} />
        </svg>
      </div>
      <div className="absolute opacity-80" style={{ left: pctX(1400), top: pctY(240), width: pctX(170) }}>
        <svg viewBox="0 0 200 84" className="sc-amb sc-drift block h-auto w-full" style={{ animationDelay: '-20s' }}>
          <CloudShape shade={0.1} />
        </svg>
      </div>
      <svg viewBox="0 0 60 20" className="sc-amb sc-birds absolute left-0" style={{ top: pctY(260), width: pctX(70), animationDelay: '9s' }}>
        <BirdsShape />
      </svg>
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

/** The valley: the meadow climbing to the hill, the road with curbs and dashes, the driveway, trees, lamps. */
const Valley = memo(function Valley() {
  const gold = (c: string, k: number) => mix(c, P.goldTop, k);
  return (
    <>
      <defs>
        <linearGradient id="sc-rd-meadow" x1={0} y1={400} x2={0} y2={1100} gradientUnits="userSpaceOnUse">
          <stop offset={0} stopColor={gold(P.sageLight, 0.42)} />
          <stop offset={0.32} stopColor={gold(P.sageLight, 0.12)} />
          <stop offset={0.62} stopColor={P.sage} />
          <stop offset={1} stopColor={mix(P.sage, P.sageDark, 0.7)} />
        </linearGradient>
        <linearGradient id="sc-rd-asph" x1={0} y1={440} x2={0} y2={1100} gradientUnits="userSpaceOnUse">
          <stop offset={0} stopColor={mix(P.asphaltLight, P.goldBottom, 0.38)} />
          <stop offset={0.45} stopColor={mix(P.asphaltLight, P.goldBottom, 0.12)} />
          <stop offset={1} stopColor={P.asphalt} />
        </linearGradient>
        <radialGradient id="sc-rd-warm" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={P.honeyLight} stopOpacity="0.5" />
          <stop offset="1" stopColor={P.honeyLight} stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d="M-700 585C-400 578 -200 572 0 570C200 568 300 576 400 576C520 576 620 590 700 586C780 582 820 574 860 565C920 550 960 530 1000 510C1050 486 1090 466 1120 455C1170 436 1210 422 1240 418C1280 410 1310 405 1340 405C1390 405 1420 410 1460 420C1520 434 1560 444 1600 450C1700 466 1760 476 1800 480C2000 494 2200 500 2300 500V1400H-700Z"
        fill="url(#sc-rd-meadow)"
      />
      {/* the hill: its slope facing the low sun is warm, its far side turns into shade */}
      <ellipse cx={1080} cy={560} rx={360} ry={150} fill="url(#sc-rd-warm)" />
      <path d="M1340 405C1390 405 1420 410 1460 420C1520 434 1560 444 1600 450C1700 466 1760 476 1800 480C2000 494 2200 500 2300 500V760C2000 700 1700 640 1500 560C1430 530 1380 470 1340 405Z" fill={P.sageDark} opacity={0.28} />
      <path d="M-700 700C-300 690 0 700 300 720C600 740 900 760 1200 820C1500 880 1900 900 2300 900V1400H-700Z" fill={P.sageDark} opacity={0.12} />
      {/* sun-warmed crest */}
      <path d="M-700 585C-400 578 -200 572 0 570C200 568 300 576 400 576C520 576 620 590 700 586C780 582 820 574 860 565C920 550 960 530 1000 510C1050 486 1090 466 1120 455C1170 436 1210 422 1240 418C1280 410 1310 405 1340 405" fill="none" stroke={P.goldTop} strokeWidth={5} opacity={0.75} />
      {/* soft folds in the meadow */}
      <path d="M-200 680C100 660 300 700 520 700C700 700 820 680 980 650" fill="none" stroke={P.sageDark} strokeWidth={3} opacity={0.18} />
      <path d="M1040 900C1200 860 1400 860 1700 880" fill="none" stroke={P.sageDark} strokeWidth={4} opacity={0.18} />
      {/* trees behind the road (long shadows to the right) */}
      <Cypress x={1206} base={430} h={84} />
      <Cypress x={1226} base={432} h={70} />
      <RoundTree x={1110} base={474} r={20} />
      <Jacaranda x={1498} base={446} r={30} />
      <Palm x={1560} base={456} h={170} lean={-6} sway={false} />
      <Palm x={1588} base={462} h={136} lean={-3} sway={false} />
      <RoundTree x={900} base={562} r={18} />
      <RoundTree x={520} base={700} r={26} />
      <Shrub x={560} base={712} r={14} />
      <RoundTree x={300} base={610} r={20} />
      {/* curbs, asphalt, dashes */}
      <path d={GEO.curb} fill={mix(P.stone, P.goldTop, 0.2)} />
      <path d={GEO.road} fill="url(#sc-rd-asph)" />
      <path d={GEO.dashes} fill={P.trim} opacity={0.8} />
      {/* the driveway pad and the path to the door */}
      <path d="M1236 440L1300 440L1312 462L1240 463Z" fill={P.stone} />
      <path d="M1240 463L1312 462L1312 465L1240 466Z" fill={P.stoneShade} />
      <path d={`M${DOOR.x - 8} ${DOOR.y + 1}h16l3 8h-22Z`} fill={P.stone} />
      {/* the house's long shadow on the hill */}
      <path d={`M${HOUSE.x + 40} ${HOUSE.y}L${HOUSE.x + 160} ${HOUSE.y - 18}L${HOUSE.x + 300} ${HOUSE.y + 6}L${HOUSE.x + 140} ${HOUSE.y + 14}Z`} fill={P.ink} opacity={0.07} />
      <Lamp x={1190} base={474} h={46} light={0.2} />
      {/* trees in front of the road's lower legs */}
      <RoundTree x={1180} base={720} r={34} />
      <Shrub x={1236} base={734} r={18} />
      <RoundTree x={140} base={760} r={30} />
    </>
  );
});

/** Near grass and wildflowers at the bottom corners (the fastest layer). */
const Near = memo(function Near() {
  const tuft = (x: number, y: number, s: number, c: string) => <path key={`${x}-${y}`} d={`M${x} ${y}q${-8 * s} ${-18 * s} ${-14 * s} ${-26 * s}q${8 * s} ${10 * s} ${12 * s} ${18 * s}q${-1 * s} ${-16 * s} ${4 * s} ${-30 * s}q${2 * s} ${16 * s} ${4 * s} ${28 * s}q${6 * s} ${-12 * s} ${16 * s} ${-20 * s}q${-6 * s} ${12 * s} ${-8 * s} ${30 * s}Z`} fill={c} />;
  return (
    <>
      <path d="M200 1004C240 992 300 988 360 994C390 998 410 1006 420 1020V1300H200Z" fill={mix(P.sageDark, P.tree, 0.3)} />
      <path d="M1360 1010C1440 984 1600 976 1800 980C2000 984 2200 990 2300 990V1300H1360Z" fill={mix(P.sageDark, P.tree, 0.3)} />
      {[[226, 1004, 1.2], [270, 998, 1.5], [320, 1002, 1.1], [376, 1008, 1.3], [1400, 1006, 1.2], [1450, 996, 1.6], [1510, 1000, 1.2], [1570, 992, 1.5], [1640, 998, 1.3]].map(([x, y, s], i) =>
        tuft(x, y, s, i % 2 ? P.tree : P.treeLight),
      )}
      {[[252, 962, P.honey], [300, 956, P.jacaranda], [346, 968, P.honeyLight], [1470, 950, P.honey], [1530, 958, P.jacaranda], [1600, 946, P.honeyLight]].map(([x, y, c], i) => (
        <g key={i}>
          <path d={`M${x} ${(y as number) + 40}V${(y as number) + 4}`} stroke={P.treeLight} strokeWidth={2} />
          <circle cx={x as number} cy={y as number} r={6} fill={c as string} />
          <circle cx={(x as number) - 1.6} cy={(y as number) - 1.6} r={2.4} fill={P.trim} opacity={0.5} />
        </g>
      ))}
    </>
  );
});

/* ------------------------------------------------------------------ */
/* The drive                                                           */
/* ------------------------------------------------------------------ */

/** The car, the signposts and the house's lights; remounted (replayed) on each activation. */
function Drive({ play, reduce, night }: { play: number; reduce: boolean; night: boolean }) {
  const { t } = useLang();
  const car = useRef<HTMLDivElement>(null);
  const wheelA = useRef<HTMLDivElement>(null);
  const wheelB = useRef<HTMLDivElement>(null);
  const dip = useRef<HTMLDivElement>(null);
  const [passed, setPassed] = useState(reduce ? SIGN_DEFS.length : 0);
  // 0 driving · 1 parked, porch light · 2 door open · 3 window lit
  const [home, setHome] = useState(reduce ? 3 : 0);
  useEffect(() => {
    const el = car.current;
    if (!el || play === 0) return;
    if (reduce) {
      el.style.transform = END_FRAME;
      return;
    }
    const opts = { duration: DRIVE.dur * 1000, delay: DRIVE.start * 1000, fill: 'both' as const };
    const anims = [el.animate(GEO.frames, opts)];
    for (const w of [wheelA.current, wheelB.current]) if (w) anims.push(w.animate(GEO.wheels, opts));
    if (dip.current)
      anims.push(
        dip.current.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(2deg)', offset: 0.32 }, { transform: 'rotate(-0.6deg)', offset: 0.68 }, { transform: 'rotate(0deg)' }], {
          duration: 520,
          delay: (GEO.end - 0.06) * 1000,
          easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
          fill: 'both',
        }),
      );
    const timers = GEO.signs.map((sg, i) => setTimeout(() => setPassed((n) => Math.max(n, i + 1)), GEO.at(Math.max(0, sg.g - 0.05)) * 1000));
    timers.push(
      setTimeout(() => setHome(1), (GEO.end + 0.05) * 1000),
      setTimeout(() => setHome(2), (GEO.end + 0.3) * 1000),
      setTimeout(() => setHome(3), (GEO.end + 1.1) * 1000),
    );
    return () => {
      anims.forEach((a) => a.cancel());
      timers.forEach(clearTimeout);
    };
  }, [play, reduce]);
  const hp = isoPx(HOUSE.size, 0, 0);
  return (
    <>
      {/* warm light from the open door */}
      <motion.div
        className="absolute"
        style={{ left: pctX(DOOR.x - 34), top: pctY(DOOR.y - 14), width: pctX(68), aspectRatio: '2.6', background: `radial-gradient(closest-side, ${P.glow}, transparent)` }}
        initial={false}
        animate={{ opacity: home >= 2 ? 0.9 : 0 }}
        transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      />
      {/* the house at the end of the road */}
      <div className="absolute" style={{ left: pctX(HOUSE.x - hp.x), top: pctY(HOUSE.y - hp.y), width: pctX(HOUSE.size) }}>
        <IsoHouse size={HOUSE.size} porch={home >= 1 || night} doorOpen={home >= 2} lit={home >= 3 || night} ground={false} className="h-auto w-full" />
      </div>
      {/* signposts behind the road come first, then the car, then the ones in front */}
      {GEO.signs.map((sg, i) => (sg.y < roadYAt(sg.f) ? <Signpost key={sg.key} x={sg.x} y={sg.y} s={sg.s} z={2} label={t(`road.labels.${sg.key}`)} up={passed > i} reduce={reduce} /> : null))}
      <div
        ref={car}
        className="absolute left-0 top-0"
        style={{
          zIndex: 4,
          width: pctX(CAR.w),
          transformOrigin: `${(CAR.ox / CAR.w) * 100}% ${(CAR.oy / CAR.h) * 100}%`,
          transform: reduce ? END_FRAME : (GEO.frames[0].transform as string),
          visibility: play === 0 && !reduce ? 'hidden' : undefined,
          willChange: 'transform',
        }}
      >
        <div className={home >= 1 && !reduce ? 'sc-amb sc-idle' : undefined}>
          <Car reduce={reduce} wheelA={wheelA} wheelB={wheelB} dip={dip} parked={home >= 1} />
        </div>
      </div>
      {GEO.signs.map((sg, i) => (sg.y >= roadYAt(sg.f) ? <Signpost key={sg.key} x={sg.x} y={sg.y} s={sg.s} z={6} label={t(`road.labels.${sg.key}`)} up={passed > i} reduce={reduce} /> : null))}
    </>
  );
}
const roadYAt = (f: number) => ROAD.at(f).y;

/**
 * A guide sign: a pine panel with a white inset border and white text, on a shaded post, a contact shadow at
 * its foot. Pops up and wobbles to rest when the car passes. Anchored at the post's foot; sized by depth.
 */
const Signpost = memo(function Signpost({ x, y, s, z, label, up, reduce }: { x: number; y: number; s: number; z: number; label: string; up: boolean; reduce: boolean }) {
  return (
    <div className="absolute" style={{ left: pctX(x), top: pctY(y), zIndex: z, fontSize: `max(11px, calc(var(--s) * ${r1(18 * Math.max(0.62, s))}))` }}>
      <svg viewBox="0 0 40 10" className="absolute left-[-0.6em] top-[-0.3em] block h-[0.6em] w-[2.6em]">
        <ellipse cx={20} cy={5} rx={20} ry={5} fill={P.ink} opacity={0.16} />
      </svg>
      <motion.div
        className="absolute bottom-0 left-0 flex -translate-x-1/2 flex-col items-center"
        style={{ transformOrigin: '50% 100%' }}
        initial={reduce ? false : { opacity: 0, scale: 0.6, y: 10, rotate: 0 }}
        animate={up ? { opacity: 1, scale: 1, y: 0, rotate: [0, -7, 5, -2.5, 1, 0] } : { opacity: 0, scale: 0.6, y: 10, rotate: 0 }}
        transition={{ type: 'spring', duration: 0.5, bounce: 0.35, opacity: { duration: 0.15 }, rotate: { duration: 1, times: [0, 0.18, 0.4, 0.6, 0.8, 1], ease: 'easeOut' } }}
      >
        <span className="relative block whitespace-nowrap">
          <span className="absolute inset-0 translate-x-[0.18em] translate-y-[0.18em] rounded-[0.32em]" style={{ background: P.pineDark }} />
          <span className="relative block rounded-[0.32em] px-[0.85em] py-[0.42em] font-semibold leading-[1.15] text-white" style={{ background: `linear-gradient(170deg, ${P.pineLighter} 0%, ${P.pineLight} 30%, ${P.pine} 100%)` }}>
            <span className="absolute inset-[0.16em] rounded-[0.22em] border-[0.09em] opacity-85" style={{ borderColor: P.trim }} />
            {label}
          </span>
        </span>
        <span className="relative block h-[2.4em] w-[0.42em] rounded-b-[0.1em]" style={{ background: `linear-gradient(90deg, ${P.stone} 0 48%, ${P.stoneShade} 52% 100%)` }}>
          <span className="absolute left-1/2 top-[0.25em] block h-[0.2em] w-[0.2em] -translate-x-1/2 rounded-full" style={{ background: P.slateLight }} />
          <span className="absolute left-1/2 top-[0.75em] block h-[0.2em] w-[0.2em] -translate-x-1/2 rounded-full" style={{ background: P.slateLight }} />
        </span>
      </motion.div>
    </div>
  );
});

/**
 * The family's car, side on, facing right: a small SUV with a shaded pine body lit from the top-left, glass
 * with the family's silhouettes, door seams, mirror, roof rails, tail light, a contact shadow. Wheels are their
 * own layers (they turn); the body sits in a "dip" layer (the brake) and bobs on its suspension while it
 * drives. Night slot: the headlight beam. Parked: a little exhaust now and then. Box 104×58, contact (52, 50).
 */
type DivRef = React.RefObject<HTMLDivElement | null>;
const Car = memo(function Car({ reduce, wheelA, wheelB, dip, parked }: { reduce: boolean; wheelA: DivRef; wheelB: DivRef; dip: DivRef; parked: boolean }) {
  const id = 'sc-rd-car';
  const vb = `${-CAR.ox} ${-CAR.oy} ${CAR.w} ${CAR.h}`;
  const wheel = (cx: number, ref: DivRef) => (
    <div ref={ref} className="absolute" style={{ left: `${((cx - 9 + CAR.ox) / CAR.w) * 100}%`, top: `${((-17 + CAR.oy) / CAR.h) * 100}%`, width: `${(18 / CAR.w) * 100}%`, aspectRatio: '1' }}>
      <svg viewBox="-9 -9 18 18" className="block h-full w-full">
        <circle r={8.6} fill={P.ink} />
        <circle r={7.6} fill={P.slateDark} />
        <circle r={4.6} fill={P.stone} />
        {[0, 72, 144, 216, 288].map((a) => (
          <rect key={a} x={-0.9} y={-4.4} width={1.8} height={3.4} rx={0.6} fill={P.stoneShade} transform={`rotate(${a})`} />
        ))}
        <circle r={1.3} fill={P.slate} />
      </svg>
    </div>
  );
  return (
    <div className="relative" style={{ aspectRatio: `${CAR.w} / ${CAR.h}` }}>
      <svg viewBox={vb} className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <radialGradient id={`${id}-shadow`}>
            <stop offset="0" stopColor={P.ink} stopOpacity="0.3" />
            <stop offset="0.6" stopColor={P.ink} stopOpacity="0.12" />
            <stop offset="1" stopColor={P.ink} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx={10} cy={0.5} rx={60} ry={5.5} fill={`url(#${id}-shadow)`} />
      </svg>
      {parked && !reduce && (
        <div className="absolute left-[-6%] top-[62%] w-[14%]">
          {[0, 0.8].map((d) => (
            <svg key={d} viewBox="0 0 20 20" className="sc-amb sc-puff absolute left-0 top-0 block w-full" style={{ animationDelay: `${d}s` }}>
              <circle cx={10} cy={10} r={7} fill={P.trim} opacity={0.7} />
            </svg>
          ))}
        </div>
      )}
      <div ref={dip} className="absolute inset-0" style={{ transformOrigin: `${((30 + CAR.ox) / CAR.w) * 100}% ${((-8 + CAR.oy) / CAR.h) * 100}%` }}>
        <div className={`absolute inset-0 ${reduce ? '' : 'la-bob'}`} style={reduce ? undefined : { animationDelay: `${DRIVE.start}s`, animationIterationCount: Math.round(DRIVE.dur / 0.11) }}>
          <svg viewBox={vb} className="absolute inset-0 h-full w-full overflow-visible">
            <defs>
              <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0.2" y2="1">
                <stop offset="0" stopColor={P.pineLighter} />
                <stop offset="0.5" stopColor={P.pineLight} />
                <stop offset="1" stopColor={P.pine} />
              </linearGradient>
              <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={P.glassLight} />
                <stop offset="1" stopColor={P.glass} />
              </linearGradient>
              <radialGradient id={`${id}-beam`} cx="0" cy="0.5" r="1">
                <stop offset="0" stopColor={P.glow} stopOpacity="0.85" />
                <stop offset="0.35" stopColor={P.honeyLight} stopOpacity="0.45" />
                <stop offset="1" stopColor={P.honey} stopOpacity="0" />
              </radialGradient>
              <clipPath id={`${id}-win`}>
                <path d="M-30 -30L-21 -42H3V-30Z M6 -42H17L26 -31H6Z" />
              </clipPath>
            </defs>
            <ellipse className="sc-light" style={nightStyle(0)} cx={62} cy={-21} rx={30} ry={10} fill={`url(#${id}-beam)`} />
            <path d="M-39 -8A11 11 0 0 1 -17 -8Z" fill={P.ink} />
            <path d="M19 -8A11 11 0 0 1 41 -8Z" fill={P.ink} />
            <path d="M-48 -9V-24Q-48 -29 -42 -30L-33 -31L-23 -44Q-21 -46 -17 -46H18Q22 -46 24 -44L33 -33L45 -31Q50 -30 50 -24V-9Q50 -6 47 -6H41A11 11 0 0 0 19 -6H-17A11 11 0 0 0 -39 -6H-45Q-48 -6 -48 -9Z" fill={`url(#${id}-body)`} />
            <path d="M-48 -15H50V-9Q50 -6 47 -6H41A11 11 0 0 0 19 -6H-17A11 11 0 0 0 -39 -6H-45Q-48 -6 -48 -9Z" fill={P.pine} />
            <path d="M-17 -6H19V-9H-17Z" fill={P.pineDark} />
            <rect x={-19} y={-48.5} width={36} height={2} rx={1} fill={P.slate} />
            <path d="M-46 -26Q-46 -29 -41 -29.5L45 -29.5Q48 -29 48.5 -27" fill="none" stroke={P.pineLighter} strokeWidth={1.2} strokeLinecap="round" opacity={0.9} />
            <path d="M-30 -30L-21 -42H3V-30Z" fill={`url(#${id}-glass)`} />
            <path d="M6 -42H17L26 -31H6Z" fill={`url(#${id}-glass)`} />
            <g clipPath={`url(#${id}-win)`}>
              {[
                { x: -12, r: 4.6, sk: 2, h: 1, top: -35.5 },
                { x: -3, r: 3.6, sk: 2, h: 2, top: -34 },
                { x: 14, r: 4.8, sk: 1, h: 0, top: -36 },
              ].map((f) => (
                <g key={f.x}>
                  <ellipse cx={f.x} cy={-28} rx={f.r * 1.5} ry={f.r * 1.3} fill={mix(P.slate, P.glass, 0.4)} />
                  <circle cx={f.x} cy={f.top} r={f.r} fill={mix(SKIN[f.sk], P.glass, 0.4)} />
                  <path d={`M${f.x - f.r - 0.3} ${f.top + 0.6}A${f.r + 0.3} ${f.r + 0.3} 0 0 1 ${f.x + f.r + 0.3} ${f.top + 0.6}Q${f.x} ${f.top - f.r * 0.4} ${f.x - f.r - 0.3} ${f.top + 0.6}Z`} fill={mix(HAIR[f.h], P.glass, 0.3)} />
                </g>
              ))}
              <path d="M-26 -30L-17 -42H-12L-21 -30Z" fill={P.trim} opacity={0.3} />
              <path d="M10 -42H13L7 -33V-37Z" fill={P.trim} opacity={0.3} />
            </g>
            <rect x={3} y={-43} width={3} height={13} fill={P.pine} />
            <path d="M4.5 -30V-9" stroke={P.pineDark} strokeWidth={0.8} opacity={0.6} />
            <path d="M-30 -30V-12" stroke={P.pineDark} strokeWidth={0.8} opacity={0.5} />
            <rect x={-8} y={-26} width={5} height={1.4} rx={0.7} fill={P.pineDark} />
            <rect x={13} y={-26} width={5} height={1.4} rx={0.7} fill={P.pineDark} />
            <path d="M24 -33h5q2 0 2 2v1h-7Z" fill={P.pine} />
            <path d="M45 -25h4.5q1 0 1 1.5v2h-5.5Z" fill={P.glow} />
            <path d="M-48 -25h3.5v5h-3.5Z" fill={P.amber} />
            <rect x={44} y={-11} width={7} height={4} rx={1.5} fill={P.slate} />
            <rect x={-49} y={-11} width={7} height={4} rx={1.5} fill={P.slate} />
          </svg>
        </div>
      </div>
      {wheel(-28, wheelA)}
      {wheel(30, wheelB)}
    </div>
  );
});
