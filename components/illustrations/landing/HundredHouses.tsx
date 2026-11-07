'use client';
import { useEffect, useState } from 'react';

/**
 * Closing band: 100 tiny houses that fill in white one by one (8ms stagger) — the hundred homes.
 * CSS animation per icon (off the main thread); replays when remounted.
 */
export function HundredHouses({ reduce, cols = 20 }: { reduce: boolean; cols?: number }) {
  const rows = Math.ceil(100 / cols);
  const cell = 22;
  // the 200 paths mount one frame after the band's text (keeps each commit short); the svg box is there from the start
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <svg viewBox={`0 0 ${cols * cell} ${rows * cell}`} className="block w-full max-w-[560px]" aria-hidden data-testid="hundred-houses">
      {ready && Array.from({ length: 100 }, (_, i) => {
        const x = (i % cols) * cell + 3;
        const y = Math.floor(i / cols) * cell + 3;
        return (
          <g key={i}>
            <path d={`M${x} ${y + 16}V${y + 7}L${x + 8} ${y}L${x + 16} ${y + 7}V${y + 16}Z`} className="hh-outline" />
            <path d={`M${x} ${y + 16}V${y + 7}L${x + 8} ${y}L${x + 16} ${y + 7}V${y + 16}Z`} className={reduce ? 'hh-fill hh-on' : 'hh-fill'} style={reduce ? undefined : { animationDelay: `${i * 8}ms` }} />
          </g>
        );
      })}
    </svg>
  );
}
