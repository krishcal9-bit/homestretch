'use client';
import { motion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { IsoHouse, isoPaths, isoPx } from '@/components/illustrations/IsoHouse';
import { Figure, type FigureKind } from '@/components/illustrations/Figure';
import { HAIR, P, SKIN, mix, type ClothKey } from '@/lib/illustrationPalette';
import { arcPath, alpha, KitDefs, Shade, Tree, useStaged, type Pt } from './kit';

/**
 * Scene 2: the road to the keys. A strip of neighborhood on a transparent background (it sits on the landing's
 * world): a hazy back hill with small houses and trees, a meadow with a road winding from the left to a shaded
 * house's driveway. The family's car drives in from the left (sampled along the road, transform only, on the
 * compositor): wheels turn with the distance travelled, the body bobs on its suspension, the headlights glow,
 * and it slows past each milestone, where a signpost pops up and wobbles. It pulls into the driveway and brakes
 * with a small forward dip; the porch light comes on, the front door opens onto warm light, and the family
 * steps out and walks in; then a window lights. Planes have scroll parallax (0.2x / 0.5x / 1x, max 12px).
 * Reduced motion: the car parked in the driveway, porch light on. Phones skip the back layer.
 */
const VB = { w: 600, h: 360 };
const pt = (x: number, y: number): Pt => ({ x, y });
const ROAD = arcPath([
  [pt(-70, 258), pt(14, 256), pt(80, 318), pt(176, 316)],
  [pt(176, 316), pt(256, 314), pt(246, 262), pt(306, 258)],
  [pt(306, 258), pt(336, 256), pt(362, 264), pt(394, 265)],
]);
/** Lateral road width at a screen height (a little narrower farther back). */
const roadW = (y: number) => 30 + (y - 240) * 0.26;
/** Depth scale for the car at a screen height. */
const depth = (y: number) => Math.max(0.9, Math.min(1.12, 0.93 + (y - 262) * 0.0034));
const HOUSE = { x: 448, y: 254, size: 150 };
const HF = HOUSE.size / 92;
const DOOR = { x: HOUSE.x + (isoPaths.door.x + isoPaths.door.w / 2) * HF, y: HOUSE.y - 1 };
const DRIVE = { start: 0.35, dur: 2.4 };
/** The car's box (viewBox units) and where its ground contact sits inside it. */
const CAR = { w: 104, h: 58, ox: 52, oy: 50 };

type SignDef = { key: 'collections' | 'savings' | 'orientation' | 'keys'; x: number; side: 'back' | 'front' };
const SIGN_DEFS: SignDef[] = [
  { key: 'collections', x: 64, side: 'back' },
  { key: 'savings', x: 186, side: 'front' },
  { key: 'orientation', x: 250, side: 'back' },
  { key: 'keys', x: 330, side: 'front' },
];

/** Everything about the drive, computed once: road shapes, sign spots, keyframes, timings. */
const GEO = (() => {
  const N = 160;
  const L: Pt[] = [];
  const R: Pt[] = [];
  const CL: Pt[] = [];
  const CR: Pt[] = [];
  const f1 = (v: number) => v.toFixed(1);
  for (let i = 0; i <= N; i++) {
    const p = ROAD.at(i / N);
    const w = roadW(p.y) / 2;
    // the road's width lies on the ground: lateral offsets are foreshortened vertically
    const nx = -p.ty;
    const ny = p.tx * 0.42;
    L.push(pt(p.x - nx * w, p.y - ny * w));
    R.push(pt(p.x + nx * w, p.y + ny * w));
    const c = w + 3.5;
    CL.push(pt(p.x - nx * c, p.y - ny * c));
    CR.push(pt(p.x + nx * c, p.y + ny * c));
  }
  const poly = (a: Pt[], b: Pt[]) => `M${a.map((q) => `${f1(q.x)} ${f1(q.y)}`).join('L')}L${[...b].reverse().map((q) => `${f1(q.x)} ${f1(q.y)}`).join('L')}Z`;
  let dashes = '';
  for (let f = 0.03; f < 0.86; ) {
    const p = ROAD.at(f);
    const s = depth(p.y);
    const len = 13 * s;
    const q = { x: p.x + p.tx * len, y: p.y + p.ty * len };
    const hw = 1.3 * s;
    const nx = -p.ty * hw;
    const ny = p.tx * hw * 0.5;
    dashes += `M${f1(p.x + nx)} ${f1(p.y + ny)}L${f1(q.x + nx)} ${f1(q.y + ny)}L${f1(q.x - nx)} ${f1(q.y - ny)}L${f1(p.x - nx)} ${f1(p.y - ny)}Z`;
    f += (len + 13 * s) / ROAD.total;
  }
  // samples at even screen arc length → ground distance (wheel turns) and road fraction
  const M = 400;
  const samples = Array.from({ length: M + 1 }, (_, i) => ROAD.at(i / M));
  const ground = [0];
  for (let i = 1; i <= M; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    ground.push(ground[i - 1] + Math.hypot(b.x - a.x, b.y - a.y) / depth((a.y + b.y) / 2));
  }
  const G = ground[M];
  const nearX = (x: number) => samples.reduce((best, p, i) => (Math.abs(p.x - x) < Math.abs(samples[best].x - x) ? i : best), 0);
  const signs = SIGN_DEFS.map((d) => {
    const i = nearX(d.x);
    const p = samples[i];
    const half = (roadW(p.y) / 2) * 0.42;
    return { ...d, g: ground[i] / G, y: d.side === 'back' ? p.y - half - 6 : p.y + half + 13, s: d.side === 'back' ? 0.84 : 1 };
  });
  // speed along the ground: eases in, slows past each milestone, brakes into the driveway
  const speed = (g: number) => {
    let v = Math.min(1, 0.32 + g / 0.1) * Math.min(1, 0.1 + (1 - g) / 0.16);
    for (const sg of signs) v *= 1 - 0.42 * Math.exp(-(((g - sg.g) / 0.04) ** 2));
    return Math.max(0.06, v);
  };
  const time = [0];
  for (let i = 1; i <= M; i++) {
    const g0 = ground[i - 1] / G;
    const g1 = ground[i] / G;
    time.push(time[i - 1] + (g1 - g0) / speed((g0 + g1) / 2));
  }
  const T = time[M];
  const K = 100; // keyframes
  const frames: Keyframe[] = [];
  const wheels: Keyframe[] = [];
  for (let k = 0; k <= K; k++) {
    const i = Math.round((k / K) * M);
    const p = samples[i];
    const s = depth(p.y);
    const tilt = Math.max(-9, Math.min(9, ((Math.atan2(p.ty, p.tx) * 180) / Math.PI) * 0.55));
    const offset = time[i] / T;
    frames.push({
      offset,
      opacity: Math.max(0, Math.min(1, (p.x + 30) / 70)),
      transform: `translate(${(((p.x - CAR.ox) / CAR.w) * 100).toFixed(2)}%, ${(((p.y - CAR.oy) / CAR.h) * 100).toFixed(2)}%) scale(${s.toFixed(3)}) rotate(${tilt.toFixed(2)}deg)`,
    });
    // wheel radius 8 (car units); screen distance / scale = distance in car units
    wheels.push({ offset, transform: `rotate(${((ground[i] / 8) * (180 / Math.PI)).toFixed(1)}deg)` });
  }
  frames[0].offset = 0;
  frames[K].offset = 1;
  wheels[0].offset = 0;
  wheels[K].offset = 1;
  /** seconds after mount at which the car reaches ground fraction g */
  const at = (g: number) => {
    const target = g * G;
    const i = Math.max(0, ground.findIndex((v) => v >= target));
    return DRIVE.start + (time[i] / T) * DRIVE.dur;
  };
  return { curb: poly(CL, CR), road: poly(L, R), dashes, signs, frames, wheels, at, end: DRIVE.start + DRIVE.dur };
})();
const END_FRAME = GEO.frames[GEO.frames.length - 1].transform as string;

const BACK_HOUSES: { x: number; y: number; w: number; h: number; roof: number; tone: number }[] = [
  { x: 40, y: 176, w: 46, h: 30, roof: 18, tone: 0 },
  { x: 168, y: 166, w: 52, h: 34, roof: 20, tone: 1 },
  { x: 300, y: 174, w: 44, h: 28, roof: 17, tone: 2 },
  { x: 560, y: 180, w: 40, h: 26, roof: 16, tone: 1 },
];
const BACK_TREES: [number, number, number, 'round' | 'tall' | 'cluster'][] = [
  [20, 184, 0.62, 'tall'], [118, 178, 0.7, 'round'], [140, 176, 0.5, 'tall'], [250, 178, 0.66, 'cluster'], [372, 180, 0.6, 'round'], [400, 182, 0.72, 'tall'], [530, 186, 0.6, 'round'],
];
const FAMILY: { kind: FigureKind; skin: number; hair: number; style: 'short' | 'long' | 'bun' | 'curly'; top: ClothKey; bottom: ClothKey; delay: number }[] = [
  { kind: 'adult', skin: 2, hair: 0, style: 'short', top: 'pine', bottom: 'slate', delay: 0 },
  { kind: 'child', skin: 2, hair: 1, style: 'bun', top: 'honey', bottom: 'sky', delay: 0.16 },
  { kind: 'adult', skin: 1, hair: 1, style: 'long', top: 'sky', bottom: 'slate', delay: 0.3 },
];

export function JourneyRoad({ reduce }: { reduce: boolean }) {
  const { t } = useLang();
  const id = `jr${useId().replace(/:/g, '')}`;
  const box = useRef<HTMLDivElement>(null);
  const car = useRef<HTMLDivElement>(null);
  const wheelA = useRef<HTMLDivElement>(null);
  const wheelB = useRef<HTMLDivElement>(null);
  const dip = useRef<HTMLDivElement>(null);
  // the ground and back layer first, then the house, then signposts, the car and the family
  const st = useStaged(3);
  const [passed, setPassed] = useState(reduce ? SIGN_DEFS.length : 0);
  // 0 driving · 1 parked, porch light · 2 door open · 3 window lit
  const [home, setHome] = useState(reduce ? 1 : 0);

  // scroll parallax between the planes (max 12px for the foreground)
  const { scrollYProgress } = useScroll({ target: box, offset: ['start end', 'end start'] });
  const fgY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [12, -12]);
  const midY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [6, -6]);
  const bgY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [2.4, -2.4]);

  // px per viewBox unit, for the HTML signposts' type size
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => el.style.setProperty('--k', String(e.contentRect.width / VB.w)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The drive: Web Animations on the compositor (transform/opacity only). Position, wheel turns and the
  // brake dip share one timeline; signposts and the house's lights are timed from it.
  const carIn = st >= 3;
  useEffect(() => {
    const el = car.current;
    if (!el || !carIn) return;
    if (reduce) {
      el.style.transform = END_FRAME;
      return;
    }
    const opts = { duration: DRIVE.dur * 1000, delay: DRIVE.start * 1000, fill: 'both' as const };
    const anims = [el.animate(GEO.frames, opts)];
    for (const w of [wheelA.current, wheelB.current]) if (w) anims.push(w.animate(GEO.wheels, opts));
    if (dip.current)
      anims.push(
        dip.current.animate(
          [{ transform: 'rotate(0deg)' }, { transform: 'rotate(1.8deg)', offset: 0.32 }, { transform: 'rotate(-0.5deg)', offset: 0.68 }, { transform: 'rotate(0deg)' }],
          { duration: 520, delay: (GEO.end - 0.06) * 1000, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'both' },
        ),
      );
    const timers = GEO.signs.map((sg, i) => setTimeout(() => setPassed((n) => Math.max(n, i + 1)), GEO.at(Math.max(0, sg.g - 0.07)) * 1000));
    timers.push(
      setTimeout(() => setHome(1), (GEO.end + 0.05) * 1000),
      setTimeout(() => setHome(2), (GEO.end + 0.25) * 1000),
      setTimeout(() => setHome(3), (GEO.end + 1.05) * 1000),
    );
    return () => {
      anims.forEach((a) => a.cancel());
      timers.forEach(clearTimeout);
    };
  }, [reduce, carIn]);

  /** plane entrances on the compositor: rise into place with a slight settle (CSS, delayed) */
  const rise = (size: 0 | 1 | 2 | 3, delay: number) => (reduce ? {} : { className: `absolute inset-0 la-in la-in-${size}`, style: { animationDelay: `${delay}s` } });
  const hp = isoPx(HOUSE.size, 0, 0);
  const signLabel = (k: SignDef['key']) => t(`road.labels.${k}`);

  return (
    <div ref={box} className="relative mx-auto w-full max-w-[680px]" style={{ aspectRatio: `${VB.w} / ${VB.h}` }} aria-hidden data-testid="journey-road">
      {/* back layer: a hazy hill with small houses and trees (not on phones) */}
      <Plane y={bgY} className="hidden sm:block">
        <div className="absolute inset-0" {...rise(1, 0)}>
          <Svg>
            <defs>
              <KitDefs id={`${id}b`} />
              <Fade id={`${id}fb`} />
              <linearGradient id={`${id}-hill`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={mix(P.sageLight, P.skyBottom, 0.35)} />
                <stop offset="1" stopColor={mix(P.sage, P.skyBottom, 0.3)} />
              </linearGradient>
            </defs>
            <g mask={`url(#${id}fb)`}>
              <path d="M-20 196C60 176 120 168 200 176S330 190 400 180 520 168 620 186V300H-20Z" fill={`url(#${id}-hill)`} />
              {BACK_TREES.slice(0, 4).map(([x, y, k, kind]) => (
                <Tree key={x} id={`${id}b`} x={x} y={y} s={k} kind={kind} />
              ))}
              {BACK_HOUSES.map((h) => (
                <MiniHouse key={h.x} {...h} />
              ))}
              {BACK_TREES.slice(4).map(([x, y, k, kind]) => (
                <Tree key={x} id={`${id}b`} x={x} y={y} s={k} kind={kind} />
              ))}
            </g>
          </Svg>
        </div>
      </Plane>

      {/* the meadow, the road and the driveway */}
      <Plane y={midY}>
        <div className="absolute inset-0" {...rise(2, 0.06)}>
          <Svg>
            <defs>
              <KitDefs id={`${id}m`} />
              <Fade id={`${id}fm`} bottom />
              <linearGradient id={`${id}-meadow`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={P.sageLight} />
                <stop offset="0.55" stopColor={P.sage} />
                <stop offset="1" stopColor={P.sageDark} />
              </linearGradient>
              <linearGradient id={`${id}-asph`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={P.asphaltLight} />
                <stop offset="1" stopColor={P.asphalt} />
              </linearGradient>
            </defs>
            <g mask={`url(#${id}fm)`}>
              <path d="M-20 214C70 204 150 210 240 212S400 206 470 210 590 214 620 216V380H-20Z" fill={`url(#${id}-meadow)`} />
              {/* soft lighter band where the meadow meets the hill (light from the top-left) */}
              <path d="M-20 214C70 204 150 210 240 212S400 206 470 210 590 214 620 216V222C590 220 470 216 400 214S240 220 150 216 30 212 -20 222Z" fill={P.sageLight} opacity={0.7} />
              {/* driveway pad and the path to the door */}
              <path d="M334 252L446 252L456 277L342 279Z" fill={P.stone} />
              <path d="M342 279L456 277L456 280L342 282Z" fill={P.stoneShade} />
              <path d={`M${DOOR.x - 9} ${DOOR.y + 1}h18l3 9h-24Z`} fill={P.stone} />
              {/* curbs, road surface, lane dashes */}
              <path d={GEO.curb} fill={P.stone} />
              <path d={GEO.road} fill={`url(#${id}-asph)`} />
              <path d={GEO.dashes} fill={P.trim} opacity={0.85} />
              {/* trees beside the house */}
              <Tree id={`${id}m`} x={584} y={232} s={1.05} kind="round" />
              <Tree id={`${id}m`} x={434} y={226} s={0.85} kind="tall" />
            </g>
          </Svg>
          {st >= 2 && (
            <>
              {/* warm light spilling from the open door */}
              <motion.div
                className="absolute"
                style={{ left: `${((DOOR.x - 40) / VB.w) * 100}%`, top: `${((DOOR.y - 16) / VB.h) * 100}%`, width: `${(80 / VB.w) * 100}%`, aspectRatio: '2.6', background: `radial-gradient(closest-side, ${alpha(P.glow, 0.9)}, ${alpha(P.honeyLight, 0.35)} 55%, ${alpha(P.honeyLight, 0)})` }}
                initial={false}
                animate={{ opacity: home >= 2 ? 1 : 0 }}
                transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
              />
              {/* the house at the end of the road */}
              <div className={`absolute ${reduce ? '' : 'la-show'}`} style={{ left: `${((HOUSE.x - hp.x) / VB.w) * 100}%`, top: `${((HOUSE.y - hp.y) / VB.h) * 100}%`, width: `${(HOUSE.size / VB.w) * 100}%`, animationDelay: '0.21s' }}>
                <IsoHouse size={HOUSE.size} build={reduce ? 'none' : 'quick'} delay={0.12} porch={home >= 1} doorOpen={home >= 2} lit={home >= 3 || reduce} ground={false} className="h-auto w-full" />
              </div>
            </>
          )}
          {st >= 3 && (
            <>
              {/* signposts behind the road (the car passes in front of them) */}
              {GEO.signs.map((sg, i) =>
                sg.side === 'back' ? <Signpost key={sg.key} x={sg.x} y={sg.y} s={sg.s} z={2} label={signLabel(sg.key)} up={passed > i} reduce={reduce} /> : null,
              )}
              {/* the car */}
              <div ref={car} className="absolute left-0 top-0" style={{ zIndex: 4, width: `${(CAR.w / VB.w) * 100}%`, transformOrigin: `${(CAR.ox / CAR.w) * 100}% ${(CAR.oy / CAR.h) * 100}%`, transform: reduce ? END_FRAME : (GEO.frames[0].transform as string), opacity: reduce ? 1 : 0, willChange: 'transform, opacity' }}>
                <Car id={id} reduce={reduce} wheelA={wheelA} wheelB={wheelB} dip={dip} />
              </div>
              {/* the family steps out and walks in */}
              {!reduce && FAMILY.map((f, i) => <Walker key={i} f={f} i={i} />)}
              {/* signposts in front of the road (they cover the car as it passes behind) */}
              {GEO.signs.map((sg, i) =>
                sg.side === 'front' ? <Signpost key={sg.key} x={sg.x} y={sg.y} s={sg.s} z={6} label={signLabel(sg.key)} up={passed > i} reduce={reduce} /> : null,
              )}
            </>
          )}
        </div>
      </Plane>

      {/* foreground framing: shrubs at the near corners */}
      {st >= 3 && (
        <Plane y={fgY} className="pointer-events-none" z={7}>
          <div className="absolute inset-0" {...rise(3, 0.1)}>
            <Svg>
              <defs>
                <KitDefs id={`${id}f`} />
              </defs>
              <Bush id={`${id}f`} x={54} y={352} s={1.5} />
              <Bush id={`${id}f`} x={110} y={360} s={1} />
              <Bush id={`${id}f`} x={546} y={352} s={1.35} />
            </Svg>
          </div>
        </Plane>
      )}
    </div>
  );
}

/** A full-size svg plane with the scene's viewBox (content may spill past it for the parallax). */
function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="absolute inset-0 h-full w-full overflow-visible">
      {children}
    </svg>
  );
}

/** One parallax plane (its own compositor layer). */
function Plane({ y, children, className = '', z }: { y: MotionValue<number>; children: React.ReactNode; className?: string; z?: number }) {
  return (
    <motion.div className={`absolute inset-0 ${className}`} style={{ y, zIndex: z }}>
      {children}
    </motion.div>
  );
}

/** A mask that fades a layer out at its left and right ends (and, optionally, toward the bottom). */
function Fade({ id, bottom = false }: { id: string; bottom?: boolean }) {
  return (
    <>
      <linearGradient id={`${id}-h`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={P.trim} stopOpacity="0" />
        <stop offset="0.12" stopColor={P.trim} stopOpacity="1" />
        <stop offset="0.88" stopColor={P.trim} stopOpacity="1" />
        <stop offset="1" stopColor={P.trim} stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${id}-v`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.74" stopColor={P.trim} stopOpacity="1" />
        <stop offset="1" stopColor={P.trim} stopOpacity="0" />
      </linearGradient>
      <mask id={`${id}-hm`} maskUnits="userSpaceOnUse" x={0} y={-40} width={VB.w} height={VB.h + 60}>
        <rect x={0} y={-40} width={VB.w} height={VB.h + 60} fill={`url(#${id}-h)`} />
      </mask>
      <mask id={id} maskUnits="userSpaceOnUse" x={0} y={-40} width={VB.w} height={VB.h + 60}>
        <g mask={`url(#${id}-hm)`}>
          <rect x={0} y={-40} width={VB.w} height={VB.h + 60} fill={bottom ? `url(#${id}-v)` : P.trim} />
        </g>
      </mask>
    </>
  );
}

/** A small distant house (oblique, lit front, shaded side and roof), hazed toward the sky. */
function MiniHouse({ x, y, w, h, roof, tone }: { x: number; y: number; w: number; h: number; roof: number; tone: number }) {
  const dx = w * 0.36;
  const dy = dx * 0.55;
  const haze = (c: string) => mix(c, P.skyBottom, 0.22);
  const wall = haze([P.wall, mix(P.wall, P.skyTop, 0.4), mix(P.wall, P.stone, 0.5)][tone]);
  const t = y - h;
  return (
    <g>
      <ellipse cx={x + w * 0.7} cy={y} rx={w * 0.75} ry={4} fill={P.ink} opacity={0.06} />
      <path d={`M${x + w} ${y}L${x + w + dx} ${y - dy}V${t - dy}L${x + w} ${t}Z`} fill={haze(P.wallShade)} />
      <path d={`M${x} ${y}V${t}L${x + w / 2} ${t - roof}L${x + w} ${t}V${y}Z`} fill={wall} />
      <path d={`M${x + w / 2} ${t - roof}L${x + w / 2 + dx} ${t - roof - dy}L${x + w + dx + 2} ${t - dy + 1.5}L${x + w + 2} ${t + 1.5}Z`} fill={haze(P.slateLight)} />
      <path d={`M${x - 2} ${t + 1.5}L${x + w / 2} ${t - roof - 1}L${x + w + 2} ${t + 1.5}L${x + w} ${t + 3}L${x + w / 2} ${t - roof + 2}L${x} ${t + 3}Z`} fill={P.trim} />
      <rect x={x + w * 0.16} y={t + h * 0.22} width={w * 0.24} height={h * 0.3} fill={haze(P.glass)} />
      <rect x={x + w * 0.58} y={y - h * 0.52} width={w * 0.2} height={h * 0.52} fill={haze(P.slateLight)} />
    </g>
  );
}

function Bush({ id, x, y, s }: { id: string; x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Shade id={id} cx={8} cy={0} rx={24} ry={5} />
      <circle cx={-9} cy={-9} r={10} fill={`url(#${id}-crown)`} />
      <circle cx={9} cy={-8} r={9} fill={`url(#${id}-crown)`} />
      <circle cx={0} cy={-15} r={11} fill={`url(#${id}-crown)`} />
    </g>
  );
}

/**
 * A guide sign: a pine panel with a white inset border and white text, on a shaded post with two bolts, a
 * contact shadow at its foot. Pops up from the ground and wobbles to rest (damped rotation) when the car
 * passes. Anchored at the post's foot; sized from the scene's scale (--k) so it scales with the scene.
 */
const Signpost = memo(function Signpost({ x, y, s, z, label, up, reduce }: { x: number; y: number; s: number; z: number; label: string; up: boolean; reduce: boolean }) {
  return (
    <div className="absolute" style={{ left: `${(x / VB.w) * 100}%`, top: `${(y / VB.h) * 100}%`, zIndex: z, fontSize: `max(8px, calc(var(--k, 1) * ${(12.5 * s).toFixed(2)}px))` }}>
      <span className="absolute left-[0.3em] top-[-0.25em] block h-[0.6em] w-[2.6em] -translate-x-1/2" style={{ background: `radial-gradient(closest-side, ${alpha(P.ink, 0.22)}, ${alpha(P.ink, 0)})` }} />
      <motion.div
        className="absolute bottom-0 left-0 flex -translate-x-1/2 flex-col items-center"
        style={{ transformOrigin: '50% 100%' }}
        initial={reduce ? false : { opacity: 0, scale: 0.6, y: 10, rotate: 0 }}
        animate={up ? { opacity: 1, scale: 1, y: 0, rotate: [0, -7, 5, -2.5, 1, 0] } : { opacity: 0, scale: 0.6, y: 10, rotate: 0 }}
        transition={{ type: 'spring', duration: 0.5, bounce: 0.35, opacity: { duration: 0.15 }, rotate: { duration: 1, times: [0, 0.18, 0.4, 0.6, 0.8, 1], ease: 'easeOut' } }}
      >
        <span className="relative block whitespace-nowrap">
          {/* panel thickness, turned away from the light */}
          <span className="absolute inset-0 translate-x-[0.18em] translate-y-[0.18em] rounded-[0.32em]" style={{ background: P.pineDark }} />
          <span className="relative block rounded-[0.32em] px-[0.85em] py-[0.42em] font-semibold leading-[1.15] text-white" style={{ background: `linear-gradient(170deg, ${P.pineLighter} 0%, ${P.pineLight} 30%, ${P.pine} 100%)` }}>
            <span className="absolute inset-[0.16em] rounded-[0.22em] border-[0.09em]" style={{ borderColor: alpha(P.trim, 0.85) }} />
            {label}
          </span>
        </span>
        {/* post with a lit left side; bolts where it meets the panel */}
        <span className="relative block h-[2.4em] w-[0.42em] rounded-b-[0.1em]" style={{ background: `linear-gradient(90deg, ${P.stone} 0 48%, ${P.stoneShade} 52% 100%)` }}>
          <span className="absolute left-1/2 top-[0.25em] block h-[0.2em] w-[0.2em] -translate-x-1/2 rounded-full" style={{ background: P.slateLight }} />
          <span className="absolute left-1/2 top-[0.75em] block h-[0.2em] w-[0.2em] -translate-x-1/2 rounded-full" style={{ background: P.slateLight }} />
        </span>
      </motion.div>
    </div>
  );
});

/**
 * The family's car, side on, facing right: a small SUV with a shaded pine body (lit from the top-left), glass
 * with the family's silhouettes and a glare, a headlight with a soft honey glow, tail light, door seams, side
 * mirror, roof rails, a contact shadow. Wheels are their own layers (they turn); the body sits in a "dip" layer
 * (the brake) and a "bob" layer (the suspension). Box 104×58, ground contact at (52, 50).
 */
type DivRef = React.RefObject<HTMLDivElement | null>;
const Car = memo(function Car({ id: sid, reduce, wheelA, wheelB, dip }: { id: string; reduce: boolean; wheelA: DivRef; wheelB: DivRef; dip: DivRef }) {
  const id = `${sid}car`;
  const vb = `${-CAR.ox} ${-CAR.oy} ${CAR.w} ${CAR.h}`;
  const wheel = (cx: number, ref: DivRef) => (
    <div ref={ref} className="absolute" style={{ left: `${((cx - 9 + CAR.ox) / CAR.w) * 100}%`, top: `${((-17 + CAR.oy) / CAR.h) * 100}%`, width: `${(18 / CAR.w) * 100}%`, aspectRatio: '1' }}>
      <svg viewBox="-9 -9 18 18" className="block h-full w-full">
        <circle r={8.6} fill={P.ink} />
        <circle r={7.6} fill={P.slateDark} />
        <circle r={4.6} fill={P.stone} />
        <circle r={4.6} fill={`url(#${id}-hub)`} />
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
          <radialGradient id={`${id}-hub`} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor={P.trim} stopOpacity="0.8" />
            <stop offset="1" stopColor={P.stoneShade} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx={4} cy={0.5} rx={56} ry={5.5} fill={`url(#${id}-shadow)`} />
      </svg>
      {/* body: dips forward when braking (front axle), bobs on its suspension while driving */}
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
            {/* headlight glow ahead of the car */}
            <ellipse cx={58} cy={-21} rx={26} ry={9} fill={`url(#${id}-beam)`} />
            {/* wheel wells */}
            <path d="M-39 -8A11 11 0 0 1 -17 -8Z" fill={P.ink} />
            <path d="M19 -8A11 11 0 0 1 41 -8Z" fill={P.ink} />
            {/* body + cabin */}
            <path d="M-48 -9V-24Q-48 -29 -42 -30L-33 -31L-23 -44Q-21 -46 -17 -46H18Q22 -46 24 -44L33 -33L45 -31Q50 -30 50 -24V-9Q50 -6 47 -6H41A11 11 0 0 0 19 -6H-17A11 11 0 0 0 -39 -6H-45Q-48 -6 -48 -9Z" fill={`url(#${id}-body)`} />
            {/* lower body in shade, rocker */}
            <path d="M-48 -15H50V-9Q50 -6 47 -6H41A11 11 0 0 0 19 -6H-17A11 11 0 0 0 -39 -6H-45Q-48 -6 -48 -9Z" fill={P.pine} />
            <path d="M-17 -6H19V-9H-17Z" fill={P.pineDark} />
            {/* roof rails, shoulder highlight */}
            <rect x={-19} y={-48.5} width={36} height={2} rx={1} fill={P.slate} />
            <path d="M-46 -26Q-46 -29 -41 -29.5L45 -29.5Q48 -29 48.5 -27" fill="none" stroke={P.pineLighter} strokeWidth={1.2} strokeLinecap="round" opacity={0.9} />
            {/* glass with the family inside */}
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
            {/* pillar between the windows, door seams and handles */}
            <rect x={3} y={-43} width={3} height={13} fill={P.pine} />
            <path d="M4.5 -30V-9" stroke={P.pineDark} strokeWidth={0.8} opacity={0.6} />
            <path d="M-30 -30V-12" stroke={P.pineDark} strokeWidth={0.8} opacity={0.5} />
            <rect x={-8} y={-26} width={5} height={1.4} rx={0.7} fill={P.pineDark} />
            <rect x={13} y={-26} width={5} height={1.4} rx={0.7} fill={P.pineDark} />
            {/* side mirror */}
            <path d="M24 -33h5q2 0 2 2v1h-7Z" fill={P.pine} />
            {/* headlight, tail light, bumpers */}
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

/**
 * One member of the family: steps out beside the car, walks to the open door and goes in (fades into the light).
 * A small Figure carried on the compositor (Web Animations), with a light step bob.
 */
const FIG = { w: 32, h: 44, ax: 16, ay: 42 };
const Walker = memo(function Walker({ f, i }: { f: (typeof FAMILY)[number]; i: number }) {
  const el = useRef<HTMLDivElement>(null);
  const frames = useMemo(() => {
    const tf = (x: number, y: number) => `translate(${(((x - FIG.ax) / FIG.w) * 100).toFixed(2)}%, ${(((y - FIG.ay) / FIG.h) * 100).toFixed(2)}%)`;
    const sx = 394 + i * 8;
    const sy = 272;
    return [
      { transform: tf(sx, sy - 2), opacity: 0, offset: 0 },
      { transform: tf(sx + 8, sy + 2), opacity: 1, offset: 0.18 },
      { transform: tf(DOOR.x - 14, DOOR.y + 8), opacity: 1, offset: 0.72 },
      { transform: tf(DOOR.x - 1, DOOR.y + 1), opacity: 0, offset: 1 },
    ];
  }, [i]);
  const start = GEO.end + 0.3 + f.delay;
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const a = node.animate(frames, { duration: 1050, delay: start * 1000, easing: 'cubic-bezier(0.37, 0, 0.42, 1)', fill: 'both' });
    return () => a.cancel();
  }, [frames, start]);
  return (
    <div ref={el} className="absolute left-0 top-0" style={{ zIndex: 5, width: `${(FIG.w / VB.w) * 100}%`, opacity: 0, transform: frames[0].transform }}>
      <div className="la-walk" style={{ animationDelay: `${start}s`, animationIterationCount: 6 }}>
        <svg viewBox={`0 0 ${FIG.w} ${FIG.h}`} className="block h-auto w-full overflow-visible">
          <Figure kind={f.kind} skin={f.skin} hair={f.hair} hairStyle={f.style} top={f.top} bottom={f.bottom} transform={`translate(${FIG.ax} ${FIG.ay}) scale(0.38)`} />
        </svg>
      </div>
    </div>
  );
});
