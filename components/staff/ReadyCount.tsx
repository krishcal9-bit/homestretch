'use client';
import { useInView } from 'motion/react';
import { useRef } from 'react';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

const whole = (n: number) => String(Math.round(n));

/** Homes list: the ready counts roll up from 0 the first time the row scrolls into view. */
export function ReadyCount({ projected, readyNow }: { projected: number; readyNow: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, margin: '0px 0px -40px 0px' });
  return (
    <span ref={ref}>
      <AnimatedNumber value={seen ? projected : 0} format={whole} className="font-medium" />{' '}
      <span className="text-ink-2">{projected === 1 ? 'family' : 'families'} projected ready,</span>{' '}
      <AnimatedNumber value={seen ? readyNow : 0} format={whole} className="font-medium" /> <span className="text-ink-2">ready now</span>
    </span>
  );
}
