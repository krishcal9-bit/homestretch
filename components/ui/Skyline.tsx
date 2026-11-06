'use client';
import { motion, useReducedMotion, useSpring } from 'motion/react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ease } from '@/lib/motion';

/**
 * A street of simple line-drawn houses on a ground line — the horizon the Road heads toward.
 * One SVG; only the single active window ever animates (opacity), so it stays at 60fps.
 *
 * mode "living": windows glow brass one at a time (every 2.5s for 1.2s, random order). Landing only.
 * mode "static": nothing moves on its own (intake, result, scroll scene).
 */
const VB_W = 1440;
const VB_H = 120;
const GROUND = 112;

type House = { x: number; w: number; h: number; roof: 'gable' | 'flat' | 'steep'; win: { x: number; y: number; w: number; h: number }; door: { x: number; w: number; h: number } };

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
    const w = widths[i] * scale;
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
      win: { x: doorLeft ? x + w * 0.62 : x + w * 0.22, y: GROUND - h + 10, w: ww, h: ww },
      door: { x: doorLeft ? x + w * 0.22 : x + w * 0.62, w: doorW, h: Math.min(20, h * 0.5) },
    });
    x += w + gap;
  }
  return houses;
}

function housePath(h: House): string {
  const top = GROUND - h.h;
  const l = h.x;
  const rt = h.x + h.w;
  const peak = h.roof === 'flat' ? 0 : h.roof === 'steep' ? h.w * 0.42 : h.w * 0.26;
  // one stroke: left wall up, roof, right wall down, back along the ground to the door, door outline
  return h.roof === 'flat'
    ? `M${l} ${GROUND}V${top}H${rt}V${GROUND}`
    : `M${l} ${GROUND}V${top}L${l + h.w / 2} ${top - peak}L${rt} ${top}V${GROUND}`;
}

/** The drawn street: rendered once and memoized, so lighting a window never re-renders the houses. */
const Street = memo(function Street({ houses, draw, drawInAt, keysLit }: { houses: House[]; draw: boolean; drawInAt: number | false; keysLit: boolean }) {
  return (
    <>
      {houses.map((h, i) => {
          const isKeys = keysLit && i === houses.length - 1;
          return (
            <g key={i}>
              <motion.path
                d={housePath(h)}
                fill="none"
                stroke="var(--line)"
                strokeWidth="1.5"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                initial={draw ? { pathLength: 0, opacity: 0 } : false}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ pathLength: { duration: 0.5, ease: ease.out, delay: draw ? (drawInAt as number) + i * 0.04 : 0 }, opacity: { duration: 0.01, delay: draw ? (drawInAt as number) + i * 0.04 : 0 } }}
              />
              <motion.g initial={draw ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: draw ? (drawInAt as number) + i * 0.04 + 0.3 : 0 }}>
              <rect x={h.win.x} y={h.win.y} width={h.win.w} height={h.win.h} fill="none" stroke="var(--line)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              <rect x={h.door.x} y={GROUND - h.door.h} width={h.door.w} height={h.door.h} fill={isKeys ? 'var(--brass)' : 'none'} stroke={isKeys ? 'var(--brass)' : 'var(--line)'} strokeWidth="1.5" vectorEffect="non-scaling-stroke" style={{ transition: 'fill 300ms ease, stroke 300ms ease' }} />
              </motion.g>
            </g>
          );
        })}
    </>
  );
});

export type SkylineProps = {
  mode?: 'living' | 'static';
  count?: number;
  /** seconds; draws the houses in left to right (40ms stagger). false = already drawn. */
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
};

export function Skyline({ mode = 'static', count = 16, drawInAt = false, flashKey = 0, litIndex = null, litCount = 0, keysLit = false, parallax = false, className = '', height = 120 }: SkylineProps) {
  const reduce = useReducedMotion();
  const houses = useMemo(() => buildStreet(count), [count]);
  const [active, setActive] = useState<number | null>(null);
  const [glowKey, setGlowKey] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Living street: one window at a time, every 2.5s, never two at once; paused when hidden or reduced.
  useEffect(() => {
    if (mode !== 'living' || reduce) return;
    let last = -1;
    const start = typeof drawInAt === 'number' ? drawInAt * 1000 + count * 40 + 600 : 0;
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
  }, [mode, reduce, count, drawInAt]);

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
  return (
    <motion.div className={`pointer-events-none select-none ${className}`} style={{ x: px }} aria-hidden>
      <svg width="100%" height={height} viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMax slice" className="block overflow-visible">
        <motion.line
          x1="0"
          x2={VB_W}
          y1={GROUND}
          y2={GROUND}
          stroke="var(--line)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          initial={draw ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, ease: ease.inOut, delay: draw ? (drawInAt as number) : 0 }}
        />
        <Street houses={houses} draw={draw} drawInAt={drawInAt} keysLit={keysLit} />
        {/* steady lit windows (ticked checklist, the Keys house in a scene): cheap overlays, the street never re-renders */}
        {houses.map((h, i) =>
          i === litIndex || i < litCount ? <rect key={i} x={h.win.x} y={h.win.y} width={h.win.w} height={h.win.h} fill="var(--brass)" /> : null,
        )}
        {/* the single glowing window: the only thing that moves on its own */}
        {active !== null && (
          <motion.rect
            key={glowKey}
            x={houses[active].win.x}
            y={houses[active].win.y}
            width={houses[active].win.w}
            height={houses[active].win.h}
            fill="var(--brass)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.2, times: [0, 0.25, 0.7, 1], ease: 'easeInOut' }}
            data-testid="skyline-glow"
          />
        )}
      </svg>
    </motion.div>
  );
}
