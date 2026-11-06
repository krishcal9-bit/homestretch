'use client';
import { motion } from 'motion/react';
import { useState } from 'react';
import { ease, spring } from '@/lib/motion';

/**
 * Physical slider: native range input for keyboard/touch/a11y, custom visuals.
 * Filled track follows instantly; thumb grows on press with spring.snappy.
 * `nudgeAt` (seconds): one small 6px nudge right and back to hint that it's draggable.
 */
export function Slider({
  id,
  value,
  min,
  max,
  step,
  onChange,
  label,
  valueText,
  size = 'md',
  nudgeAt,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  label: string;
  valueText: string;
  size?: 'md' | 'lg';
  nudgeAt?: number;
}) {
  const [pressed, setPressed] = useState(false);
  const f = max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0;
  const thumb = size === 'lg' ? 32 : 24;
  const rest = size === 'lg' ? 26 : 20;
  const track = size === 'lg' ? 6 : 4;
  return (
    <div className={`relative touch-pan-y ${size === 'lg' ? 'h-[52px]' : 'h-[44px]'}`}>
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 rounded-full bg-line" style={{ height: track }} />
      <div className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full bg-pine" style={{ height: track, width: `${f * 100}%` }} />
      <div className="pointer-events-none absolute top-1/2 h-0 w-0" style={{ left: `calc(${f * 100}% + ${(0.5 - f) * thumb}px)` }}>
        <motion.div
          initial={false}
          animate={nudgeAt !== undefined ? { x: [0, 6, 0] } : undefined}
          transition={nudgeAt !== undefined ? { delay: nudgeAt, duration: 0.4, ease: ease.inOut, times: [0, 0.45, 1] } : undefined}
        >
          <motion.div
            className="absolute rounded-full border-2 border-pine bg-surface"
            style={{ width: thumb, height: thumb, left: -thumb / 2, top: -thumb / 2 }}
            initial={false}
            animate={{ scale: pressed ? 1 : rest / thumb }}
            transition={spring.snappy}
          />
        </motion.div>
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
