'use client';
import { useReducedMotion, useSpring } from 'motion/react';
import { memo, useEffect, useMemo } from 'react';
import { P } from '@/lib/illustrationPalette';
import type { CreditBand } from '@/lib/types';
import { Dial, useSvgId, type DialBand } from './shared';

/** Needle angle from straight up. "Not sure" rests just left of centre; no answer yet lies flat on its stop. */
const ANGLE: Record<CreditBand, number> = { needs_work: -60, building: 0, good: 60, unknown: -14 };
const TICKS = [-90, -60, -30, 0, 30, 60, 90];
const MAJOR = [-30, 30];

/**
 * Step 4: a credit gauge beside the credit question: three bands (needs work in amber, building in sage,
 * good in pine); the chosen band lights and the needle swings to it with a damped spring, overshooting a
 * little and settling. Decorative: the segmented control carries the answer.
 */
export const CreditGauge = memo(function CreditGauge({ value }: { value: CreditBand | null }) {
  const id = useSvgId();
  const reduce = useReducedMotion();
  const target = value ? ANGLE[value] : -90;
  const angle = useSpring(target, { visualDuration: 0.55, bounce: 0.25 });
  useEffect(() => {
    if (reduce) angle.jump(target);
    else angle.set(target);
  }, [target, reduce, angle]);
  const bands = useMemo<DialBand[]>(
    () => [
      { from: -88, to: -31.5, color: P.amber, on: value === 'needs_work', off: P.amberSoft },
      { from: -28.5, to: 28.5, color: P.sage, on: value === 'building' },
      { from: 31.5, to: 88, color: P.pineLight, on: value === 'good', off: P.pineSoft },
    ],
    [value],
  );
  return (
    <div className="pointer-events-none shrink-0" aria-hidden data-testid="credit-gauge">
      <Dial id={id} width={84} angle={angle} bands={bands} ticks={TICKS} major={MAJOR} tone={value === null ? 'idle' : value === 'unknown' ? 'ink' : value === 'needs_work' ? 'amber' : 'pine'} />
    </div>
  );
});
