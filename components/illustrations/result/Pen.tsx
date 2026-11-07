import { P } from '@/lib/illustrationPalette';

/**
 * A fountain pen, drawn with form: a pine barrel shaded as a cylinder (lit along its top, light from the
 * top-left), a brass band and clip, a dark grip section and a brass nib with its slit. Held at about 35°.
 * Drawn so the nib's tip sits at (0, 0): place it with a transform on a wrapper and the tip lands there.
 */
export function Pen({ size = 40, className = '' }: { size?: number; className?: string }) {
  const s = size / 40;
  return (
    <svg width={size} height={size} viewBox="-6 -34 40 40" className={`pointer-events-none absolute overflow-visible ${className}`} style={{ left: -6 * s, top: -34 * s }} aria-hidden>
      <defs>
        <linearGradient id="hs-pen-barrel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.pineLighter} />
          <stop offset="0.35" stopColor={P.pineLight} />
          <stop offset="0.75" stopColor={P.pine} />
          <stop offset="1" stopColor={P.pineDark} />
        </linearGradient>
        <linearGradient id="hs-pen-nib" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.honeyLight} />
          <stop offset="1" stopColor={P.brass} />
        </linearGradient>
        <linearGradient id="hs-pen-grip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.slateLight} />
          <stop offset="1" stopColor={P.slateDark} />
        </linearGradient>
      </defs>
      <g transform="rotate(-35)">
        {/* soft shadow on the paper, down and to the right */}
        <path d="M1 3.5L10 0.8H35a4.3 4.3 0 0 1 0 8.6H10Z" fill={P.shadowSoft} transform="rotate(35) translate(2.5 3) rotate(-35)" />
        {/* nib */}
        <path d="M0 0L9.5 -3.1V3.1Z" fill="url(#hs-pen-nib)" />
        <path d="M1.2 0H7.4" stroke={P.brassDark} strokeWidth={0.55} strokeLinecap="round" />
        <circle cx={7.6} cy={0} r={0.75} fill={P.brassDark} />
        {/* grip section */}
        <rect x={9.2} y={-3.7} width={5.4} height={7.4} rx={1.2} fill="url(#hs-pen-grip)" />
        {/* barrel with a rounded end */}
        <path d="M14.2 -4.3H34.6a4.3 4.3 0 0 1 0 8.6H14.2Z" fill="url(#hs-pen-barrel)" />
        <path d="M15.5 -2.9H34" stroke={P.trim} strokeWidth={0.9} strokeLinecap="round" opacity={0.45} />
        {/* brass band and clip */}
        <rect x={14.2} y={-4.3} width={1.7} height={8.6} fill={P.brass} />
        <rect x={14.5} y={-4.3} width={0.6} height={8.6} fill={P.honeyLight} opacity={0.7} />
        <path d="M22 -4.3V-5.6H33.4a1.3 1.3 0 0 1 0 2.6H33" fill="none" stroke={P.brass} strokeWidth={1.3} strokeLinejoin="round" />
        <path d="M23 -5.9H32.6" stroke={P.honeyLight} strokeWidth={0.5} strokeLinecap="round" />
      </g>
    </svg>
  );
}
