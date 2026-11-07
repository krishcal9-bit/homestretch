'use client';
import { motion, useReducedMotion, useSpring } from 'motion/react';
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { P, mix } from '@/lib/illustrationPalette';

/**
 * A street of small shaded houses under a soft sky — the horizon the Road heads toward. Each house has a lit
 * front (light from the top-left), a side wall and roof plane turned into shade, a window with a glare, a door,
 * a soft shadow to its right; a few round trees stand between them on a lawn strip with a curb.
 * One SVG; only the single active window ever animates (opacity), so it stays cheap on every page.
 *
 * mode "living": windows glow honey one at a time (every 2.5s for 1.2s, random order). Landing only.
 * mode "static": nothing moves on its own (intake, result, scroll scene).
 */
const VB_W = 1440;
const VB_H = 120;
const GROUND = 112;
const DX = 9; // side wall depth (recedes up-right)
const DY = 5;

type House = { x: number; w: number; h: number; roof: 'gable' | 'flat' | 'steep'; win: { x: number; y: number; w: number; h: number }; door: { x: number; w: number; h: number }; tone: number };

/** Deterministic pseudo-random so the street is the same on server and client. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildStreet(count: number): House[] {
  const r = rng(7);
  const houses: House[] = [];
  const gap = 10;
  const totalW = VB_W - 40;
  const widths = Array.from({ length: count }, () => 54 + r() * 52);
  const scale = (totalW - gap * (count - 1)) / widths.reduce((a, b) => a + b, 0);
  let x = 20;
  for (let i = 0; i < count; i++) {
    const w = widths[i] * scale - DX;
    const h = 30 + r() * 34;
    const roof = (['gable', 'flat', 'steep'] as const)[Math.floor(r() * 3)];
    const ww = Math.min(14, w * 0.18);
    const doorW = Math.min(12, w * 0.16);
    const doorLeft = r() > 0.5;
    houses.push({
      x,
      w,
      h,
      roof,
      win: { x: doorLeft ? x + w * 0.62 : x + w * 0.2, y: GROUND - h + 9, w: ww, h: ww },
      door: { x: doorLeft ? x + w * 0.2 : x + w * 0.62, w: doorW, h: Math.min(20, h * 0.5) },
      tone: r(),
    });
    x += w + DX + gap;
  }
  return houses;
}

/** Front face, side wall and roof plane for one house. */
function shapes(h: House) {
  const top = GROUND - h.h;
  const l = h.x;
  const rt = h.x + h.w;
  const peak = h.roof === 'flat' ? 0 : h.roof === 'steep' ? h.w * 0.42 : h.w * 0.26;
  const front = h.roof === 'flat' ? `M${l} ${GROUND}V${top}H${rt}V${GROUND}Z` : `M${l} ${GROUND}V${top}L${l + h.w / 2} ${top - peak}L${rt} ${top}V${GROUND}Z`;
  const side = `M${rt} ${GROUND}L${rt + DX} ${GROUND - DY}V${top - DY}L${rt} ${top}Z`;
  const roof =
    h.roof === 'flat'
      ? `M${l - 1.5} ${top}H${rt + 1.5}L${rt + DX + 1.5} ${top - DY}H${l + DX - 1.5}Z`
      : `M${l + h.w / 2} ${top - peak}L${l + h.w / 2 + DX} ${top - peak - DY}L${rt + DX + 2} ${top - DY + 1.5}L${rt + 2} ${top + 1.5}Z`;
  const eave = h.roof === 'flat' ? `M${l - 1.5} ${top}H${rt + 1.5}V${top + 2.5}H${l - 1.5}Z` : `M${l - 2} ${top + 1.5}L${l + h.w / 2} ${top - peak - 1}L${rt + 2} ${top + 1.5}L${rt} ${top + 3}L${l + h.w / 2} ${top - peak + 2}L${l} ${top + 3}Z`;
  return { front, side, roof, eave, top, peak };
}

/** The drawn street: rendered once and memoized, so lighting a window never re-renders the houses. */
const Street = memo(function Street({ id, houses, draw, drawInAt, keysLit, stagger }: { id: string; houses: House[]; draw: boolean; drawInAt: number | false; keysLit: boolean; stagger: number }) {
  return (
    <>
      {houses.map((h, i) => {
        const s = shapes(h);
        const isKeys = keysLit && i === houses.length - 1;
        const wall = h.tone > 0.66 ? mix(P.wall, P.skyTop, 0.35) : h.tone > 0.33 ? P.wall : mix(P.wall, P.stone, 0.5);
        return (
          <g key={i} className={draw ? 'la-rise' : undefined} style={draw ? { animationDelay: `${(drawInAt as number) + i * stagger}s` } : undefined}>
            <ellipse cx={h.x + h.w * 0.62 + DX} cy={GROUND - 1} rx={h.w * 0.62} ry={4.5} fill={`url(#${id}-sh)`} />
            <path d={s.side} fill={`url(#${id}-side)`} />
            <path d={s.front} fill={wall} />
            <path d={s.front} fill={`url(#${id}-fall)`} />
            <path d={s.roof} fill={`url(#${id}-roof)`} />
            <path d={s.eave} fill={P.trim} />
            <rect x={h.x} y={GROUND - 2.5} width={h.w} height={2.5} fill={P.stoneShade} />
            <rect x={h.win.x - 1.5} y={h.win.y - 1.5} width={h.win.w + 3} height={h.win.h + 3} fill={P.trim} />
            <rect x={h.win.x} y={h.win.y} width={h.win.w} height={h.win.h} fill={P.glass} />
            <path d={`M${h.win.x + h.win.w * 0.15} ${h.win.y + h.win.h}L${h.win.x + h.win.w * 0.55} ${h.win.y}h${h.win.w * 0.2}L${h.win.x + h.win.w * 0.35} ${h.win.y + h.win.h}Z`} fill={P.glassLight} opacity={0.55} />
            <rect x={h.door.x - 1.5} y={GROUND - h.door.h - 1.5} width={h.door.w + 3} height={h.door.h + 1.5} fill={P.trim} />
            <rect x={h.door.x} y={GROUND - h.door.h} width={h.door.w} height={h.door.h} fill={isKeys ? P.brass : P.slateLight} style={{ transition: 'fill 300ms ease' }} />
          </g>
        );
      })}
    </>
  );
});

export type SkylineProps = {
  mode?: 'living' | 'static';
  count?: number;
  /** seconds; the houses rise in left to right (40ms stagger). false = already standing. */
  drawInAt?: number | false;
  /** bump to light one random house for a beat (e.g. the date got earlier). */
  flashKey?: number;
  /** a specific house index to keep lit (e.g. the "Keys" house in a scroll scene). */
  litIndex?: number | null;
  /** how many windows are lit steadily (ticked checklist items). */
  litCount?: number;
  /** the last house's door turns brass (keys). */
  keysLit?: boolean;
  /** desktop only: drifts up to 8px opposite the cursor. */
  parallax?: boolean;
  className?: string;
  height?: number;
  /** seconds between houses during the draw-in */
  stagger?: number;
};

/** Memoized: parents that re-render on every slider frame don't re-render the street. */
export const Skyline = memo(function Skyline({ mode = 'static', count = 16, drawInAt = false, flashKey = 0, litIndex = null, litCount = 0, keysLit = false, parallax = false, className = '', height = 120, stagger = 0.04 }: SkylineProps) {
  const reduce = useReducedMotion();
  const id = `sk${useId().replace(/:/g, '')}`;
  const houses = useMemo(() => buildStreet(count), [count]);
  const trees = useMemo(() => houses.slice(0, -1).flatMap((h, i) => (i % 3 === 1 ? [{ x: h.x + h.w + DX + 5, r: 10 + h.tone * 5 }] : [])), [houses]);
  const [active, setActive] = useState<number | null>(null);
  const [glowKey, setGlowKey] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Living street: one window at a time, every 2.5s, never two at once; paused when hidden or reduced.
  useEffect(() => {
    if (mode !== 'living' || reduce) return;
    let last = -1;
    const start = typeof drawInAt === 'number' ? drawInAt * 1000 + count * stagger * 1000 + 600 : 0;
    const tick = () => {
      if (document.visibilityState === 'visible') {
        let i = Math.floor(Math.random() * count);
        if (i === last) i = (i + 1) % count;
        last = i;
        setActive(i);
        setGlowKey((k) => k + 1);
      }
      timer.current = setTimeout(tick, 2500);
    };
    timer.current = setTimeout(tick, start + 800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [mode, reduce, count, drawInAt, stagger]);

  // External flash (the date moved earlier): take over the single glowing window.
  useEffect(() => {
    if (!flashKey || reduce) return;
    setActive(Math.floor(Math.random() * count));
    setGlowKey((k) => k + 1);
  }, [flashKey, count, reduce]);

  // Desktop parallax, opposite the cursor, max 8px.
  const px = useSpring(0, { stiffness: 120, damping: 20 });
  useEffect(() => {
    if (!parallax || reduce || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const on = (e: PointerEvent) => px.set(-((e.clientX / window.innerWidth) * 2 - 1) * 8);
    window.addEventListener('pointermove', on, { passive: true });
    return () => window.removeEventListener('pointermove', on);
  }, [parallax, reduce, px]);

  const draw = typeof drawInAt === 'number' && !reduce;
  const lit = (h: House, k: string | number, glow = true) => (
    <g key={k}>
      {glow && <ellipse cx={h.win.x + h.win.w / 2} cy={h.win.y + h.win.h / 2} rx={h.win.w * 1.4} ry={h.win.h * 1.4} fill={`url(#${id}-glow)`} />}
      <rect x={h.win.x} y={h.win.y} width={h.win.w} height={h.win.h} fill={`url(#${id}-lit)`} />
    </g>
  );
  return (
    <motion.div className={`pointer-events-none select-none ${className}`} style={{ x: px }} aria-hidden>
      <svg width="100%" height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMax slice" className="block overflow-visible">
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={P.skyTop} stopOpacity="0" />
            <stop offset="1" stopColor={P.skyTop} stopOpacity="0.75" />
          </linearGradient>
          <linearGradient id={`${id}-fall`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={P.trim} stopOpacity="0.55" />
            <stop offset="0.5" stopColor={P.trim} stopOpacity="0" />
            <stop offset="1" stopColor={P.wallShade} stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id={`${id}-side`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={P.wallShade} />
            <stop offset="1" stopColor={P.wallDeep} />
          </linearGradient>
          <linearGradient id={`${id}-roof`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={P.slateLight} />
            <stop offset="1" stopColor={P.slate} />
          </linearGradient>
          <linearGradient id={`${id}-lit`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={P.honeyLight} />
            <stop offset="1" stopColor={P.honey} />
          </linearGradient>
          <radialGradient id={`${id}-glow`}>
            <stop offset="0" stopColor={P.honey} stopOpacity="0.55" />
            <stop offset="1" stopColor={P.honey} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-sh`}>
            <stop offset="0" stopColor={P.ink} stopOpacity="0.16" />
            <stop offset="1" stopColor={P.ink} stopOpacity="0" />
          </radialGradient>
          {/* the sky haze and the lawn fade out at both ends instead of stopping at a hard edge */}
          <linearGradient id={`${id}-fadeG`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={P.trim} stopOpacity="0" />
            <stop offset="0.05" stopColor={P.trim} stopOpacity="1" />
            <stop offset="0.95" stopColor={P.trim} stopOpacity="1" />
            <stop offset="1" stopColor={P.trim} stopOpacity="0" />
          </linearGradient>
          <mask id={`${id}-fade`} maskUnits="userSpaceOnUse" x={0} y={-20} width={VB_W} height={VB_H + 40}>
            <rect x={0} y={-20} width={VB_W} height={VB_H + 40} fill={`url(#${id}-fadeG)`} />
          </mask>
          <radialGradient id={`${id}-tree`} cx="0.34" cy="0.3" r="0.78">
            <stop offset="0" stopColor={P.treeLight} />
            <stop offset="0.7" stopColor={P.tree} />
            <stop offset="1" stopColor={P.treeDark} />
          </radialGradient>
        </defs>
        {/* soft sky haze behind the street, deepest at the horizon */}
        <rect x={0} y={0} width={VB_W} height={GROUND} fill={`url(#${id}-sky)`} mask={`url(#${id}-fade)`} />
        {/* lawn strip and curb */}
        <motion.g initial={draw ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: draw ? (drawInAt as number) : 0 }}>
          <g mask={`url(#${id}-fade)`}>
            <rect x={0} y={GROUND} width={VB_W} height={VB_H - GROUND + 20} fill={P.sageLight} />
            <rect x={0} y={GROUND} width={VB_W} height={1.5} fill={P.sage} />
          </g>
          {trees.map((t, i) => (
            <g key={i} className={draw ? 'la-rise' : undefined} style={draw ? { animationDelay: `${(drawInAt as number) + (i * 3 + 2) * stagger + 0.15}s` } : undefined}>
              <ellipse cx={t.x + 6} cy={GROUND - 1} rx={t.r * 1.2} ry={3.5} fill={`url(#${id}-sh)`} />
              <rect x={t.x - 1.2} y={GROUND - t.r - 6} width={2.4} height={t.r + 6} fill={P.bark} />
              <circle cx={t.x} cy={GROUND - t.r * 1.9} r={t.r} fill={`url(#${id}-tree)`} />
            </g>
          ))}
        </motion.g>
        <Street id={id} houses={houses} draw={draw} drawInAt={drawInAt} keysLit={keysLit} stagger={stagger} />
        {/* steady lit windows (ticked checklist, the Keys house in a scene): cheap overlays, the street never re-renders */}
        {houses.map((h, i) => (i === litIndex || i < litCount ? lit(h, i) : null))}
        {/* the single glowing window: the only thing that moves on its own */}
        {active !== null && (
          <motion.g key={glowKey} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 1.2, times: [0, 0.25, 0.7, 1], ease: 'easeInOut' }} data-testid="skyline-glow">
            {lit(houses[active], 'glow')}
          </motion.g>
        )}
      </svg>
    </motion.div>
  );
});
