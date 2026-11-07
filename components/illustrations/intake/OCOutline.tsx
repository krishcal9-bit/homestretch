'use client';
import { motion, useReducedMotion } from 'motion/react';
import { ease, exit } from '@/lib/motion';

/**
 * Orange County, simplified to 20 points (projected from real coordinates): the LA County line on the
 * northwest, the Chino Hills and Santa Ana Mountains on the northeast, San Diego County at the south tip,
 * and the coastline from San Clemente past Dana Point, Laguna and Newport to Seal Beach on the southwest.
 */
const OC =
  'M2 22.6L3.6 17L8 10.7L11.7 3.9L21.7 2.8L27.8 2L37.5 8.8L42.7 17L47.9 25.7L54 36.4L58 45.1L50.3 51.9L43 57L39.5 52.8L33.4 49.9L27.8 42.7L20.1 36.9L17.3 36.4L10.1 31.1L4.4 24.8Z';

/** A faint outline of the county; "Yes" draws it in pine (pathLength), "No" erases it. */
export function OCOutline({ value, className = '' }: { value: boolean | null; className?: string }) {
  const reduce = useReducedMotion();
  const on = value === true;
  const draw = reduce ? { duration: 0 } : on ? { duration: 0.4, ease: ease.inOut } : { duration: 0.24, ease: ease.out };
  return (
    <svg width={54} height={54} viewBox="0 0 60 59" className={`pointer-events-none shrink-0 overflow-visible ${className}`} aria-hidden>
      {/* the Pacific off the southwest coast, so the shape reads as a coastal county */}
      <path d="M6 41q2.2-2 4.4 0t4.4 0M18 51q2.2-2 4.4 0t4.4 0" fill="none" stroke="var(--line)" strokeWidth={1.5} strokeLinecap="round" />
      <path d={OC} fill="none" stroke="var(--line)" strokeWidth={1.5} strokeLinejoin="round" />
      <motion.path
        d={OC}
        fill="var(--pine-soft)"
        stroke="none"
        initial={false}
        animate={{ opacity: on ? 1 : 0 }}
        transition={reduce ? { duration: 0 } : on ? { duration: 0.2, ease: ease.out, delay: 0.2 } : exit}
      />
      <motion.path
        d={OC}
        fill="none"
        stroke="var(--pine)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="butt"
        initial={false}
        animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
        transition={{ pathLength: draw, opacity: reduce ? { duration: 0 } : on ? { duration: 0.05 } : { duration: 0.1, delay: 0.14 } }}
      />
    </svg>
  );
}
