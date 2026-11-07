'use client';
import { AnimatePresence, motion } from 'motion/react';
import { memo } from 'react';
import { spring, exit } from '@/lib/motion';
import { IsoHouse } from '@/components/illustrations/IsoHouse';
import { Person } from './shared';

const W = 150;
const H = 76;
const GROUND = 73;
const GAP = 14;
/** Adults and children in a fixed order, so the same household always looks the same. */
const SCALE = [1.1, 1.04, 0.8, 0.74, 0.98, 0.78, 1.06, 0.72];
/** One element for every render, so a tap never re-renders the house. */
const HOUSE = <IsoHouse size={72} doorBrass={false} strokeWidth={1.5} className="absolute left-[38px] top-[4px]" />;

/** One person at a fixed spot in the row; memoized, so only the one being added or removed ever renders. */
const Figure = memo(function Figure({ i }: { i: number }) {
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: exit }}
      transition={spring.snappy}
      style={{ originX: 0.5, originY: 1 }}
    >
      <Person s={SCALE[i]} transform={`translate(${i * GAP} 0)`} />
    </motion.g>
  );
});

/**
 * The household standing in front of their (future) home. One figure per person, up to 8.
 * + pops a figure in (scale 0.9 → 1 from its feet, snappy spring) while the row glides to stay centered;
 * − fades one out. Only the row's transform and the changed figure animate.
 * Decorative: the stepper next to it carries the value for assistive tech.
 */
export const HouseholdArt = memo(function HouseholdArt({ count, className = '' }: { count: number; className?: string }) {
  const n = Math.max(1, Math.min(8, Math.round(count)));
  const rowX = W / 2 - ((n - 1) * GAP) / 2;
  return (
    <div className={`pointer-events-none relative ${className}`} style={{ width: W, height: H }} aria-hidden>
      {/* the house sits back from the ground line; the family stands in front of it */}
      {HOUSE}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 overflow-visible">
        <path d={`M14 ${GROUND + 0.5}H${W - 14}`} stroke="var(--line)" strokeWidth={1.5} strokeLinecap="round" />
        <g transform={`translate(0 ${GROUND})`}>
          <motion.g initial={false} animate={{ x: rowX }} transition={spring.snappy}>
            <AnimatePresence initial={false}>
              {Array.from({ length: n }, (_, i) => (
                <Figure key={i} i={i} />
              ))}
            </AnimatePresence>
          </motion.g>
        </g>
      </svg>
    </div>
  );
});
