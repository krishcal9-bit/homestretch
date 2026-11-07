'use client';
import { motion, useReducedMotion } from 'motion/react';
import type { CreditBand } from '@/lib/types';
import { spring } from '@/lib/motion';

const CX = 32;
const CY = 32;
const R = 26;
const p = (deg: number) => {
  const a = (deg * Math.PI) / 180;
  return `${(CX + R * Math.cos(a)).toFixed(2)} ${(CY - R * Math.sin(a)).toFixed(2)}`;
};
const arc = (from: number, to: number) => `M${p(from)}A${R} ${R} 0 0 1 ${p(to)}`;

/** Left to right: needs work, building, good (60° each, small gaps). */
const BANDS: { band: CreditBand; d: string }[] = [
  { band: 'needs_work', d: arc(178, 122) },
  { band: 'building', d: arc(118, 62) },
  { band: 'good', d: arc(58, 2) },
];
/** Needle angle from straight up. "Not sure" wavers just left of center; no answer yet rests flat. */
const ANGLE: Record<CreditBand, number> = { needs_work: -60, building: 0, good: 60, unknown: -14 };

/** A small semicircle gauge beside the credit question; the needle swings (spring) to the chosen band. */
export function CreditGauge({ value }: { value: CreditBand | null }) {
  const reduce = useReducedMotion();
  const rot = value ? ANGLE[value] : -90;
  const needle = value === null ? 'var(--line)' : value === 'unknown' ? 'var(--ink-2)' : 'var(--pine)';
  return (
    <svg width={64} height={36} viewBox="0 0 64 36" className="pointer-events-none shrink-0 overflow-visible" aria-hidden data-testid="credit-gauge">
      {BANDS.map(({ band, d }) => (
        <path key={band} d={d} fill="none" strokeWidth={4} style={{ stroke: value === band ? 'var(--pine)' : 'var(--line)', transition: 'stroke 200ms ease' }} />
      ))}
      <motion.path
        d={`M${CX} ${CY}V${CY - 19}`}
        strokeWidth={2}
        strokeLinecap="round"
        style={{ stroke: needle, transition: 'stroke 200ms ease', originX: 0.5, originY: 1 }}
        initial={false}
        animate={{ rotate: rot }}
        transition={reduce ? { duration: 0 } : spring.smooth}
      />
      <circle cx={CX} cy={CY} r={2.5} fill="var(--surface)" stroke="var(--pine)" strokeWidth={1.5} />
    </svg>
  );
}
