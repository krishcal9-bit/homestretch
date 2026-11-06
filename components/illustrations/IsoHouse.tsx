'use client';
import { motion, useReducedMotion } from 'motion/react';
import { useId } from 'react';
import { ease } from '@/lib/motion';

/**
 * The isometric house: Homestretch's one recurring object (intro, Keys marker, result build, staff Homes).
 * Hand-authored geometry in a fake-3D projection (front face + receding side face), stroke-based.
 * Origin (0,0) is the front-left bottom corner; y grows downward.
 */
export const ISO = { W: 60, H: 44, R: 26, dx: 24, dy: 14 };
const { W, H, R, dx, dy } = ISO;
export const ISO_VB = { x: -4, y: -(H + R + dy + 6), w: W + dx + 8, h: H + R + dy + 10 };
export const ISO_VIEWBOX = `${ISO_VB.x} ${ISO_VB.y} ${ISO_VB.w} ${ISO_VB.h}`;
/** Pixel position of a house-space point inside an IsoHouse rendered at `size` px wide. */
export const isoPx = (size: number, x: number, y: number) => ({ x: ((x - ISO_VB.x) * size) / ISO_VB.w, y: ((y - ISO_VB.y) * size) / ISO_VB.w });
export const isoPaths = {
  floor: `M0 0H${W}L${W + dx} ${-dy}H${dx}Z`,
  front: `M0 0V${-H}H${W}V0Z`,
  side: `M${W} 0L${W + dx} ${-dy}V${-dy - H}L${W} ${-H}`,
  roofFront: `M-3 ${-H + 2}L${W / 2} ${-H - R}L${W + 3} ${-H + 2}`,
  roofSide: `M${W / 2} ${-H - R}L${W / 2 + dx} ${-H - R - dy}L${W + dx + 3} ${-H - dy + 2}L${W + 3} ${-H + 2}`,
  door: { x: W * 0.4, y: -H * 0.58, w: W * 0.2, h: H * 0.58 },
  win: { x: W * 0.1, y: -H * 0.72, w: W * 0.2, h: H * 0.26 },
  sideWin: `M${W + dx * 0.3} ${-dy * 0.3 - H * 0.45}l${dx * 0.4} ${-dy * 0.4}v${-H * 0.26}l${-dx * 0.4} ${dy * 0.4}Z`,
};

export type IsoBuild = 'none' | 'full' | 'intro' | 'quick' | 'short';
/** seconds scale for each build variant: full ≈ 1.25s (intro), quick ≈ 0.6s (result), short ≈ 0.4s (plan page) */
const SCALE: Record<Exclude<IsoBuild, 'none'>, number> = { full: 1, intro: 0.8, quick: 0.48, short: 0.32 };

export function IsoHouse({
  size = 96,
  build = 'none',
  delay = 0,
  lit = false,
  doorBrass = true,
  doorOpen = false,
  stroke = 'var(--pine)',
  strokeWidth = 2,
  className = '',
  title,
}: {
  size?: number;
  build?: IsoBuild;
  delay?: number;
  lit?: boolean;
  doorBrass?: boolean;
  doorOpen?: boolean;
  stroke?: string;
  strokeWidth?: number;
  className?: string;
  title?: string;
}) {
  const reduce = useReducedMotion();
  const glowId = useId().replace(/:/g, '');
  const animate = build !== 'none' && !reduce;
  const k = build === 'none' ? 1 : SCALE[build];
  const at = (t: number) => delay + t * k;
  const draw = (t: number, d = 0.25) => (animate ? { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { pathLength: { duration: d * k, ease: ease.out, delay: at(t) }, opacity: { duration: 0.01, delay: at(t) } } } : {});
  const sw = { stroke, strokeWidth, fill: 'none', strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const, vectorEffect: 'non-scaling-stroke' as const };
  const d = isoPaths.door;
  const w = isoPaths.win;
  return (
    <svg width={size} height={(size * ISO_VB.h) / ISO_VB.w} viewBox={ISO_VIEWBOX} className={`overflow-visible ${className}`} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <filter id={`g${glowId}`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      {/* floor outline draws first */}
      <motion.path d={isoPaths.floor} {...sw} strokeOpacity={0.5} {...draw(0, 0.25)} />
      {/* walls extrude upward from the floor */}
      <motion.g
        style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
        initial={animate ? { scaleY: 0.05, opacity: 0 } : false}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{ scaleY: { type: 'spring', duration: 0.45 * Math.max(k, 0.6), bounce: 0, delay: at(0.2) }, opacity: { duration: 0.05, delay: at(0.2) } }}
      >
        <path d={isoPaths.front} {...sw} fill="var(--surface)" />
        <path d={isoPaths.side} {...sw} fill="var(--pine-soft)" />
      </motion.g>
      {/* roof drops in and settles (the one place a little bounce is allowed) */}
      <motion.g
        initial={animate ? { y: -40, opacity: 0 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ y: { type: 'spring', duration: 0.5 * Math.max(k, 0.6), bounce: 0.15, delay: at(0.55) }, opacity: { duration: 0.12, delay: at(0.55) } }}
      >
        <path d={isoPaths.roofSide} {...sw} fill="var(--surface)" />
        <path d={isoPaths.roofFront} {...sw} fill="var(--surface)" />
      </motion.g>
      {/* door: outline draws, then fills brass from the bottom up; swings open slightly */}
      <motion.g style={{ transformBox: 'fill-box', transformOrigin: '0% 100%' }} initial={false} animate={{ skewY: doorOpen ? -12 : 0, scaleX: doorOpen ? 0.82 : 1 }} transition={{ duration: 0.3, ease: ease.out }}>
        {doorBrass && (
          <motion.rect
            x={d.x}
            y={d.y}
            width={d.w}
            height={d.h}
            fill="var(--brass)"
            initial={animate ? { clipPath: 'inset(100% 0 0 0)' } : false}
            animate={{ clipPath: 'inset(0% 0 0 0)' }}
            transition={{ duration: 0.25 * k, ease: ease.out, delay: at(0.95) }}
          />
        )}
        <motion.rect x={d.x} y={d.y} width={d.w} height={d.h} {...sw} stroke={doorBrass ? 'var(--brass)' : stroke} {...draw(0.8, 0.18)} />
      </motion.g>
      {/* windows draw; the window light turns on with a soft brass glow */}
      <motion.rect x={w.x} y={w.y} width={w.w} height={w.h} {...sw} {...draw(1.0, 0.15)} />
      <motion.path d={isoPaths.sideWin} {...sw} {...draw(1.05, 0.15)} />
      <motion.g initial={animate ? { opacity: 0 } : false} animate={{ opacity: lit ? 1 : 0 }} transition={{ duration: lit ? 0.3 : 0.4, ease: ease.out, delay: lit && animate ? at(1.2) : 0 }}>
        <rect x={w.x - 2} y={w.y - 2} width={w.w + 4} height={w.h + 4} fill="var(--brass)" opacity={0.55} filter={`url(#g${glowId})`} />
        <rect x={w.x} y={w.y} width={w.w} height={w.h} fill="var(--brass)" />
      </motion.g>
    </svg>
  );
}
