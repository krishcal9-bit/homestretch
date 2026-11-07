'use client';
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';
import { P } from '@/lib/illustrationPalette';
import { GLYPHS } from './wordmarkGlyphs';

/**
 * The HomeStretch wordmark. "Home" in ink, "Stretch" in pine, Public Sans 600 at -0.03em as outlines
 * (crisp at any size). A pine road runs under "Stretch", rises slightly and ends at a small brass house
 * mark whose window glows like the 3D house's windows. A very soft contact shadow sits under the word.
 * Units: em = 100; baseline y = 0.
 */
const L = GLYPHS.letters;
const HOME_END = 4; // letters [0,4) are "Home"
const S = L[HOME_END];
const LAST = L[L.length - 1];
const MARK = { x: GLYPHS.width + 7, w: 46, base: 3 };
const ROAD_Y = 12;
/** Road under "Stretch": straight, then rising into the mark's door. */
export const ROAD_D = `M${S.x1 + 3} ${ROAD_Y}H${LAST.x2 - 8}C${LAST.x2 + 4} ${ROAD_Y} ${MARK.x + 8} ${MARK.base + 1} ${MARK.x + MARK.w * 0.5} ${MARK.base}`;
export const WM_VIEWBOX = { x: -6, y: -84, w: MARK.x + MARK.w + 12, h: 84 + 30 };
const VB = `${WM_VIEWBOX.x} ${WM_VIEWBOX.y} ${WM_VIEWBOX.w} ${WM_VIEWBOX.h}`;
export const WM_ASPECT = WM_VIEWBOX.w / WM_VIEWBOX.h;

/** The house mark: brass roof and walls lit from the top-left, a glowing window, a door. Drawn at (0, base). */
function MarkShape({ id, lit = 1 }: { id: string; lit?: number }) {
  return (
    <g>
      {/* window glow (the same warm emissive as the 3D windows) */}
      <circle cx={17.5} cy={-14} r={11} fill={P.honey} filter={`url(#mg${id})`} style={{ opacity: 0.85 * lit, transition: 'opacity 320ms cubic-bezier(0.23,1,0.32,1)' }} />
      {/* walls: lit front, shaded right */}
      <path d="M5 0V-27H41V0Z" fill={P.brass} />
      <path d="M29 0V-27H41V0Z" fill={P.brassDark} opacity={0.55} />
      {/* roof: lit left slope, shaded right slope, a little eave */}
      <path d="M-1 -25L23 -47L23 -40.5L5.5 -24.5Z" fill={P.honey} />
      <path d="M23 -47L47 -25L40.5 -24.5L23 -40.5Z" fill={P.brassDark} />
      <path d="M5.5 -24.5L23 -40.5L40.5 -24.5Z" fill={P.brass} />
      {/* window: glass that lights up */}
      <rect x={12.5} y={-19} width={10} height={10} rx={1.2} fill={P.brassDark} />
      <rect x={12.5} y={-19} width={10} height={10} rx={1.2} fill={`url(#mw${id})`} style={{ opacity: lit, transition: 'opacity 320ms cubic-bezier(0.23,1,0.32,1)' }} />
      <path d="M17.5 -19V-9M12.5 -14H22.5" stroke={P.brass} strokeWidth={1.1} opacity={0.7} />
      {/* door */}
      <rect x={27} y={-15} width={8} height={15} rx={1} fill={P.brassDark} />
    </g>
  );
}

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <filter id={`mg${id}`} x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="4.5" />
      </filter>
      <filter id={`cs${id}`} x="-20%" y="-200%" width="140%" height="500%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
      <linearGradient id={`mw${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={P.glow} />
        <stop offset="1" stopColor={P.honey} />
      </linearGradient>
    </defs>
  );
}

const shadowEl = (id: string) => <ellipse cx={(GLYPHS.width + MARK.w) / 2} cy={ROAD_Y + 12} rx={(GLYPHS.width + MARK.w) * 0.47} ry={4.5} fill={P.ink} opacity={0.1} filter={`url(#cs${id})`} />;

/** Static wordmark. `height` in px; width follows the aspect ratio. */
export function Wordmark({ height = 24, className = '', layoutId, title = 'HomeStretch' }: { height?: number; className?: string; layoutId?: string; title?: string }) {
  const id = useId().replace(/:/g, '');
  const svg = (
    <svg width={height * WM_ASPECT} height={height} viewBox={VB} role="img" aria-label={title} className="block overflow-visible">
      <Defs id={id} />
      {shadowEl(id)}
      {L.map((g, i) => (
        <path key={i} d={g.d} fill={i < HOME_END ? P.ink : P.pine} />
      ))}
      <path d={ROAD_D} fill="none" stroke={P.pine} strokeWidth={4.2} strokeLinecap="round" />
      <g transform={`translate(${MARK.x} ${MARK.base})`}>
        <MarkShape id={id} />
      </g>
    </svg>
  );
  if (layoutId)
    return (
      <motion.span layoutId={layoutId} className={`inline-block ${className}`} transition={{ type: 'spring', duration: 0.55, bounce: 0 }}>
        {svg}
      </motion.span>
    );
  return <span className={`inline-block ${className}`}>{svg}</span>;
}

/** The mark alone (favicon, app icon, small places). */
export function HouseMark({ size = 32, className = '', title }: { size?: number; className?: string; title?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="-6 -54 58 58" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <Defs id={id} />
      <MarkShape id={id} />
    </svg>
  );
}

/**
 * The title card's animated wordmark (intro). Timeline from mount (seconds):
 * letters rise from a mask 0.05 + i×0.035 (450ms, blur→sharp) · road draws 0.5–1.0 with a glowing tip ·
 * mark pops 1.0 (spring, bounce 0.2) · window lights 1.08 · one shimmer 1.1–1.8.
 */
export const TITLE_T = { letters: 0.05, stagger: 0.035, letter: 0.45, road: 0.5, roadDur: 0.5, mark: 1.0, light: 1.08, shimmer: 1.1, shimmerDur: 0.7, done: 1.8 };
const EASE = [0.23, 1, 0.32, 1] as const;

export function WordmarkTitle({ width, layoutId, onMarkLit }: { width: number; layoutId?: string; onMarkLit?: () => void }) {
  const id = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const road = useRef<SVGPathElement>(null);
  const p = useMotionValue(reduce ? 1 : 0);
  const dot = useRef<SVGGElement>(null);
  const [lit, setLit] = useState(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    const c = animate(p, 1, { duration: TITLE_T.roadDur, ease: [0.65, 0, 0.35, 1], delay: TITLE_T.road });
    const t = setTimeout(() => {
      setLit(1);
      onMarkLit?.();
    }, TITLE_T.light * 1000);
    return () => {
      c.stop();
      clearTimeout(t);
    };
  }, [p, reduce, onMarkLit]);
  // the glowing dot rides the tip of the road as it draws
  useMotionValueEvent(p, 'change', (v) => {
    const el = road.current;
    const d = dot.current;
    if (!el || !d) return;
    const pt = el.getPointAtLength(v * el.getTotalLength());
    d.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
    d.style.opacity = v > 0.01 && v < 0.995 ? '1' : '0';
  });
  const blurU = Math.max(2, (4 / width) * WM_VIEWBOX.w); // 4px of blur in viewBox units
  return (
    <motion.div layoutId={layoutId} className="inline-block" style={{ width }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ type: 'spring', duration: 0.55, bounce: 0 }}>
      <svg width={width} height={width / WM_ASPECT} viewBox={VB} role="img" aria-label="HomeStretch" className="block overflow-visible">
        <Defs id={id} />
        <defs>
          <filter id={`lb${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={blurU} />
          </filter>
          <clipPath id={`clip${id}`}>
            <rect x={WM_VIEWBOX.x} y={WM_VIEWBOX.y} width={GLYPHS.width + 10} height={-WM_VIEWBOX.y + 3} />
          </clipPath>
          <mask id={`mk${id}`}>
            {L.map((g, i) => (
              <path key={i} d={g.d} fill="#fff" />
            ))}
          </mask>
          <linearGradient id={`sh${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.15" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <filter id={`dg${id}`} x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>
        <motion.g initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: TITLE_T.road }}>
          {shadowEl(id)}
        </motion.g>
        {/* letters rise from a mask, one by one, blur → sharp */}
        <g clipPath={`url(#clip${id})`}>
          {L.map((g, i) => {
            const at = TITLE_T.letters + i * TITLE_T.stagger;
            const fill = i < HOME_END ? P.ink : P.pine;
            return (
              <motion.g key={i} initial={reduce ? false : { y: 88 }} animate={{ y: 0 }} transition={{ duration: TITLE_T.letter, ease: EASE, delay: at }}>
                <motion.path d={g.d} fill={fill} filter={`url(#lb${id})`} initial={reduce ? { opacity: 0 } : { opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: TITLE_T.letter * 0.8, ease: EASE, delay: at + 0.08 }} />
                <motion.path d={g.d} fill={fill} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: TITLE_T.letter * 0.8, ease: EASE, delay: at + 0.08 }} />
              </motion.g>
            );
          })}
        </g>
        {/* one shimmer across the letters */}
        {!reduce && (
          <g mask={`url(#mk${id})`}>
            <motion.rect x={-140} y={WM_VIEWBOX.y} width={140} height={-WM_VIEWBOX.y + 4} fill={`url(#sh${id})`} initial={{ x: 0 }} animate={{ x: GLYPHS.width + 150 }} transition={{ duration: TITLE_T.shimmerDur, ease: [0.45, 0, 0.55, 1], delay: TITLE_T.shimmer }} />
          </g>
        )}
        {/* the road draws under "Stretch" with a glowing tip */}
        <motion.path ref={road} d={ROAD_D} fill="none" stroke={P.pine} strokeWidth={4.2} strokeLinecap="round" style={{ pathLength: p }} />
        <g ref={dot} style={{ opacity: 0 }}>
          <circle r={7} fill={P.honey} opacity={0.9} filter={`url(#dg${id})`} />
          <circle r={3} fill={P.glow} />
        </g>
        {/* the house mark pops in at the end of the road; its window lights */}
        <g transform={`translate(${MARK.x} ${MARK.base})`}>
          <motion.g style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }} initial={reduce ? false : { scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ scale: { type: 'spring', duration: 0.45, bounce: 0.2, delay: TITLE_T.mark }, opacity: { duration: 0.12, delay: TITLE_T.mark } }}>
            <MarkShape id={id} lit={lit} />
          </motion.g>
        </g>
      </svg>
    </motion.div>
  );
}
