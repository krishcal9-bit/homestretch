'use client';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useState } from 'react';
import { ease } from '@/lib/motion';
import { P, alpha } from '@/lib/illustrationPalette';

/**
 * The 2D house: Homestretch's recurring object wherever the 3D canvas isn't used (the Road's Keys marker,
 * staff Homes, small cards, scene illustrations). A shaded, dimensional drawing in an oblique projection:
 * the front gable face catches the light (top-left), the side wall and roof plane turn away into shade,
 * a soft shadow falls to the right. Every part is its own group so it can build in with overlap.
 * Origin (0,0) is the front-left bottom corner; y grows downward. Geometry constants are shared (ISO).
 */
export const ISO = { W: 60, H: 44, R: 26, dx: 24, dy: 14 };
const { W, H, R, dx, dy } = ISO;
export const ISO_VB = { x: -4, y: -(H + R + dy + 6), w: W + dx + 8, h: H + R + dy + 10 };
export const ISO_VIEWBOX = `${ISO_VB.x} ${ISO_VB.y} ${ISO_VB.w} ${ISO_VB.h}`;
/** Pixel position of a house-space point inside a house rendered at `size` px wide. */
export const isoPx = (size: number, x: number, y: number) => ({ x: ((x - ISO_VB.x) * size) / ISO_VB.w, y: ((y - ISO_VB.y) * size) / ISO_VB.w });
export const isoPaths = {
  floor: `M0 0H${W}L${W + dx} ${-dy}H${dx}Z`,
  front: `M0 0V${-H}H${W}V0Z`,
  side: `M${W} 0L${W + dx} ${-dy}V${-dy - H}L${W} ${-H}Z`,
  gable: `M-1 ${-H + 0.5}L${W / 2} ${-H - R}L${W + 1} ${-H + 0.5}Z`,
  roofSide: `M${W / 2} ${-H - R}L${W / 2 + dx} ${-H - R - dy}L${W + dx + 4} ${-H - dy + 3}L${W + 4} ${-H + 3}Z`,
  door: { x: W * 0.4, y: -H * 0.6, w: W * 0.2, h: H * 0.6 },
  win: { x: W * 0.08, y: -H * 0.74, w: W * 0.22, h: H * 0.3 },
  sideWin: `M${W + dx * 0.3} ${-dy * 0.3 - H * 0.42}l${dx * 0.42} ${-dy * 0.42}v${-H * 0.3}l${-dx * 0.42} ${dy * 0.42}Z`,
};

export type IsoBuild = 'none' | 'full' | 'intro' | 'quick' | 'short';
export type HouseStage = 'finished' | 'roofing' | 'framing';
/** seconds scale for each build variant: full ≈ 1.25s, quick ≈ 0.6s (result), short ≈ 0.4s (plan page) */
const SCALE: Record<Exclude<IsoBuild, 'none'>, number> = { full: 1, intro: 0.8, quick: 0.48, short: 0.32 };
const settle = { type: 'spring', bounce: 0.15 } as const;

export function IsoHouse({
  size = 96,
  build = 'none',
  delay = 0,
  lit = false,
  porch = false,
  doorBrass = true,
  doorOpen = false,
  stage = 'finished',
  ground = true,
  detail,
  className = '',
  title,
}: {
  size?: number;
  build?: IsoBuild;
  delay?: number;
  lit?: boolean;
  porch?: boolean;
  doorBrass?: boolean;
  doorOpen?: boolean;
  stage?: HouseStage;
  /** lawn patch + soft shadow under the house */
  ground?: boolean;
  /** small details (mullions, glare, shrub); defaults on above 56px */
  detail?: boolean;
  /** kept for compatibility with the outline version; ignored */
  stroke?: string;
  strokeWidth?: number;
  className?: string;
  title?: string;
}) {
  const reduce = useReducedMotion();
  const id = useId().replace(/:/g, '');
  const animate = build !== 'none' && !reduce;
  const k = build === 'none' ? 1 : SCALE[build];
  const at = (t: number) => delay + t * k;
  const fine = detail ?? size >= 56;
  // the first light waits for the build; later ones are immediate
  const [built, setBuilt] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    const t = setTimeout(() => setBuilt(true), (delay + 1.25 * k) * 1000);
    return () => clearTimeout(t);
  }, [animate, delay, k]);
  const d = isoPaths.door;
  const w = isoPaths.win;
  const door = doorBrass ? P.brass : P.slateLight;
  const doorDeep = doorBrass ? P.brassDark : P.slateDark;
  const framing = stage === 'framing';
  const roofing = stage === 'roofing';
  const pop = (t: number) =>
    animate ? { initial: { opacity: 0, scale: 0.85 }, animate: { opacity: 1, scale: 1 }, transition: { ...settle, duration: 0.4 * Math.max(k, 0.6), delay: at(t) } } : {};

  return (
    <svg width={size} height={(size * ISO_VB.h) / ISO_VB.w} viewBox={ISO_VIEWBOX} className={`overflow-visible ${className}`} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <filter id={`sh${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
        <filter id={`gl${id}`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <linearGradient id={`fw${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.trim} />
          <stop offset="0.55" stopColor={P.wall} />
          <stop offset="1" stopColor={P.wallShade} />
        </linearGradient>
        <linearGradient id={`sw${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.wallShade} />
          <stop offset="1" stopColor={P.wallDeep} />
        </linearGradient>
        <linearGradient id={`rf${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.slateLight} />
          <stop offset="1" stopColor={P.slate} />
        </linearGradient>
        <radialGradient id={`wl${id}`}>
          <stop offset="0" stopColor={alpha(P.honey, 0.45)} />
          <stop offset="0.6" stopColor={alpha(P.honey, 0.14)} />
          <stop offset="1" stopColor={alpha(P.honey, 0)} />
        </radialGradient>
        <linearGradient id={`lw${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.honeyLight} />
          <stop offset="1" stopColor={P.honey} />
        </linearGradient>
      </defs>

      {/* ground: soft shadow to the right (light from the top-left) and a lawn patch */}
      {ground && (
        <motion.g initial={animate ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.3 * k, delay: at(0) }}>
          <path d={`M-6 4L${W + 4} 4L${W + dx + 14} ${-dy + 2}L${dx + 4} ${-dy + 2}Z`} fill={P.sage} />
          <path d={`M-6 4L${W + 4} 4L${W + 4} 7L-6 7Z`} fill={P.sageDark} />
          <path d={`M${W + 4} 4L${W + dx + 14} ${-dy + 2}L${W + dx + 14} ${-dy + 5}L${W + 4} 7Z`} fill={P.sageDark} opacity={0.8} />
          <ellipse cx={W / 2 + dx * 0.75} cy={-dy / 2 + 1} rx={W * 0.62} ry={dy * 0.55} fill={P.shadow} filter={`url(#sh${id})`} />
        </motion.g>
      )}

      {/* night on a building site: the work light's warm wash behind the frame (dark theme only) */}
      {(framing || roofing) && (
        <g className="il-light" style={{ '--i': 1 } as React.CSSProperties}>
          <ellipse cx={W * 0.62} cy={-H * 0.42} rx={W * 0.62} ry={H * 0.62} fill={`url(#wl${id})`} />
        </g>
      )}

      {/* walls: rise from the floor (overlap: side first, front 60ms later) */}
      <motion.g
        style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
        initial={animate ? { scaleY: 0.05, opacity: 0 } : false}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{ scaleY: { type: 'spring', duration: 0.45 * Math.max(k, 0.6), bounce: 0, delay: at(0.2) }, opacity: { duration: 0.05, delay: at(0.2) } }}
      >
        {framing ? (
          <g fill={P.timber}>
            <path d={isoPaths.floor} fill={P.stoneShade} />
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <rect key={`f${f}`} x={f * W - 1.6} y={-H} width={3.2} height={H} />
            ))}
            {[0.33, 0.66, 1].map((f) => (
              <path key={`s${f}`} d={`M${W + dx * f - 1.4} ${-dy * f}v${-H}h2.8v${H}Z`} fill={P.timberShade} />
            ))}
            <rect x={-1} y={-H - 1.6} width={W + 2} height={3.2} />
            <path d={`M${W} ${-H - 1.6}L${W + dx} ${-H - dy - 1.6}v3.2L${W} ${-H + 1.6}Z`} fill={P.timberShade} />
            <rect x={-1} y={-1.6} width={W + 2} height={3.2} fill={P.timberShade} />
          </g>
        ) : (
          <>
            <path d={isoPaths.side} fill={`url(#sw${id})`} />
            <path d={isoPaths.front} fill={`url(#fw${id})`} />
            {/* foundation band */}
            <path d={`M0 0V-3H${W}V0Z`} fill={P.stoneShade} />
            <path d={`M${W} 0L${W + dx} ${-dy}V${-dy - 3}L${W} -3Z`} fill={P.wallDeep} />
          </>
        )}
      </motion.g>

      {/* roof: gable face + receding roof plane; drops in and settles */}
      <motion.g
        initial={animate ? { y: -40, opacity: 0 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ y: { type: 'spring', duration: 0.5 * Math.max(k, 0.6), bounce: 0.18, delay: at(0.55) }, opacity: { duration: 0.12, delay: at(0.55) } }}
      >
        {framing ? (
          <g stroke={P.timber} strokeWidth={2.6} strokeLinecap="round">
            <path d={`M0 ${-H}L${W / 2} ${-H - R}L${W} ${-H}`} fill="none" />
            {[0.33, 0.66, 1].map((f) => (
              <path key={f} d={`M${dx * f} ${-H - dy * f}L${W / 2 + dx * f} ${-H - R - dy * f}L${W + dx * f} ${-H - dy * f}`} fill="none" stroke={P.timberShade} />
            ))}
            <path d={`M${W / 2} ${-H - R}L${W / 2 + dx} ${-H - R - dy}`} fill="none" />
          </g>
        ) : (
          <>
            <path d={isoPaths.gable} fill={`url(#fw${id})`} />
            {roofing ? (
              <>
                {/* half shingled, half bare rafters */}
                <path d={isoPaths.roofSide} fill={P.timberShade} opacity={0.55} />
                <path d={`M${W / 2} ${-H - R}L${W / 2 + dx * 0.55} ${-H - R - dy * 0.55}L${W + dx * 0.55 + 4} ${-H - dy * 0.55 + 3}L${W + 4} ${-H + 3}Z`} fill={`url(#rf${id})`} />
                {[0.7, 0.85, 1].map((f) => (
                  <path key={f} d={`M${W / 2 + dx * f} ${-H - R - dy * f}L${W + 4 + dx * f} ${-H + 3 - dy * f}`} stroke={P.timber} strokeWidth={2.2} />
                ))}
              </>
            ) : (
              <>
                <path d={isoPaths.roofSide} fill={`url(#rf${id})`} />
                {/* shingle courses */}
                {fine &&
                  [0.25, 0.5, 0.75].map((f) => (
                    <path key={f} d={`M${W / 2 + (W / 2 + 4) * f} ${-H - R + (R + 3) * f}l${dx} ${-dy}`} stroke={P.slate} strokeWidth={0.8} opacity={0.6} />
                  ))}
                {/* ridge highlight */}
                <path d={`M${W / 2} ${-H - R}L${W / 2 + dx} ${-H - R - dy}`} stroke={P.glassLight} strokeWidth={1.4} strokeLinecap="round" opacity={0.7} />
              </>
            )}
            {/* white bargeboards on the gable */}
            <path d={`M-3 ${-H + 2.5}L${W / 2} ${-H - R - 1}L${W + 3} ${-H + 2.5}`} fill="none" stroke={P.trim} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
            {/* roof thickness along the rake */}
            <path d={`M${W / 2 + 0.5} ${-H - R + 0.8}L${W + 3.5} ${-H + 3}`} stroke={P.slateDark} strokeWidth={1.2} />
            {/* chimney */}
            {!roofing && (
              <g>
                <path d={`M${W / 2 + dx * 0.55 + 6} ${-H - R - dy * 0.55 + 4}v-14h6v14Z`} fill={P.stone} />
                <path d={`M${W / 2 + dx * 0.55 + 12} ${-H - R - dy * 0.55 + 4}v-14l3.5 -2v13Z`} fill={P.stoneShade} />
                <path d={`M${W / 2 + dx * 0.55 + 5} ${-H - R - dy * 0.55 - 10}h8.5l3.5 -2h-8.5Z`} fill={P.slateDark} />
              </g>
            )}
          </>
        )}
      </motion.g>

      {!framing && (
        <>
          {/* door: frame, brass door (fills from the bottom), step and mat */}
          <motion.g {...pop(0.8)} style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
            <rect x={d.x - 2} y={d.y - 2} width={d.w + 4} height={d.h + 2} fill={P.trim} />
            <rect x={d.x} y={d.y} width={d.w} height={d.h} fill={doorOpen ? P.glow : doorDeep} />
            <motion.g style={{ transformBox: 'fill-box', transformOrigin: '0% 100%' }} initial={false} animate={{ skewY: doorOpen ? -12 : 0, scaleX: doorOpen ? 0.72 : 1 }} transition={{ type: 'spring', duration: 0.45, bounce: 0.2 }}>
              <motion.rect x={d.x} y={d.y} width={d.w} height={d.h} fill={roofing ? P.slateLight : door} initial={animate ? { clipPath: 'inset(100% 0 0 0)' } : false} animate={{ clipPath: 'inset(0% 0 0 0)' }} transition={{ duration: 0.25 * k, ease: ease.out, delay: at(0.95) }} />
              {fine && !roofing && (
                <>
                  <rect x={d.x + d.w * 0.22} y={d.y + d.h * 0.12} width={d.w * 0.56} height={d.h * 0.32} fill={doorDeep} opacity={0.55} />
                  <rect x={d.x + d.w * 0.22} y={d.y + d.h * 0.52} width={d.w * 0.56} height={d.h * 0.32} fill={doorDeep} opacity={0.55} />
                  <circle cx={d.x + d.w * 0.8} cy={d.y + d.h * 0.55} r={0.9} fill={P.honeyLight} />
                </>
              )}
            </motion.g>
            <rect x={d.x - 4} y={-2} width={d.w + 8} height={3} fill={P.stone} />
            {fine && <rect x={d.x + 1} y={-1.6} width={d.w - 2} height={1.4} fill={P.slateLight} opacity={0.7} />}
          </motion.g>

          {/* porch light (appears with the door) */}
          <motion.g {...pop(0.8)}>
            <motion.circle cx={d.x - 4.5} cy={d.y + 4} r={6} fill={P.honey} filter={`url(#gl${id})`} initial={false} animate={{ opacity: porch ? 0.8 : 0 }} transition={{ duration: 0.4 }} />
            <rect x={d.x - 5.6} y={d.y + 2.2} width={2.2} height={3.6} rx={0.6} fill={porch ? P.honeyLight : P.slateLight} />
          </motion.g>

          {/* windows: frames, glass with a glare stripe, mullions, sills */}
          <motion.g {...pop(1.0)} style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}>
            <rect x={w.x - 1.8} y={w.y - 1.8} width={w.w + 3.6} height={w.h + 3.6} fill={P.trim} />
            <rect x={w.x} y={w.y} width={w.w} height={w.h} fill={roofing ? P.slateDark : P.glass} />
            {fine && !roofing && <path d={`M${w.x + w.w * 0.15} ${w.y + w.h}L${w.x + w.w * 0.55} ${w.y}h${w.w * 0.18}L${w.x + w.w * 0.33} ${w.y + w.h}Z`} fill={P.glassLight} opacity={0.45} />}
            <rect x={w.x - 3} y={w.y + w.h + 1.6} width={w.w + 6} height={2} fill={P.trimShade} />
          </motion.g>
          <motion.g {...pop(1.05)}>
            <path d={isoPaths.sideWin} fill={roofing ? P.slateDark : P.glass} stroke={P.trimShade} strokeWidth={1.8} strokeLinejoin="round" />
          </motion.g>

          {/* the light: brass glow + lit glass (the emotional signal) */}
          <motion.g initial={animate ? { opacity: 0 } : false} animate={{ opacity: lit ? 1 : 0 }} transition={{ duration: lit ? 0.35 : 0.4, ease: ease.out, delay: lit && animate && !built ? at(1.2) : 0 }}>
            <rect x={w.x - 3} y={w.y - 3} width={w.w + 6} height={w.h + 6} fill={P.honey} opacity={0.6} filter={`url(#gl${id})`} />
            <rect x={w.x} y={w.y} width={w.w} height={w.h} fill={`url(#lw${id})`} />
          </motion.g>
          {fine && (
            <motion.g fill={P.trim} {...pop(1.0)} style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}>
              <rect x={w.x + w.w / 2 - 0.7} y={w.y} width={1.4} height={w.h} />
              <rect x={w.x} y={w.y + w.h / 2 - 0.7} width={w.w} height={1.4} />
            </motion.g>
          )}

          {/* shrub by the door */}
          {fine && (
            <motion.g {...pop(1.15)} style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
              <circle cx={W * 0.86} cy={-4.5} r={6} fill={P.tree} />
              <circle cx={W * 0.76} cy={-3.5} r={4.6} fill={P.treeLight} />
              <circle cx={W * 0.745} cy={-5} r={1.6} fill={P.pineLighter} opacity={0.6} />
            </motion.g>
          )}
        </>
      )}

      {/* the work light itself: a lamp head on a tripod at the front corner of the lot (night only) */}
      {(framing || roofing) && (
        <g className="il-light" style={{ '--i': 0 } as React.CSSProperties}>
          <path d={`M${W + 10} 5L${W + 13} -9L${W + 16} 5M${W + 13} -9V4`} fill="none" stroke={P.slateDark} strokeWidth={1.1} strokeLinecap="round" />
          <circle cx={W + 13} cy={-11.5} r={7} fill={alpha(P.honey, 0.35)} />
          <rect x={W + 9.5} y={-14.5} width={7} height={5} rx={1} fill={P.slate} />
          <rect x={W + 10.3} y={-13.7} width={5.4} height={3.4} rx={0.6} fill={P.glow} />
        </g>
      )}
    </svg>
  );
}
