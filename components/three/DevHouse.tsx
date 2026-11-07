'use client';
import dynamic from 'next/dynamic';
import type { FrameName } from './HouseScene';

const Scene = dynamic(() => import('./HouseScene'), { ssr: false });

/** See app/dev/house/page.tsx. */
export function DevHouse({ variant, night, ground, frame, width, lit }: { variant: number; night: number; ground: number; frame: FrameName; width: number; lit: number }) {
  return (
    <div data-testid="dev-house" style={{ position: 'fixed', left: 0, top: 0, width, height: width * 0.8, zIndex: 999 }}>
      <Scene build="none" lit={lit} porch={variant === 0 || night > 0} doorOpen={variant === 0} smoke={variant === 0} sun={0} night={night} ground={ground} variant={variant} frame={frame} />
    </div>
  );
}
