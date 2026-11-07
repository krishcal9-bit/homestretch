'use client';
import { AnimatePresence, motion } from 'motion/react';
import { memo, useEffect, useRef } from 'react';
import { exit, spring, stagger } from '@/lib/motion';
import { line } from './shared';

const W = 40;
const H = 80;
const BASE = 70; // center of the bottom coin's face
const STEP = 4.5;
const RX = 12;
const RY = 3.6;
const T = 3; // coin thickness
/** A real stack is never perfectly straight (and a straight one reads as a database icon). */
const JIT = [0, 1.6, -1.2, 2.2, 0.4, -1.6, 1.2, -0.6, 1.8, -1];

/** Coins for a monthly amount: one per $1,000 (any income shows at least one), at most 10. */
export const coinsFor = (monthly: number) => (monthly > 0 ? Math.min(10, Math.max(1, Math.round(monthly / 1000))) : 0);

/**
 * A stack of coins beside the income field that grows as income does. New coins drop onto the stack with a
 * snappy spring, 40ms apart; removed coins lift off and fade. Sits in a 40×48 slot and draws upward.
 */
export const CoinStack = memo(function CoinStack({ monthly, className = '' }: { monthly: number; className?: string }) {
  const n = coinsFor(monthly);
  const prev = useRef(n);
  const from = prev.current;
  useEffect(() => {
    prev.current = n;
  }, [n]);
  return (
    <div className={`pointer-events-none relative h-[48px] w-[40px] shrink-0 ${className}`} aria-hidden>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute bottom-[-2px] left-0 overflow-visible">
        {/* where the coins go */}
        <ellipse cx={W / 2} cy={BASE + T} rx={RX} ry={RY} fill="none" stroke="var(--line)" strokeWidth={1.5} strokeDasharray="2 3" />
        <AnimatePresence initial={false}>
          {Array.from({ length: n }, (_, i) => {
            const y = BASE - i * STEP;
            const c = W / 2 + JIT[i];
            return (
              <motion.g
                key={i}
                initial={{ opacity: 0, y: -14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6, transition: exit }}
                transition={{ ...spring.snappy, delay: Math.max(0, i - from) * stagger }}
              >
                <path d={`M${c - RX} ${y}V${y + T}A${RX} ${RY} 0 0 0 ${c + RX} ${y + T}V${y}`} {...line} fill="var(--surface)" />
                <ellipse cx={c} cy={y} rx={RX} ry={RY} {...line} fill="var(--pine-soft)" />
                {/* the raised rim on the face */}
                <ellipse cx={c} cy={y} rx={RX - 4} ry={RY - 1.4} fill="none" stroke="var(--pine)" strokeWidth={1} strokeOpacity={0.45} />
              </motion.g>
            );
          })}
        </AnimatePresence>
      </svg>
    </div>
  );
});
