'use client';
import { motion, useReducedMotion } from 'motion/react';
import type { Ref } from 'react';
import { ease, spring } from '@/lib/motion';

export type StubPhase = 'idle' | 'scanning' | 'read';

/** One sweep of the scan line, top to bottom (the one intake animation allowed past 400ms). */
export const SCAN_MS = 800;

const W = 86;
const H = 88;
/** Where the gross-pay amount sits on the stub (also the start of the value's flight to the field). */
export const STUB_AMOUNT = { x: 22, y: 61, w: 56, h: 18 };

/**
 * A pay stub sketch: employer header, a perforation, earnings rows and the gross-pay box.
 * idle: a faint outline (a pay stub goes here). scanning: the stub inks in and a pine scan line sweeps
 * top to bottom. read: the gross-pay box washes pine-soft and shows the amount that was read.
 */
export function PayStubDoc({ phase, amount, amountRef }: { phase: StubPhase; amount?: string; amountRef?: Ref<HTMLSpanElement> }) {
  const reduce = useReducedMotion();
  const live = phase !== 'idle';
  const ink = (c: string) => ({ stroke: live ? c : 'var(--line)', transition: 'stroke 200ms ease' });
  const row = (y: number, a: number, b: number, c = 'var(--line)') => <path d={`M${a} ${y}H${b}`} strokeWidth={2} strokeLinecap="round" style={ink(c)} />;
  const box = STUB_AMOUNT;
  return (
    <motion.div
      className="pointer-events-none relative shrink-0"
      style={{ width: W, height: H }}
      initial={false}
      animate={{ scale: live ? 1 : 0.96 }}
      transition={spring.snappy}
      aria-hidden
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 overflow-visible">
        <rect x={1} y={1} width={W - 2} height={H - 2} rx={4} fill="var(--surface)" strokeWidth={1.5} style={ink('var(--pine)')} />
        {row(11, 9, 40, 'var(--ink-2)')}
        {row(17, 9, 28)}
        <path d={`M1 25H${W - 1}`} strokeWidth={1.5} strokeDasharray="2 3" style={{ stroke: 'var(--line)' }} />
        {row(33, 9, 32)}
        {row(33, 56, 77)}
        {row(41, 9, 28)}
        {row(41, 60, 77)}
        {row(49, 9, 34)}
        {row(49, 56, 77)}
        {row(70, 9, 15, 'var(--ink-2)')}
        <rect
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          rx={3}
          strokeWidth={1.5}
          style={{ ...ink('var(--pine)'), fill: phase === 'read' ? 'var(--pine-soft)' : 'var(--surface)', transition: 'stroke 200ms ease, fill 200ms ease' }}
        />
        {phase === 'scanning' && !reduce && (
          <motion.path
            d={`M-3 0H${W + 3}`}
            stroke="var(--pine)"
            strokeWidth={2}
            strokeLinecap="round"
            initial={{ y: 3, opacity: 0 }}
            animate={{ y: H - 3, opacity: 1 }}
            transition={{ y: { duration: SCAN_MS / 1000, ease: ease.inOut, repeat: Infinity }, opacity: { duration: 0.08 } }}
          />
        )}
      </svg>
      <span
        ref={amountRef}
        className="tnum absolute flex items-center justify-center text-[13px] leading-[15px] text-ink"
        style={{ left: box.x, top: box.y, width: box.w, height: box.h, opacity: phase === 'read' && amount ? 1 : 0, transition: 'opacity 160ms ease' }}
      >
        {amount}
      </span>
    </motion.div>
  );
}
