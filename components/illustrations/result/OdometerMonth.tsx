'use client';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { SwapText } from './SwapText';
import { ease } from '@/lib/motion';

const LH = 1.07; // em, matches the hero date's line height

/**
 * The ready date rolls up like an odometer through the three months before it and lands on the value;
 * after that, changes swap vertically (SwapText: AnimatedMonth's look, without measuring on every swap).
 * The final value is always the last row and the only row inside `testId`, so its text is exactly the date
 * even mid-roll; the earlier months are aria-hidden.
 */
export function OdometerMonth({
  text,
  earlier,
  play,
  at,
  duration = 0.5,
  testId,
  onSettled,
}: {
  text: string;
  /** the months shown before landing, oldest first (empty: no roll, e.g. "More than 10 years") */
  earlier: string[];
  play: boolean;
  at: number;
  duration?: number;
  testId?: string;
  onSettled?: () => void;
}) {
  const roll = play && earlier.length > 0;
  const [settled, setSettled] = useState(!roll);
  const done = useRef(onSettled);
  done.current = onSettled;
  useEffect(() => {
    if (!roll) done.current?.();
  }, [roll]);
  // the strip is frozen at mount so a slider change mid-roll still lands on the live value
  const [strip] = useState(earlier);
  const row = { height: `${LH}em`, lineHeight: `${LH}em` };

  if (!settled) {
    return (
      <span className="relative block overflow-hidden" style={{ height: `${LH}em` }}>
        <motion.span
          className="block will-change-transform"
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: `-${strip.length * LH}em`, opacity: 1 }}
          transition={{ y: { duration, ease: ease.out, delay: at }, opacity: { duration: 0.12, delay: at } }}
          onAnimationComplete={() => {
            setSettled(true);
            done.current?.();
          }}
        >
          {strip.map((s, i) => (
            <span key={i} aria-hidden className="block whitespace-nowrap" style={row}>
              {s}
            </span>
          ))}
          <span className="block" style={row}>
            <SwapText text={text} testId={testId} />
          </span>
        </motion.span>
      </span>
    );
  }
  return (
    <span className="block" style={row}>
      <SwapText text={text} testId={testId} />
    </span>
  );
}
