'use client';
import { forwardRef, useId } from 'react';
import { WORDMARK as G } from './wordmarkGlyphs';
import { fraunces, WORDMARK_FVS } from './fraunces';

/**
 * Keystone: the brand lockup. A stone arch — pine stones shaded like the houses (light from the top-left), with a
 * brass keystone at the top centre that has a small keyhole cut into it — then "Keystone" in Fraunces (opsz 144,
 * wght 600, SOFT 30, WONK 0, −0.02em; the display serif is for the wordmark only) in ink, with one flourish: a tiny
 * brass keystone wedge set into the top of the K's stem. Optional tagline beneath in Public Sans at 22% of the
 * wordmark's size. Static places draw the letters as outlines; the intro's title card sets them as live text.
 * The keystone glows softly at night. Units: em = 100, baseline y = 0.
 */
const INK = 'var(--ink)';
const PINE = 'var(--pine)';
const BRASS = 'var(--brass)';

import { CX, R1, R2, SPRING, STONES, KEYHOLE, type Stone } from './arch';

const ARCH_W = CX + R2; // the arch's right edge (it starts at x = 2)
const TEXT_X = ARCH_W + 20;
const VB = { x: -4, y: -84, w: TEXT_X + G.width + 6, h: 84 + 24 };
/** the tagline's size as a share of the wordmark's (em) */
export const TAGLINE_SCALE = 0.22;
/** layout facts for callers that place things relative to the lockup (the intro) */
export const LOCKUP = { vb: VB, textX: TEXT_X, archW: ARCH_W, glyphs: G };
const VIEWBOX = `${VB.x} ${VB.y} ${VB.w} ${VB.h}`;
export const WM_ASPECT = VB.w / VB.h;

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

/** The arch's own box (arch units): the intro's 2D arch is drawn in exactly this box so it lands on the lockup's. */
export const ARCH_BOX = { x: CX - R2, y: SPRING - R2 - 5, w: 2 * R2, h: R2 + 5 - SPRING };
/** The arch alone, stretched to fill its box exactly (the intro's shrinking arch). */
export function ArchBox({ className = '' }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox={`${ARCH_BOX.x} ${ARCH_BOX.y} ${ARCH_BOX.w} ${ARCH_BOX.h}`} preserveAspectRatio="none" className={`block h-full w-full overflow-visible ${className}`} aria-hidden>
      <Defs id={id} />
      <KeyGlow id={id} />
      {STONES.map((s, i) => (
        <StonePath key={i} s={s} i={i} id={id} />
      ))}
    </svg>
  );
}

/** The K's brass notch (a keystone wedge set into the top of its stem). */
function Notch({ glint = false, id }: { glint?: boolean; id: string }) {
  return (
    <g transform={`translate(${TEXT_X} 0)`}>
      <path d={G.notch} fill={BRASS} />
      {glint && (
        <>
          <defs>
            <clipPath id={`nc${id}`}>
              <path d={G.notch} />
            </clipPath>
            <linearGradient id={`ng${id}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.85" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g clipPath={`url(#nc${id})`}>
            <rect className="ks-glint" x={G.notchBox.x - 10} y={G.notchBox.y - 2} width={7} height={G.notchBox.h + 4} fill={`url(#ng${id})`} />
          </g>
        </>
      )}
    </g>
  );
}

/** The lockup (arch + wordmark, outlines). `height` in px is the mark's; the tagline (optional) sits beneath. */
export function Wordmark({
  height = 28,
  className = '',
  svgClassName,
  title = 'Keystone',
  slot = false,
  tagline,
}: {
  height?: number;
  className?: string;
  /** size the svg with CSS instead (e.g. responsive heights); width follows the viewBox */
  svgClassName?: string;
  title?: string;
  /** the header slot the title card lands on */
  slot?: boolean;
  /** the tagline beneath, in Public Sans at 22% of the wordmark's size (only where it stays legible) */
  tagline?: string;
}) {
  const id = useId().replace(/:/g, '');
  const em = (height / VB.h) * 100; // the wordmark's font size, px
  return (
    <span className={`inline-flex flex-col ${className}`} data-brand-slot={slot || undefined}>
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
        <Notch id={id} />
      </svg>
      {tagline && (
        <span className="block whitespace-nowrap font-normal text-ink-2" style={{ fontSize: Math.max(11, em * TAGLINE_SCALE), marginLeft: ((TEXT_X - VB.x) / VB.w) * height * WM_ASPECT, marginTop: em * 0.04, lineHeight: 1.2 }}>
          {tagline}
        </span>
      )}
    </span>
  );
}

/**
 * The intro's title lockup, live: the same box as the static lockup, with "Keystone" set as SVG text in the variable
 * Fraunces so each letter can solidify (weight 300 → 600, opacity 0 → 1, rising from a mask, 40ms apart); the K's
 * notch catches a glint; the tagline fades in beneath. The arch is drawn here too (the intro shrinks the 3D arch into
 * it). Timing is CSS (start = `revealAt` seconds after mount), so it costs nothing per frame in React.
 */
export const LOCKUP_T = { letter: 0.5, stagger: 0.04, glint: 0.62, tagline: 0.5 };
type TitleProps = { width: number; tagline?: string; revealAt?: number; leaving?: boolean; svgRef?: React.Ref<SVGSVGElement>; archRef?: React.Ref<SVGGElement>; still?: boolean; /** the arch starts hidden (the intro's 2D arch lands on it, then shows it) */ archHidden?: boolean };
export const LockupTitle = forwardRef<HTMLDivElement, TitleProps>(function LockupTitle({ width, tagline, revealAt = 0, leaving = false, svgRef, archRef, still = false, archHidden = false }, ref) {
  const id = useId().replace(/:/g, '');
  const k = width / VB.w;
  const height = width / WM_ASPECT;
  const d = (s: number) => `${(revealAt + s).toFixed(3)}s`;
  return (
    <div ref={ref} className={`ks-title relative inline-block ${still ? 'ks-still' : ''}`} style={{ width }}>
      <svg ref={svgRef} width={width} height={height} viewBox={VIEWBOX} role="img" aria-label="Keystone" className="relative block overflow-visible">
        <Defs id={id} />
        <defs>
          <clipPath id={`tc${id}`}>
            <rect x={TEXT_X - 8} y={VB.y} width={G.width + 16} height={-VB.y + 26} />
          </clipPath>
        </defs>
        <g ref={archRef} style={archHidden ? { opacity: 0 } : undefined}>
          <KeyGlow id={id} />
          {STONES.map((s, i) => (
            <StonePath key={i} s={s} i={i} id={id} />
          ))}
        </g>
        <g clipPath={`url(#tc${id})`} className={fraunces.className} style={{ fontVariationSettings: WORDMARK_FVS }}>
          {G.letters.map((g, i) => (
            <text key={i} x={TEXT_X + g.x} y={0} fontSize={100} fill={INK} className="ks-letter" style={{ animationDelay: d(i * LOCKUP_T.stagger) }}>
              {g.ch}
            </text>
          ))}
        </g>
        <g className="ks-notch" style={{ animationDelay: d(LOCKUP_T.stagger) }}>
          <Notch id={id} glint />
        </g>
      </svg>
      {tagline && (
        <p className={`ks-tagline relative whitespace-nowrap font-normal text-ink-2 ${leaving ? 'ks-leaving' : ''}`} style={{ fontSize: 100 * k * TAGLINE_SCALE, marginLeft: (TEXT_X - VB.x) * k, marginTop: 100 * k * 0.06, lineHeight: 1.25, animationDelay: d(LOCKUP_T.tagline) }}>
          {tagline}
        </p>
      )}
      <style>{`.ks-title .ks-glint{animation-delay:${d(LOCKUP_T.glint)}}`}</style>
    </div>
  );
});
