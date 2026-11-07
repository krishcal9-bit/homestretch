'use client';
import { AnimatePresence, motion } from 'motion/react';
import { dur, ease } from '@/lib/motion';

/** Month crossfade: old moves up 8px and fades, new comes in from 8px below (both share one grid cell, so no layout pop). */
export function AnimatedMonth({ text, className = '', testId, wrap = false }: { text: string; className?: string; testId?: string; wrap?: boolean }) {
  return (
    <span className={`relative inline-grid overflow-hidden ${className}`} data-testid={testId} aria-live="polite">
      <AnimatePresence initial={false}>
        <motion.span
          key={text}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          transition={{ duration: dur.short, ease: ease.out }}
          className={`col-start-1 row-start-1 ${wrap ? '' : 'whitespace-nowrap'}`}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
