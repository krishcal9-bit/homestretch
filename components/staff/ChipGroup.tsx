'use client';
import { motion } from 'motion/react';
import { useId } from 'react';
import { spring } from '@/lib/motion';

/** Text-chip filter. "All" plus options; the selected background is one shared layoutId element. */
export function ChipGroup({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const id = useId();
  const all = [{ value: 'all', label: 'All' }, ...options];
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1">
      <span className="mr-1 text-[13px] text-ink-2">{label}</span>
      {all.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`relative min-h-[36px] rounded-[8px] px-2.5 text-[13px] font-medium transition-colors duration-[120ms] before:absolute before:-inset-y-1 before:inset-x-0 before:content-[''] ${on ? 'text-pine' : 'text-ink-2 hover:text-ink'}`}
          >
            {on && <motion.span layoutId={`chip-${id}`} transition={spring.snappy} className="absolute inset-0 rounded-[8px] bg-pine-soft" aria-hidden />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
