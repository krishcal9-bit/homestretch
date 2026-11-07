'use client';
import { AnimatePresence, motion } from 'motion/react';
import { dur, ease } from '@/lib/motion';

/**
 * A word or date that changes swaps vertically: the old one moves up 8px and fades, the new one comes up
 * from 8px below, blurred 2px mid-swap so the two read as one word changing (same look as AnimatedMonth).
 * Both sit in one grid cell, so nothing is measured or popped out of layout on each change: cheap enough
 * to run on every month a slider crosses.
 */
export function SwapText({ text, testId, className = '' }: { text: string; testId?: string; className?: string }) {
  return (
    <span className={`relative inline-grid overflow-hidden ${className}`} data-testid={testId} aria-live="polite">
      <AnimatePresence initial={false}>
        <motion.span
          key={text}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          transition={{ duration: dur.short, ease: ease.out }}
          className="col-start-1 row-start-1 whitespace-nowrap"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
