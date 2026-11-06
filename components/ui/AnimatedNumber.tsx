'use client';
import { useEffect, useRef } from 'react';
import { useSpring, useReducedMotion } from 'motion/react';
import { spring } from '@/lib/motion';

/** Rolling number: springs between values (spring.gentle), tabular numerals, never jumps. */
export function AnimatedNumber({ value, format, className = '' }: { value: number; format: (n: number) => string; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useSpring(value, spring.gentle);
  const ref = useRef<HTMLSpanElement>(null);
  const fmtRef = useRef(format);
  fmtRef.current = format;
  useEffect(() => {
    if (reduce) mv.jump(value);
    else mv.set(value);
  }, [value, mv, reduce]);
  useEffect(() => {
    const el = ref.current;
    if (el) el.textContent = fmtRef.current(mv.get());
    return mv.on('change', (v) => {
      if (ref.current) ref.current.textContent = fmtRef.current(v);
    });
  }, [mv]);
  return (
    <span ref={ref} className={`tnum ${className}`}>
      {format(value)}
    </span>
  );
}
