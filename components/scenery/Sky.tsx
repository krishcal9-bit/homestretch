'use client';
import { motion, type MotionValue } from 'motion/react';
import { memo, useId } from 'react';
import { P, alpha, mix } from '@/lib/illustrationPalette';

/**
 * The sky: a soft layered gradient (pale blue up top → warm paper at the horizon; gradients are allowed
 * inside illustrations to model light). A golden-hour sky crossfades in by `golden` (0–1, opacity only).
 * Two or three shaded clouds drift across in 60–95s; now and then a few birds cross. CSS animations,
 * transform only, off under reduced motion.
 * At night (dark theme) the same layers take the palette's night values — a navy-to-ink sky, a warm city
 * glow low on the horizon instead of golden hour, moonlit clouds — and a still field of stars and the moon
 * come out (they fade with the theme switch; nothing twinkles). Birds roost.
 */
function Cloud({ w, className, style }: { w: number; className: string; style?: React.CSSProperties }) {
  return (
    <svg width={w} height={w * 0.42} viewBox="0 0 200 84" className={`absolute ${className}`} style={style} aria-hidden>
      {/* underside in shade, tops lit from the top-left (by the moon at night) */}
      <path d="M18 70C4 70 0 56 12 50C8 36 26 28 38 34C42 18 64 12 76 24C84 8 112 6 122 24C134 14 158 18 160 36C178 34 194 46 188 60C194 70 184 76 172 74Z" fill={P.cloudShade} opacity={0.55} />
      <path d="M22 64C10 64 8 52 18 47C15 35 30 29 40 34C45 21 63 16 74 26C82 13 108 12 117 27C128 18 150 22 152 38C168 37 182 47 176 58C180 64 172 68 162 66Z" fill={P.cloud} opacity={0.92} />
      <path d="M40 40C46 26 62 22 72 31C80 20 100 18 110 30" fill="none" stroke={P.cloudLight} strokeWidth={6} strokeLinecap="round" opacity={0.6} />
    </svg>
  );
}

function Birds() {
  return (
    <div className="il-day absolute inset-0">
      <svg width="90" height="30" viewBox="0 0 90 30" className="scenery-birds absolute left-0 top-[14%]" aria-hidden>
        {[
          [8, 16, 1],
          [30, 8, 0.8],
          [52, 18, 0.9],
        ].map(([x, y, s], i) => (
          <path key={i} d={`M${x} ${y}q${5 * s} ${-5 * s} ${10 * s} 0q${5 * s} ${-5 * s} ${10 * s} 0`} fill="none" stroke={P.slate} strokeWidth={1.6} strokeLinecap="round" opacity={0.55} />
        ))}
      </svg>
    </div>
  );
}

/** Deterministic star field (same on server and client): denser and brighter toward the top. */
const STARS = (() => {
  let s = 17;
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: 64 }, () => {
    const y = Math.pow(r(), 1.6) * 330;
    return { x: Math.round(r() * 1600), y: Math.round(y), r: Math.round((0.55 + r() * r() * 1.1) * 100) / 100, o: Math.round((0.85 - (y / 330) * 0.45 - r() * 0.2) * 100) / 100 };
  });
})();

const Stars = memo(function Stars() {
  return (
    // high in the sky only: they fade out well above the text and the street
    <svg viewBox="0 0 1600 600" preserveAspectRatio="xMidYMin slice" className="absolute inset-0 h-full w-full" style={{ maskImage: 'linear-gradient(to bottom, #000 0%, #000 10%, transparent 30%)', WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 10%, transparent 30%)' }}>
      {STARS.map((st, i) => (
        <circle key={i} cx={st.x} cy={st.y} r={st.r} fill={P.star} opacity={Math.max(0.2, st.o)} />
      ))}
    </svg>
  );
});

/** The moon: a soft disc lit from the left with two faint maria, inside a wide halo. */
export function Moon({ size = 34, className = '', style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  const halo = size * 3.4;
  const id = useId();
  return (
    <svg width={halo} height={halo} viewBox="-50 -50 100 100" className={`absolute -translate-x-1/2 -translate-y-1/2 ${className}`} style={style} aria-hidden>
      <defs>
        <radialGradient id={`${id}h`}>
          <stop offset="0.28" stopColor={alpha(P.moon, 0.22)} />
          <stop offset="0.55" stopColor={alpha(P.moon, 0.07)} />
          <stop offset="1" stopColor={alpha(P.moon, 0)} />
        </radialGradient>
        <radialGradient id={`${id}d`} cx="0.38" cy="0.36" r="0.75">
          <stop offset="0" stopColor={P.moon} />
          <stop offset="1" stopColor={mix(P.moon, P.skyTop, 0.22)} />
        </radialGradient>
      </defs>
      <circle r={50} fill={`url(#${id}h)`} />
      <circle r={50 / 3.4} fill={`url(#${id}d)`} />
      <circle cx={-3.5} cy={-2.5} r={3.6} fill={P.skyTop} opacity={0.08} />
      <circle cx={4.2} cy={3.6} r={2.6} fill={P.skyTop} opacity={0.07} />
      <circle cx={-1} cy={6.4} r={1.6} fill={P.skyTop} opacity={0.06} />
    </svg>
  );
}

export function Sky({
  golden,
  clouds = true,
  birds = true,
  moon = { left: '82%', top: '13%' },
}: {
  golden?: MotionValue<number> | number;
  clouds?: boolean;
  birds?: boolean;
  /** where the moon sits at night (a point in the sky box), or false for none */
  moon?: { left: string; top: string } | false;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${P.skyTop} 0%, ${mix(P.skyTop, P.skyBottom, 0.55)} 38%, ${P.skyBottom} 72%)` }} />
      <motion.div className="absolute inset-0" style={{ opacity: golden ?? 0, background: `linear-gradient(180deg, ${mix(P.skyTop, P.goldTop, 0.55)} 0%, ${P.goldTop} 42%, ${P.goldBottom} 76%)` }} />
      <div className="il-night absolute inset-0">
        <Stars />
        {moon && <Moon style={moon} />}
      </div>
      {clouds && (
        <>
          <Cloud w={240} className="scenery-cloud top-[9%]" style={{ animationDuration: '92s', animationDelay: '-30s' }} />
          <Cloud w={170} className="scenery-cloud top-[22%] opacity-80" style={{ animationDuration: '74s', animationDelay: '-58s' }} />
          <Cloud w={130} className="scenery-cloud top-[4%] hidden opacity-70 sm:block" style={{ animationDuration: '66s', animationDelay: '-12s' }} />
        </>
      )}
      {birds && <Birds />}
    </div>
  );
}
