'use client';
import { motion } from 'motion/react';
import { spring } from '@/lib/motion';

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="h-[3px] w-full bg-line" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <motion.div className="h-full origin-left bg-pine" initial={false} animate={{ scaleX: value }} transition={spring.smooth} style={{ width: '100%' }} />
    </div>
  );
}
