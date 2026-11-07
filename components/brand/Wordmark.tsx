'use client';
import { motion, useReducedMotion } from 'motion/react';
import { forwardRef, useEffect, useId } from 'react';
import { P } from '@/lib/illustrationPalette';
import { GLYPHS_BOLD } from './wordmarkGlyphs';

/**
 * Keystone: the brand. A stone arch — pine stones shaded like the houses (light from the top-left), with a brass
 * keystone at the top centre that has a small keyhole cut into it — and "Keystone" in Public Sans 700 at -0.03em,
 * ink, as outlines (crisp at any size). The keystone glows softly at night. Units: em = 100, baseline y = 0.
 */
const G = GLYPHS_BOLD;
const INK = 'var(--ink)';
const PINE = 'var(--pine)';
const BRASS = 'var(--brass)';

import { CX, R1, R2, SPRING, STONES, KEYHOLE, type Stone } from './arch';

const ARCH_W = CX + R2; // the arch's right edge (it starts at x = 2)
const TEXT_X = ARCH_W + 22;
const VB = { x: -4, y: -84, w: TEXT_X + G.width + 8, h: 84 + 24 };
const VIEWBOX = `${VB.x} ${VB.y} ${VB.w} ${VB.h}`;
export const WM_ASPECT = VB.w / VB.h;
export const WM_TITLE_ASPECT = WM_ASPECT;

/** Stone fills: one gradient per tone, lit top-left → shaded bottom-right; the keystone in brass. */
function Defs({ id }: { id: string }) {
  const stone = (k: number) => [`color-mix(in srgb, ${PINE} ${Math.round(70 + (1 - k) * 22)}%, #ffffff)`, `color-mix(in srgb, ${PINE} ${Math.round(78 + (1 - k) * 18)}%, #000000)`];
  return (
    <defs>
      {STONES.map((s, i) => {
        const [a, b] = s.key ? [`color-mix(in srgb, ${BRASS} 72%, #ffffff)`, `color-mix(in srgb, ${BRASS} 84%, #000000)`] : stone(s.tone);
        return (
          <linearGradient key={i} id={`st${id}-${i}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={a} />
            <stop offset="1" stopColor={b} />
          </linearGradient>
        );
      })}
      <mask id={`kh${id}`} maskUnits="userSpaceOnUse" x={-10} y={-100} width={120} height={120}>
        <rect x={-10} y={-100} width={120} height={120} fill="#fff" />
        <path d={KEYHOLE} fill="#000" fillRule="nonzero" />
      </mask>
      <filter id={`kg${id}`} x="-150%" y="-150%" width="400%" height="400%">
        <feGaussianBlur stdDeviation="7" />
      </filter>
    </defs>
  );
}

/** The keystone's night glow (dark theme only, via .il-night). */
function KeyGlow({ id }: { id: string }) {
  return <circle className="il-night" cx={CX} cy={SPRING - (R1 + R2) / 2 - 2} r={15} fill={BRASS} opacity={0.55} filter={`url(#kg${id})`} style={{ transition: 'opacity 600ms cubic-bezier(0.23,1,0.32,1)' }} />;
}

function StonePath({ s, i, id }: { s: Stone; i: number; id: string }) {
  return <path d={s.d} fill={`url(#st${id}-${i})`} mask={s.key ? `url(#kh${id})` : undefined} />;
}

/** The arch alone (favicon, app icon, small places). */
export function ArchMark({ size = 32, className = '', title }: { size?: number; className?: string; title?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="-2 -82 96 96" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <Defs id={id} />
      <KeyGlow id={id} />
      {STONES.map((s, i) => (
        <StonePath key={i} s={s} i={i} id={id} />
      ))}
    </svg>
  );
}

/** The wordmark: the arch, then "Keystone". `height` in px; width follows the aspect ratio. */
export function Wordmark({
  height = 28,
  className = '',
  svgClassName,
  title = 'Keystone',
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
  return (
    <span className={`inline-block ${className}`} data-brand-slot={slot || undefined}>
      <svg width={svgClassName ? undefined : height * WM_ASPECT} height={svgClassName ? undefined : height} viewBox={VIEWBOX} role="img" aria-label={title} className={`block overflow-visible ${svgClassName ?? ''}`} style={svgClassName ? { aspectRatio: String(WM_ASPECT) } : undefined}>
        <Defs id={id} />
        <KeyGlow id={id} />
        {STONES.map((s, i) => (
          <StonePath key={i} s={s} i={i} id={id} />
        ))}
        <g transform={`translate(${TEXT_X} 0)`}>
          {G.letters.map((g, i) => (
            <path key={i} d={g.d} fill={INK} />
          ))}
        </g>
      </svg>
    </span>
  );
}

/**
 * The intro's title card, from mount (seconds): the arch builds stone by stone from both sides (60ms stagger,
 * spring, no bounce) · the brass keystone drops in last and locks it with a small settle (0.42) · it glows
 * (0.64) · "Keystone" rises letter by letter from a mask (0.66 + i×0.035) · the tagline fades in (1.1) · hold
 * 1.2s · done 2.6 (the intro then flies it to the header).
 */
export const TITLE_T = { stones: 0.05, stagger: 0.06, key: 0.42, light: 0.64, letters: 0.66, letterStagger: 0.035, letter: 0.45, tagline: 1.1, done: 2.6 };
const EASE = [0.23, 1, 0.32, 1] as const;

type TitleProps = { width: number; tagline?: string; leaving?: boolean; onMarkLit?: () => void; svgRef?: React.Ref<SVGSVGElement> };
export const WordmarkTitle = forwardRef<HTMLDivElement, TitleProps>(function WordmarkTitle({ width, tagline, leaving = false, onMarkLit, svgRef }, ref) {
  const id = useId().replace(/:/g, '');
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => onMarkLit?.(), TITLE_T.light * 1000);
    return () => clearTimeout(t);
  }, [reduce, onMarkLit]);
  const height = width / WM_ASPECT;
  return (
    <div ref={ref} className="relative inline-block" style={{ width }}>
      {/* a soft paper-coloured glow behind the mark keeps it crisp over the blurred scene */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute"
        style={{ left: '-14%', right: '-14%', top: '-60%', bottom: tagline ? '-110%' : '-60%', background: P.skyBottom, borderRadius: '50%', filter: 'blur(56px)' }}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: leaving ? 0 : 0.7 }}
        transition={{ duration: leaving ? 0.2 : 0.5, ease: EASE }}
      />
      <svg ref={svgRef} width={width} height={height} viewBox={VIEWBOX} role="img" aria-label="Keystone" className="relative block overflow-visible">
        <Defs id={id} />
        <defs>
          <clipPath id={`clip${id}`}>
            <rect x={TEXT_X - 6} y={VB.y} width={G.width + 14} height={-VB.y + 26} />
          </clipPath>
        </defs>
        {/* the keystone's glow when it locks (a warm bloom), and its quiet night glow */}
        <motion.circle
          cx={CX}
          cy={SPRING - (R1 + R2) / 2 - 2}
          r={18}
          fill={BRASS}
          filter={`url(#kg${id})`}
          initial={reduce ? { opacity: 0.35 } : { opacity: 0 }}
          animate={reduce ? { opacity: 0.35 } : { opacity: [0, 0.75, 0.35] }}
          transition={reduce ? undefined : { duration: 0.9, times: [0, 0.35, 1], ease: 'easeOut', delay: TITLE_T.light }}
        />
        {/* the arch: stones rise into place from both sides, the keystone drops in last and settles */}
        {STONES.map((s, i) => {
          const at = s.key ? TITLE_T.key : TITLE_T.stones + s.step * TITLE_T.stagger;
          const from = s.key ? { y: -46, opacity: 0 } : { x: s.side * 9, y: 16, opacity: 0 };
          return (
            <motion.g
              key={i}
              initial={reduce ? false : from}
              animate={{ x: 0, y: 0, opacity: 1 }}
              transition={
                s.key
                  ? { y: { type: 'spring', duration: 0.45, bounce: 0.22, delay: at }, opacity: { duration: 0.1, delay: at } }
                  : { type: 'spring', duration: 0.45, bounce: 0, delay: at, opacity: { duration: 0.15, delay: at } }
              }
            >
              <StonePath s={s} i={i} id={id} />
            </motion.g>
          );
        })}
        {/* "Keystone" rises letter by letter */}
        <g clipPath={`url(#clip${id})`}>
          <g transform={`translate(${TEXT_X} 0)`}>
            {G.letters.map((g, i) => (
              <motion.path
                key={i}
                d={g.d}
                fill={INK}
                initial={reduce ? false : { y: 90, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ y: { duration: TITLE_T.letter, ease: EASE, delay: TITLE_T.letters + i * TITLE_T.letterStagger }, opacity: { duration: 0.2, delay: TITLE_T.letters + i * TITLE_T.letterStagger } }}
              />
            ))}
          </g>
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
