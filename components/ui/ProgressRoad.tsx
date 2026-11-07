'use client';
import { motion } from 'motion/react';
import { memo } from 'react';
import { spring, ease } from '@/lib/motion';

/**
 * The intake's progress bar is a small Road: a pine line growing toward a house at the right end.
 * The line grows with spring.smooth (scaleX, transform only) on each Continue; on the last step the door
 * turns brass. It is the shared element that grows into the result Road (`vtName`: "cta" lands from the
 * landing CTA, "road" morphs into the result Road). Memoized: it only re-renders when the step changes.
 */
export const ProgressRoad = memo(function ProgressRoad({ value, label, last = false, vtName }: { value: number; label: string; last?: boolean; vtName?: string }) {
  return (
    <div
      className="flex h-[24px] items-end gap-2 px-5"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      style={vtName ? { viewTransitionName: vtName } : undefined}
      data-testid="progress-road"
    >
      <div className="relative mb-[5px] h-[3px] flex-1 overflow-hidden rounded-full bg-line">
        <motion.div className="absolute inset-0 origin-left rounded-full bg-pine" initial={false} animate={{ scaleX: value }} transition={spring.smooth} />
      </div>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="mb-[1px] shrink-0">
        <path d="M1.5 16.5V7.5L9 1.5l7.5 6v9z" fill="none" stroke="var(--pine)" strokeWidth="1.5" strokeLinejoin="round" />
        <motion.rect x="6.75" y="10.5" width="4.5" height="6" initial={false} animate={{ fill: last ? 'var(--brass)' : 'rgba(0,0,0,0)', stroke: last ? 'var(--brass)' : 'var(--pine)' }} transition={{ duration: 0.3, ease: ease.out }} strokeWidth="1.2" />
      </svg>
    </div>
  );
});
