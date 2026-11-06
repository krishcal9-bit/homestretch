'use client';
import { motion } from 'motion/react';
import { useId } from 'react';
import { spring } from '@/lib/motion';

type Option<T extends string> = { value: T; label: string };

/** Segmented control: the selected background is one shared layoutId element that glides. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  name,
}: {
  options: Option<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
  name?: string;
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`relative inline-flex w-full rounded-[8px] border border-line bg-surface p-1 ${size === 'sm' ? 'w-auto' : ''}`}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            name={name}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const i = options.findIndex((x) => x.value === value);
              if (e.key === 'Enter') {
                // Like a native radio: Enter submits the surrounding form.
                const form = (e.currentTarget as HTMLElement).closest('form');
                if (form) {
                  e.preventDefault();
                  form.requestSubmit();
                }
              } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                onChange(options[(i + 1 + options.length) % options.length].value);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                onChange(options[(i - 1 + options.length) % options.length].value);
              }
            }}
            tabIndex={selected || (value === undefined && o.value === options[0].value) ? 0 : -1}
            className={`relative flex-1 rounded-[6px] font-medium transition-colors duration-[120ms] ${
              size === 'sm' ? 'min-h-[36px] px-3 text-[13px]' : 'min-h-[44px] px-3 text-[15px]'
            } ${selected ? 'text-pine' : 'text-ink-2 hover:text-ink'}`}
          >
            {selected && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={spring.snappy}
                className="absolute inset-0 rounded-[6px] bg-pine-soft"
                aria-hidden
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
