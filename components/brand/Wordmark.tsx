'use client';
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react';
import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { P } from '@/lib/illustrationPalette';
import { GLYPHS, GLYPHS_BOLD } from './wordmarkGlyphs';

/**
 * The HomeStretch wordmark. "Home" in ink, "Stretch" in pine, Public Sans at -0.03em as outlines (crisp at
 * any size): 600 in the header, 700 on the intro's title card. A pine road runs under "Stretch", rises
 * slightly and ends at a small brass house mark whose window glows like the 3D house's windows. A very soft
 * contact shadow sits under the word. Units: em = 100; baseline y = 0.
 */
type Glyphs = typeof GLYPHS | typeof GLYPHS_BOLD;
const HOME_END = 4; // letters [0,4) are "Home"
function geom(g: Glyphs) {
  const L = g.letters;
  const S = L[HOME_END];
  const LAST = L[L.length - 1];
  const MARK = { x: g.width + 7, w: 46, base: 3 };
  const ROAD_Y = 12;
  const road = `M${S.x1 + 3} ${ROAD_Y}H${LAST.x2 - 8}C${LAST.x2 + 4} ${ROAD_Y} ${MARK.x + 8} ${MARK.base + 1} ${MARK.x + MARK.w * 0.5} ${MARK.base}`;
  const vb = { x: -6, y: -84, w: MARK.x + MARK.w + 12, h: 84 + 30 };
  return { g, L, MARK, ROAD_Y, road, vb, viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}`, aspect: vb.w / vb.h };
}
const G6 = geom(GLYPHS);
const G7 = geom(GLYPHS_BOLD);
export const WM_ASPECT = G6.aspect;
export const WM_TITLE_ASPECT = G7.aspect;

/** The house mark: brass roof and walls lit from the top-left, a glowing window, a door. Drawn at (0, base). */
function MarkShape({ id, lit = 1 }: { id: string; lit?: number }) {
  const fade = { transition: 'opacity 320ms cubic-bezier(0.23,1,0.32,1)' };
  return (
    <g>
      {/* window glow (the same warm emissive as the 3D windows) */}
      <circle cx={17.5} cy={-14} r={11} fill={P.honey} filter={`url(#mg${id})`} style={{ ...fade, opacity: 0.85 * lit }} />
      {/* walls: lit front, shaded right */}
      <path d="M5 0V-27H41V0Z" fill={P.brass} />
      <path d="M29 0V-27H41V0Z" fill={P.brassDark} opacity={0.55} />
      {/* roof: lit left slope, shaded right slope, a little eave */}
      <path d="M-1 -25L23 -47L23 -40.5L5.5 -24.5Z" fill={P.honey} />
      <path d="M23 -47L47 -25L40.5 -24.5L23 -40.5Z" fill={P.brassDark} />
      <path d="M5.5 -24.5L23 -40.5L40.5 -24.5Z" fill={P.brass} />
      {/* window: glass that lights up */}
      <rect x={12.5} y={-19} width={10} height={10} rx={1.2} fill={P.brassDark} />
      <rect x={12.5} y={-19} width={10} height={10} rx={1.2} fill={`url(#mw${id})`} style={{ ...fade, opacity: lit }} />
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

const shadowEl = (G: ReturnType<typeof geom>, id: string) => (
  <ellipse cx={(G.g.width + G.MARK.w) / 2} cy={G.ROAD_Y + 12} rx={(G.g.width + G.MARK.w) * 0.47} ry={4.5} fill={P.ink} opacity={0.1} filter={`url(#cs${id})`} />
);

/** Static wordmark (600). `height` in px; width follows the aspect ratio. */
export function Wordmark({
  height = 28,
  className = '',
  svgClassName,
  title = 'HomeStretch',
  slot = false,
}: {
  height?: number;
  className?: string;
  /** size the svg with CSS instead (e.g. responsive heights); width follows the viewBox */
  svgClassName?: string;
  title?: string;
  /** the header slot the title card lands on */
  slot?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const G = G6;
  return (
    <span className={`inline-block ${className}`} data-brand-slot={slot || undefined}>
      <svg width={svgClassName ? undefined : height * G.aspect} height={svgClassName ? undefined : height} viewBox={G.viewBox} role="img" aria-label={title} className={`block overflow-visible ${svgClassName ?? ''}`} style={svgClassName ? { aspectRatio: String(G.aspect) } : undefined}>
        <Defs id={id} />
        {shadowEl(G, id)}
        {G.L.map((g, i) => (
          <path key={i} d={g.d} fill={i < HOME_END ? P.ink : P.pine} />
        ))}
        <path d={G.road} fill="none" stroke={P.pine} strokeWidth={4.6} strokeLinecap="round" />
        <g transform={`translate(${G.MARK.x} ${G.MARK.base})`}>
          <MarkShape id={id} />
        </g>
      </svg>
    </span>
  );
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
 * The intro's title card: the wordmark (700) as the hero of the intro. Timeline from mount (seconds):
 * letters rise from a mask 0.05 + i×0.035 (450ms, blur→sharp) · road draws 0.5–1.0 with a glowing tip ·
 * mark pops 1.0 (spring, bounce 0.2) · window lights 1.08 · tagline fades in 1.38 · one shimmer during
 * the 1.2s hold · done 2.3 (then the intro flies it to the header).
 */
export const TITLE_T = { letters: 0.05, stagger: 0.035, letter: 0.45, road: 0.5, roadDur: 0.5, mark: 1.0, light: 1.08, tagline: 1.38, shimmer: 1.5, shimmerDur: 0.7, done: 2.3 };
const EASE = [0.23, 1, 0.32, 1] as const;

type TitleProps = { width: number; tagline?: string; leaving?: boolean; onMarkLit?: () => void; svgRef?: React.Ref<SVGSVGElement> };
export const WordmarkTitle = forwardRef<HTMLDivElement, TitleProps>(function WordmarkTitle({ width, tagline, leaving = false, onMarkLit, svgRef }, ref) {
  const id = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  const G = G7;
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
  const unit = width / G.vb.w; // px per viewBox unit
  const blurU = Math.max(2, 4 / unit); // 4px of blur in viewBox units
  const roadW = Math.max(4.6, Math.min(6, width / 150) / unit); // ~6px on desktop
  const height = width / G.aspect;
  return (
    <div ref={ref} className="relative inline-block" style={{ width }}>
      {/* a soft paper-coloured glow behind the letters keeps them crisp over the 3D scene */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute"
        style={{ left: '-14%', right: '-14%', top: '-60%', bottom: tagline ? '-110%' : '-60%', background: P.skyBottom, borderRadius: '50%', filter: 'blur(56px)' }}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: leaving ? 0 : 0.7 }}
        transition={{ duration: leaving ? 0.2 : 0.5, ease: EASE }}
      />
      <svg ref={svgRef} width={width} height={height} viewBox={G.viewBox} role="img" aria-label="HomeStretch" className="relative block overflow-visible">
        <Defs id={id} />
        <defs>
          <clipPath id={`clip${id}`}>
            <rect x={G.vb.x} y={G.vb.y} width={G.g.width + 10} height={-G.vb.y + 3} />
          </clipPath>
          <mask id={`mk${id}`}>
            {G.L.map((g, i) => (
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
          {shadowEl(G, id)}
        </motion.g>
        {/* letters rise from a mask, one by one, blur → sharp */}
        <g clipPath={`url(#clip${id})`}>
          {G.L.map((g, i) => {
            const at = TITLE_T.letters + i * TITLE_T.stagger;
            const fill = i < HOME_END ? P.ink : P.pine;
            return (
              <motion.g key={i} initial={reduce ? false : { y: 88 }} animate={{ y: 0 }} transition={{ duration: TITLE_T.letter, ease: EASE, delay: at }}>
                {/* the soft ghost (blur → sharp without a per-frame filter): a wide, faint stroke of the glyph */}
                <motion.path d={g.d} fill={fill} stroke={fill} strokeWidth={blurU * 2.2} strokeLinejoin="round" initial={reduce ? { opacity: 0 } : { opacity: 0.38 }} animate={{ opacity: 0 }} transition={{ duration: TITLE_T.letter * 0.8, ease: EASE, delay: at + 0.08 }} />
                <motion.path d={g.d} fill={fill} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: TITLE_T.letter * 0.8, ease: EASE, delay: at + 0.08 }} />
              </motion.g>
            );
          })}
        </g>
        {/* one shimmer across the letters during the hold */}
        {!reduce && (
          <g mask={`url(#mk${id})`}>
            <motion.rect x={-140} y={G.vb.y} width={140} height={-G.vb.y + 4} fill={`url(#sh${id})`} initial={{ x: 0 }} animate={{ x: G.g.width + 150 }} transition={{ duration: TITLE_T.shimmerDur, ease: [0.45, 0, 0.55, 1], delay: TITLE_T.shimmer }} />
          </g>
        )}
        {/* the road draws under "Stretch" with a glowing tip */}
        <motion.path ref={road} d={G.road} fill="none" stroke={P.pine} strokeWidth={roadW} strokeLinecap="round" style={{ pathLength: p }} />
        <g ref={dot} style={{ opacity: 0 }}>
          <circle r={7} fill={P.honey} opacity={0.9} filter={`url(#dg${id})`} />
          <circle r={3} fill={P.glow} />
        </g>
        {/* the house mark pops in at the end of the road; its window lights */}
        <g transform={`translate(${G.MARK.x} ${G.MARK.base})`}>
          <motion.g style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }} initial={reduce ? false : { scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ scale: { type: 'spring', duration: 0.45, bounce: 0.2, delay: TITLE_T.mark }, opacity: { duration: 0.12, delay: TITLE_T.mark } }}>
            <MarkShape id={id} lit={lit} />
          </motion.g>
        </g>
      </svg>
      {tagline && (
        <motion.p
          className="relative mt-[0.6em] text-center font-normal text-ink-2"
          style={{ fontSize: 'clamp(17px, 1.55vw, 22px)', lineHeight: 1.3 }}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={leaving ? { opacity: 0, y: 0 } : { opacity: 1, y: 0 }}
          transition={leaving ? { duration: 0.15 } : { duration: 0.3, ease: EASE, delay: TITLE_T.tagline }}
        >
          {tagline}
        </motion.p>
      )}
    </div>
  );
});
