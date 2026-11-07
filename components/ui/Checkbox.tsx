'use client';
import { motion } from 'motion/react';
import { dur, ease } from '@/lib/motion';

/** Checkbox whose check draws as a path over 200ms. */
export function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border transition-colors duration-[120ms] ${checked ? 'border-pine bg-pine' : 'border-line-strong bg-surface'}`} aria-hidden>
      <svg width="14" height="14" viewBox="0 0 14 14">
        <motion.path
          d="M3 7.5 6 10.5 11.5 4"
          fill="none"
          stroke="var(--on-pine)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: dur.short, ease: ease.out }}
        />
      </svg>
    </span>
  );
}

export function Checkbox({ id, checked, onChange, label, help }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; help?: string }) {
  return (
    <label htmlFor={id} className="flex min-h-[44px] cursor-pointer items-start gap-3 py-2">
      <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="mt-[1px] rounded-[6px] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pine">
        <CheckMark checked={checked} />
      </span>
      <span>
        <span className="block text-[16px] text-ink">{label}</span>
        {help && <span className="t-helper mt-1 block text-ink-2">{help}</span>}
      </span>
    </label>
  );
}
