'use client';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { IsoHouse } from '@/components/illustrations/IsoHouse';
import { ease } from '@/lib/motion';

/**
 * Equity at year 10: the number counts up while a small house beside it fills with colour from the ground
 * up (clip-path) to the share of the home the family would own. Under it the same house stands pale, so the
 * part not yet owned still reads as a house. When the count lands, the house settles and its window lights.
 */
export function EquityHouse({ value, share, go, delay = 0, format, size = 52 }: { value: number; share: number; go: boolean; delay?: number; format: (n: number) => string; size?: number }) {
  const reduce = useReducedMotion();
  const n = useMotionValue(0);
  const text = useRef<HTMLSpanElement>(null);
  const [landed, setLanded] = useState(false);
  const fill = useTransform(n, (v) => {
    const f = value > 0 ? Math.min(1, Math.max(0, (v / value) * share)) : 0;
    // inset from the top; the sides and bottom reach past the box so the lawn and shadow show
    return `inset(${((1 - f) * 100).toFixed(2)}% -30% -30% -30%)`;
  });
  const fmt = useRef(format);
  fmt.current = format;
  useEffect(() => n.on('change', (v) => text.current && (text.current.textContent = fmt.current(Math.round(v)))), [n]);
  const started = useRef(false);
  useEffect(() => {
    if (!go) return;
    if (reduce || started.current) {
      n.jump(value);
      setLanded(true);
      return;
    }
    started.current = true;
    const c = animate(n, value, { duration: 1.5, ease: ease.out, delay, onComplete: () => setLanded(true) });
    return () => c.stop();
  }, [go, value, reduce, delay, n]);
  return (
    <span className="flex items-end gap-3">
      <motion.span
        aria-hidden
        className="relative block shrink-0"
        style={{ width: size, originY: 1 }}
        initial={false}
        animate={landed && !reduce ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={{ duration: 0.36, ease: ease.out }}
      >
        <span className="block opacity-30 grayscale">
          <IsoHouse size={size} detail={false} />
        </span>
        <motion.span className="absolute inset-0 block" style={{ clipPath: fill }}>
          <IsoHouse size={size} detail={false} lit={landed} />
        </motion.span>
      </motion.span>
      <span ref={text} className="tnum text-[28px] font-semibold leading-[34px] tracking-[-0.01em] text-pine">
        {format(go && reduce ? value : 0)}
      </span>
    </span>
  );
}
