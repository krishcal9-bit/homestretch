'use client';
import { Minus, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { spring } from '@/lib/motion';

export function Stepper({
  id,
  value,
  min,
  max,
  onChange,
  decLabel,
  incLabel,
  flash,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  decLabel: string;
  incLabel: string;
  flash?: number;
}) {
  const btn = 'flex h-[48px] w-[52px] items-center justify-center text-pine transition-colors duration-[120ms] hover:bg-pine-soft disabled:text-line disabled:hover:bg-transparent';
  return (
    <div className="inline-flex w-fit items-center rounded-[8px] border border-line bg-surface">
      <motion.button type="button" whileTap={{ scale: 0.92 }} transition={spring.snappy} className={`${btn} rounded-l-[8px]`} disabled={value <= min} aria-label={decLabel} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus size={18} strokeWidth={1.75} />
      </motion.button>
      <input
        key={flash}
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
        }}
        className={`tnum h-[48px] w-[56px] border-x border-line bg-transparent text-center text-[18px] font-medium [appearance:textfield] focus:outline-none focus-visible:bg-pine-soft [&::-webkit-inner-spin-button]:appearance-none ${flash ? 'just-filled' : ''}`}
      />
      <motion.button type="button" whileTap={{ scale: 0.92 }} transition={spring.snappy} className={`${btn} rounded-r-[8px]`} disabled={value >= max} aria-label={incLabel} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus size={18} strokeWidth={1.75} />
      </motion.button>
    </div>
  );
}
