'use client';
import type { SVGProps } from 'react';

/** Stroke style shared by every intake illustration: 1.5px pine, round joins, never scaled. */
export const line = {
  fill: 'none',
  stroke: 'var(--pine)',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  vectorEffect: 'non-scaling-stroke' as const,
};

/**
 * A person: round head over a body with rounded shoulders. Feet at (0,0), about 22 units tall at scale 1.
 * Filled with the surface color so a figure standing in front of something hides what's behind it.
 */
export function Person({ s = 1, ...rest }: { s?: number } & SVGProps<SVGGElement>) {
  return (
    <g {...rest}>
      <path d={`M${-5 * s} 0V${-8 * s}A${5 * s} ${5 * s} 0 0 1 ${5 * s} ${-8 * s}V0Z`} {...line} fill="var(--surface)" />
      <circle cx={0} cy={-17.5 * s} r={3.5 * s} {...line} fill="var(--surface)" />
    </g>
  );
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
