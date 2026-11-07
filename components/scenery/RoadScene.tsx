'use client';
import { useReducedMotion } from 'motion/react';
import { Sky } from './Sky';
import { Horizon } from './Horizon';

/**
 * The result and plan pages' Road panel as a place: the neighborhood sky behind the Road (warming toward
 * golden hour as the ready date improves — `warmth` 0–1, opacity crossfade only) and the street along the
 * panel's bottom, faded at its top so the Road's labels stay on calm sky. One ambient motion: a cloud.
 */
export function RoadScene({ warmth = 0, children, className = '' }: { warmth?: number; children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={`relative overflow-hidden rounded-[14px] border border-line ${className}`} data-testid="road-scene">
      <div className="absolute inset-0">
        <Sky golden={warmth} clouds={!reduce} birds={false} />
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px]"
        style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, #000 42%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 42%)' }}
        aria-hidden
      >
        <Horizon life={false} golden={warmth} />
      </div>
      <div className="relative px-5 pb-[64px] pt-4">{children}</div>
    </div>
  );
}
