'use client';
import { motion, type MotionValue } from 'motion/react';
import { P, mix } from '@/lib/illustrationPalette';

/**
 * The sky: a soft layered gradient (pale blue up top → warm paper at the horizon; gradients are allowed
 * inside illustrations to model light). A golden-hour sky crossfades in by `golden` (0–1, opacity only).
 * Two or three shaded clouds drift across in 60–95s; now and then a few birds cross. CSS animations,
 * transform only, off under reduced motion.
 */
function Cloud({ w, className, style }: { w: number; className: string; style?: React.CSSProperties }) {
  return (
    <svg width={w} height={w * 0.42} viewBox="0 0 200 84" className={`absolute ${className}`} style={style} aria-hidden>
      {/* underside in shade, tops lit from the top-left */}
      <path d="M18 70C4 70 0 56 12 50C8 36 26 28 38 34C42 18 64 12 76 24C84 8 112 6 122 24C134 14 158 18 160 36C178 34 194 46 188 60C194 70 184 76 172 74Z" fill={mix(P.skyTop, P.slateLight, 0.12)} opacity={0.55} />
      <path d="M22 64C10 64 8 52 18 47C15 35 30 29 40 34C45 21 63 16 74 26C82 13 108 12 117 27C128 18 150 22 152 38C168 37 182 47 176 58C180 64 172 68 162 66Z" fill="#fff" opacity={0.92} />
      <path d="M40 40C46 26 62 22 72 31C80 20 100 18 110 30" fill="none" stroke="#fff" strokeWidth={6} strokeLinecap="round" opacity={0.6} />
    </svg>
  );
}

function Birds() {
  return (
    <svg width="90" height="30" viewBox="0 0 90 30" className="scenery-birds absolute left-0 top-[14%]" aria-hidden>
      {[
        [8, 16, 1],
        [30, 8, 0.8],
        [52, 18, 0.9],
      ].map(([x, y, s], i) => (
        <path key={i} d={`M${x} ${y}q${5 * s} ${-5 * s} ${10 * s} 0q${5 * s} ${-5 * s} ${10 * s} 0`} fill="none" stroke={P.slate} strokeWidth={1.6} strokeLinecap="round" opacity={0.55} />
      ))}
    </svg>
  );
}

export function Sky({ golden, clouds = true, birds = true }: { golden?: MotionValue<number> | number; clouds?: boolean; birds?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${P.skyTop} 0%, ${mix(P.skyTop, P.skyBottom, 0.55)} 38%, ${P.skyBottom} 72%)` }} />
      <motion.div className="absolute inset-0" style={{ opacity: golden ?? 0, background: `linear-gradient(180deg, ${mix(P.skyTop, P.goldTop, 0.55)} 0%, ${P.goldTop} 42%, ${P.goldBottom} 76%)` }} />
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
