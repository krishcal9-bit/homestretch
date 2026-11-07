'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

const whole = (n: number) => String(Math.round(n));

/**
 * Homes list: the ready counts roll up from 0 (snappy, ~250ms) the first time their row scrolls into view.
 * The whole row is watched, not the number: on a narrow window the console scrolls sideways and the count
 * column can sit off to the right while its row is plainly on screen.
 */
export function ReadyCount({ projected, readyNow }: { projected: number; readyNow: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setSeen(true);
        io.disconnect();
      },
      { rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(el.closest('tr') ?? el);
    return () => io.disconnect();
  }, [seen]);
  return (
    <span ref={ref}>
      <AnimatedNumber speed="snappy" value={seen ? projected : 0} format={whole} className="font-medium" />{' '}
      <span className="text-ink-2">{projected === 1 ? 'family' : 'families'} projected ready,</span>{' '}
      <AnimatedNumber speed="snappy" value={seen ? readyNow : 0} format={whole} className="font-medium" /> <span className="text-ink-2">ready now</span>
    </span>
  );
}
