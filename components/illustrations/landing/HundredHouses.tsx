'use client';
import { motion } from 'motion/react';
import { useEffect, useId, useState } from 'react';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { P, mix } from '@/lib/illustrationPalette';
import { rng } from './kit';

/**
 * Closing band: a street at dusk with a hundred small shaded homes in rows that recede toward the horizon
 * (fronts catch the last light from the left, sides and roofs turn away; farther rows sink into the haze).
 * The windows light up honey in a wave from the front row to the back while the counter rolls to 100.
 *
 * Cheap by construction: each row's geometry is merged into a handful of paths per material (built once at
 * module load), and each row's lights live on their own layer whose opacity is a CSS animation with a delay
 * (compositor only, no JavaScript per frame). Rows are stacked back to front so nearer homes cover farther ones.
 */
const VB = { w: 640, h: 236 };
const HORIZON = 78;
/** rows, front first: how many homes and their scale (perspective) */
const ROWS = [
  { n: 8, s: 1.12 },
  { n: 10, s: 0.9 },
  { n: 12, s: 0.75 },
  { n: 14, s: 0.64 },
  { n: 16, s: 0.55 },
  { n: 18, s: 0.48 },
  { n: 22, s: 0.4 },
];
const FRONT_Y = 220;
/** seconds after mount when row k's windows start to light (front row first) */
const lightAt = (k: number) => 0.4 + k * 0.12;
const rowY = (s: number) => HORIZON + ((FRONT_Y - HORIZON) * (s - 0.22)) / (1.12 - 0.22);

type RowGeo = { y: number; s: number; haze: number; front: string; side: string; roof: string; roofSide: string; trim: string; door: string; dark: string; lit: string; glow: string; lamps: string; trees: string; treeShade: string };

const GEO: RowGeo[] = (() => {
  const r = rng(11);
  const f = (v: number) => v.toFixed(1);
  return ROWS.map((row, k) => {
    const s = row.s;
    const y = rowY(s);
    const pitch = VB.w / row.n;
    const out = { front: '', side: '', roof: '', roofSide: '', trim: '', door: '', dark: '', lit: '', glow: '', lamps: '', trees: '', treeShade: '' };
    // alternate rows sit half a lot over, so farther homes show between nearer ones
    const shift = k % 2 ? pitch * 0.5 : pitch * 0.18;
    for (let i = 0; i < row.n; i++) {
      const w = (34 + r() * 12) * s;
      const h = (22 + r() * 8) * s;
      const roofH = (13 + r() * 6) * s;
      const dx = 12 * s;
      const dy = 7 * s;
      const x = i * pitch + shift - pitch * 0.15 + (r() - 0.5) * pitch * 0.12;
      const b = y;
      const t = b - h;
      out.front += `M${f(x)} ${f(b)}V${f(t)}L${f(x + w / 2)} ${f(t - roofH)}L${f(x + w)} ${f(t)}V${f(b)}Z`;
      out.side += `M${f(x + w)} ${f(b)}L${f(x + w + dx)} ${f(b - dy)}V${f(t - dy)}L${f(x + w)} ${f(t)}Z`;
      out.roofSide += `M${f(x + w / 2)} ${f(t - roofH)}L${f(x + w / 2 + dx)} ${f(t - roofH - dy)}L${f(x + w + dx + 1.5 * s)} ${f(t - dy + 1.5 * s)}L${f(x + w + 1.5 * s)} ${f(t + 1.5 * s)}Z`;
      out.roof += `M${f(x - 1.5 * s)} ${f(t + 1.2 * s)}L${f(x + w / 2)} ${f(t - roofH - 0.8 * s)}L${f(x + w + 1.5 * s)} ${f(t + 1.2 * s)}L${f(x + w)} ${f(t + 2.4 * s)}L${f(x + w / 2)} ${f(t - roofH + 1.6 * s)}L${f(x)} ${f(t + 2.4 * s)}Z`;
      // door + one front window (+ a small window on the side wall)
      const dw = w * 0.2;
      const dh = h * 0.56;
      const doorLeft = r() > 0.5;
      const dxp = doorLeft ? x + w * 0.16 : x + w * 0.64;
      out.door += `M${f(dxp)} ${f(b)}V${f(b - dh)}H${f(dxp + dw)}V${f(b)}Z`;
      const ww = w * 0.24;
      const wh = h * 0.34;
      const wx = doorLeft ? x + w * 0.56 : x + w * 0.16;
      const wy = t + h * 0.22;
      const win = `M${f(wx)} ${f(wy)}H${f(wx + ww)}V${f(wy + wh)}H${f(wx)}Z`;
      const sw = `M${f(x + w + dx * 0.3)} ${f(t + h * 0.3 - dy * 0.3)}l${f(dx * 0.4)} ${f(-dy * 0.4)}v${f(h * 0.3)}l${f(-dx * 0.4)} ${f(dy * 0.4)}Z`;
      const gable = `M${f(x + w / 2 - w * 0.07)} ${f(t - roofH * 0.42)}h${f(w * 0.14)}v${f(roofH * 0.3)}h${f(-w * 0.14)}Z`;
      out.trim += `M${f(wx - 1.2 * s)} ${f(wy - 1.2 * s)}H${f(wx + ww + 1.2 * s)}V${f(wy + wh + 1.6 * s)}H${f(wx - 1.2 * s)}Z`;
      out.dark += win + sw + gable;
      out.lit += win + sw + gable;
      out.glow += `M${f(wx - 4.5 * s)} ${f(wy - 4.5 * s)}H${f(wx + ww + 4.5 * s)}V${f(wy + wh + 4.5 * s)}H${f(wx - 4.5 * s)}Z`;
      // a round tree behind every few homes (between the lots)
      if (r() > 0.62) {
        const tx = x - pitch * 0.12;
        const tr = (7 + r() * 4) * s;
        out.trees += `M${f(tx - tr)} ${f(b - tr * 1.5)}a${f(tr)} ${f(tr)} 0 1 1 ${f(tr * 2)} 0a${f(tr)} ${f(tr)} 0 1 1 ${f(-tr * 2)} 0Z`;
        out.treeShade += `M${f(tx + tr * 0.1)} ${f(b - tr * 1.5 - tr * 0.98)}a${f(tr)} ${f(tr)} 0 0 1 0 ${f(tr * 1.96)}a${f(tr * 1.3)} ${f(tr * 1.3)} 0 0 0 0 ${f(-tr * 1.96)}Z`;
        out.lamps += `M${f(tx - 0.8 * s)} ${f(b)}V${f(b - tr * 0.8)}h${f(1.6 * s)}V${f(b)}Z`;
      }
    }
    return { y, s, haze: Math.min(0.62, k * 0.1), ...out };
  });
})();

export function HundredHouses({ reduce }: { reduce: boolean; cols?: number }) {
  const id = `hh${useId().replace(/:/g, '')}`;
  return (
    <motion.div
      className="relative w-full max-w-[640px] overflow-hidden rounded-[16px]"
      style={{ aspectRatio: `${VB.w} / ${VB.h}`, background: P.duskTop }}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      aria-hidden
      data-testid="hundred-houses"
    >
      {/* sky: dusk gradient, the last light low on the left, a few stars, far hills */}
      <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={mix(P.duskTop, P.ink, 0.25)} />
            <stop offset="0.45" stopColor={P.duskTop} />
            <stop offset="0.75" stopColor={P.duskBottom} />
            <stop offset="1" stopColor={mix(P.duskBottom, P.honey, 0.18)} />
          </linearGradient>
          <radialGradient id={`${id}-after`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={P.honeyLight} stopOpacity="0.5" />
            <stop offset="0.5" stopColor={P.honey} stopOpacity="0.16" />
            <stop offset="1" stopColor={P.honey} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={VB.w} height={VB.h} fill={`url(#${id}-sky)`} />
        <ellipse cx={110} cy={HORIZON + 14} rx={300} ry={80} fill={`url(#${id}-after)`} />
        <g fill={P.trim}>
          {STARS.map(([x, y, rr, o]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={rr} opacity={o} />
          ))}
        </g>
        <path d={`M0 ${HORIZON + 6}C80 ${HORIZON - 14} 160 ${HORIZON - 10} 240 ${HORIZON + 2}S400 ${HORIZON - 16} 480 ${HORIZON - 4} 600 ${HORIZON - 8} 640 ${HORIZON}V${VB.h}H0Z`} fill={mix(P.duskBottom, P.duskTop, 0.55)} />
        <rect y={HORIZON + 4} width={VB.w} height={VB.h} fill={mix(P.duskBottom, P.sageDark, 0.18)} />
      </svg>
      {/* rows, farthest first: homes, then that row's lights (so nearer homes cover farther lights) */}
      {GEO.map((_, j) => {
        const k = GEO.length - 1 - j;
        const g = GEO[k];
        const tone = (c: string, extra = 0) => mix(c, P.duskBottom, g.haze + extra);
        return (
          <div key={k} className="absolute inset-0">
            <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="absolute inset-0 h-full w-full">
              <defs>
                {/* the last light comes from the left: fronts are brighter on that side of town */}
                <linearGradient id={`${id}-f${k}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor={tone(mix(P.wall, P.duskBottom, 0.3))} />
                  <stop offset="1" stopColor={tone(mix(P.wallShade, P.duskTop, 0.55))} />
                </linearGradient>
              </defs>
              {/* the row's ground strip and its contact shading */}
              <rect x={0} y={g.y - 2 * g.s} width={VB.w} height={VB.h} fill={tone(mix(P.sageDark, P.duskTop, 0.42))} />
              <rect x={0} y={g.y - 2 * g.s} width={VB.w} height={3 * g.s} fill={tone(mix(P.sageDark, P.ink, 0.35))} opacity={0.6} />
              <path d={g.trees} fill={tone(mix(P.tree, P.duskTop, 0.35))} />
              <path d={g.treeShade} fill={tone(mix(P.treeDark, P.duskTop, 0.45))} />
              <path d={g.side} fill={tone(mix(P.wallDeep, P.duskTop, 0.68))} />
              <path d={g.front} fill={`url(#${id}-f${k})`} />
              <path d={g.roofSide} fill={tone(mix(P.slate, P.duskTop, 0.35))} />
              <path d={g.roof} fill={tone(mix(P.trimShade, P.duskBottom, 0.45))} />
              <path d={g.trim} fill={tone(mix(P.trim, P.duskBottom, 0.3))} />
              <path d={g.dark} fill={tone(mix(P.glass, P.duskTop, 0.45))} />
              <path d={g.door} fill={tone(mix(P.slateDark, P.duskTop, 0.2))} />
              {g.lamps && <path d={g.lamps} fill={mix(P.slateDark, P.duskTop, 0.2)} />}
            </svg>
            <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className={`absolute inset-0 h-full w-full ${reduce ? '' : 'la-light'}`} style={reduce ? undefined : { animationDelay: `${lightAt(k)}s` }}>
              <defs>
                <filter id={`${id}-b${k}`} x="-20%" y="-50%" width="140%" height="200%">
                  <feGaussianBlur stdDeviation={2.6 * g.s + 0.6} />
                </filter>
                <linearGradient id={`${id}-w${k}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={P.glow} />
                  <stop offset="1" stopColor={P.honey} />
                </linearGradient>
              </defs>
              <path d={g.glow} fill={P.honey} opacity={0.75 - g.haze * 0.4} filter={`url(#${id}-b${k})`} />
              <path d={g.lit} fill={`url(#${id}-w${k})`} opacity={1 - g.haze * 0.35} />
            </svg>
          </div>
        );
      })}
      {/* the street in front: curb, asphalt, lane dashes, and a few street lamps already glowing (static) */}
      <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id={`${id}-lamp`}>
            <stop offset="0" stopColor={P.glow} stopOpacity="0.95" />
            <stop offset="0.3" stopColor={P.honeyLight} stopOpacity="0.5" />
            <stop offset="1" stopColor={P.honey} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-pool`}>
            <stop offset="0" stopColor={P.honeyLight} stopOpacity="0.45" />
            <stop offset="1" stopColor={P.honey} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect y={FRONT_Y + 1} width={VB.w} height={3} fill={mix(P.stone, P.duskBottom, 0.55)} />
        <rect y={FRONT_Y + 4} width={VB.w} height={VB.h} fill={mix(P.asphalt, P.duskTop, 0.45)} />
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={i * 56 + 14} y={FRONT_Y + 9} width={26} height={1.6} rx={0.8} fill={mix(P.trim, P.duskTop, 0.45)} />
        ))}
        {LAMPS.map((x) => (
          <g key={x}>
            <ellipse cx={x + 4} cy={FRONT_Y + 8} rx={34} ry={6} fill={`url(#${id}-pool)`} />
            <rect x={x - 1.2} y={FRONT_Y - 36} width={2.4} height={40} rx={1} fill={mix(P.slateDark, P.duskTop, 0.15)} />
            <rect x={x - 0.2} y={FRONT_Y - 36} width={1.2} height={40} fill={mix(P.slate, P.duskBottom, 0.3)} />
            <path d={`M${x} ${FRONT_Y - 36}q0 -4 6 -4h2v2h-2q-4 0 -4 2Z`} fill={mix(P.slateDark, P.duskTop, 0.15)} />
            <circle cx={x + 8} cy={FRONT_Y - 37} r={16} fill={`url(#${id}-lamp)`} />
            <path d={`M${x + 4.5} ${FRONT_Y - 39}h7l-1.5 3.6h-4Z`} fill={mix(P.slateDark, P.duskTop, 0.15)} />
            <ellipse cx={x + 8} cy={FRONT_Y - 35} rx={2.6} ry={1.3} fill={P.glow} />
          </g>
        ))}
      </svg>
    </motion.div>
  );
}

/** The big counter: rolls up as each row of windows lights (8, 18, 30 … 100), so the number tracks the homes. */
export function HundredCount({ reduce, format }: { reduce: boolean; format: (n: number) => string }) {
  const [v, setV] = useState(reduce ? 100 : 0);
  useEffect(() => {
    if (reduce) return;
    let lit = 0;
    const timers = ROWS.map((row, k) => {
      lit += row.n;
      const n = lit;
      return setTimeout(() => setV(n), (lightAt(k) + 0.1) * 1000);
    });
    return () => timers.forEach(clearTimeout);
  }, [reduce]);
  return <AnimatedNumber value={v} format={format} />;
}

/** street lamps along the front sidewalk (x) */
const LAMPS = [72, 236, 404, 572];

const STARS: [number, number, number, number][] = (() => {
  const r = rng(5);
  return Array.from({ length: 24 }, () => [Math.round(r() * 640), Math.round(r() * 56), 0.5 + r() * 0.8, 0.25 + r() * 0.55] as [number, number, number, number]);
})();
