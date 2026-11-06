'use client';
import { motion } from 'motion/react';
import { useState } from 'react';
import { spring } from '@/lib/motion';

/**
 * Physical slider: native range input for keyboard/touch/a11y, custom visuals.
 * Filled track follows instantly; thumb grows 20→24px on press with spring.snappy.
 */
export function Slider({ id, value, min, max, step, onChange, label, valueText }: { id: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; label: string; valueText: string }) {
  const [pressed, setPressed] = useState(false);
  const f = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;
  return (
    <div className="relative h-[44px] touch-pan-y">
      <div className="absolute left-0 right-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-line" />
      <div className="absolute left-0 top-1/2 h-[4px] -translate-y-1/2 rounded-full bg-pine" style={{ width: `${f * 100}%` }} />
      <div className="pointer-events-none absolute top-1/2 h-0 w-0" style={{ left: `calc(${f * 100}% + ${(0.5 - f) * 24}px)` }}>
        <motion.div
          className="absolute -left-[12px] -top-[12px] h-[24px] w-[24px] rounded-full border-2 border-pine bg-surface"
          initial={false}
          animate={{ scale: pressed ? 1 : 20 / 24 }}
          transition={spring.snappy}
        />
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={valueText}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        onBlur={() => setPressed(false)}
        className="slider-input absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </div>
  );
}
