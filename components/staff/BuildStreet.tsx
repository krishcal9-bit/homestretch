'use client';
import { BuildArt } from './BuildArt';
import type { BuildStage } from './buildStage';

const LOTS: BuildStage[] = ['staked', 'framing', 'finished'];

/** Three lots along one street, each a step further along: what the console keeps track of. Static. */
export function BuildStreet({ size = 72, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`flex items-end gap-3 ${className}`} aria-hidden>
      {LOTS.map((s) => (
        <BuildArt key={s} stage={s} size={size} />
      ))}
    </div>
  );
}
