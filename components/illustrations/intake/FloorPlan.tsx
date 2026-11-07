'use client';
import { AnimatePresence, motion } from 'motion/react';
import { memo, useLayoutEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { ease, exit, spring } from '@/lib/motion';
import { Person, line } from './shared';

const MAX_RW = 44; // room width (narrower only when 8 rooms would not fit)
const RH = 52; // room depth
const GAP = 0; // rooms share their walls, like a real plan
const TOP = 2;
const H = TOP + RH + 3;

/** Same rule as the engine: more than 2 people per bedroom (or more than 2 with no bedroom). */
export const isOvercrowded = (bedrooms: number, occupants: number) => (bedrooms > 0 ? occupants / bedrooms > 2 : occupants > 2);

function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  // measured before the first paint, so the plan never glides into place on mount
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.round(el.clientWidth) || fallback);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, w] as const;
}

/** One bedroom: walls with a door gap on the bottom, and the door's swing. Memoized: re-renders only when it moves. */
const Room = memo(function Room({ x, rw, studio, wall }: { x: number; rw: number; studio: boolean; wall: string }) {
  const stroke = { stroke: wall, transition: 'stroke 200ms ease' };
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.95, x }}
      animate={{ opacity: 1, scale: 1, x }}
      exit={{ opacity: 0, scale: 0.95, transition: exit }}
      transition={spring.smooth}
      style={{ originX: 0.5, originY: 0.5 }}
    >
      <g transform={`translate(0 ${TOP})`}>
        <rect width={rw} height={RH} fill="var(--surface)" />
        <path d={`M17 ${RH}H${rw}V0H0V${RH}H6`} {...line} strokeDasharray={studio ? '3 3' : undefined} style={stroke} />
        <path d={`M6 ${RH}V${RH - 11}`} {...line} style={stroke} />
        <path d={`M6 ${RH - 11}A11 11 0 0 1 17 ${RH}`} {...line} stroke="var(--line)" />
      </g>
    </motion.g>
  );
});

/** One person in a room; walks (spring) when their room or spot changes. Memoized: still people don't render. */
const Occupant = memo(function Occupant({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.9, x, y }}
      animate={{ opacity: 1, scale: 1, x, y }}
      exit={{ opacity: 0, scale: 0.9, transition: exit }}
      transition={spring.smooth}
      style={{ originX: 0.5, originY: 1 }}
    >
      <Person s={s} />
    </motion.g>
  );
});

/**
 * The family's current home as a floor plan: one room per bedroom in a row (a dashed studio when there are
 * none), each with a door swing. Adding a bedroom slides the rooms apart and the new one pops in; people
 * spread across the rooms and walk to their new room when the count changes. Over 2 per bedroom, the walls
 * turn amber and "Overcrowded" appears.
 */
export const FloorPlan = memo(function FloorPlan({ bedrooms, occupants }: { bedrooms: number; occupants: number }) {
  const { t } = useLang();
  const [ref, w] = useWidth<HTMLDivElement>(340);
  const studio = bedrooms <= 0;
  const n = Math.max(1, Math.min(8, Math.round(bedrooms)));
  const occ = Math.max(1, Math.min(16, Math.round(occupants)));
  const over = isOvercrowded(bedrooms, occ);
  const RW = Math.min(MAX_RW, (w - (n - 1) * GAP) / n);
  const total = n * RW + (n - 1) * GAP;
  const x0 = (w - total) / 2;
  // positions inside the row; the row itself glides to stay centered
  const roomX = (i: number) => i * (RW + GAP);
  const wall = over ? 'var(--signal-amber)' : 'var(--pine)';

  // People fill the rooms round-robin; inside a room they stand in a small grid.
  const people = Array.from({ length: occ }, (_, k) => {
    const room = k % n;
    const slot = Math.floor(k / n);
    const inRoom = Math.floor(occ / n) + (room < occ % n ? 1 : 0);
    const cols = inRoom <= 2 ? inRoom : inRoom <= 6 ? 2 : inRoom <= 9 ? 3 : 4;
    const rows = Math.ceil(inRoom / cols);
    const cw = Math.min(15, (RW - 8) / cols);
    const ch = Math.min(22, (RH - 12) / rows);
    const s = Math.min(0.78, ch / 23, cw / 12);
    const r = Math.floor(slot / cols);
    const inRow = r === rows - 1 ? inRoom - r * cols : cols;
    const c = slot % cols;
    return {
      k,
      s,
      x: roomX(room) + RW / 2 + (c - (inRow - 1) / 2) * cw,
      // centered in the room, a little above the door
      y: TOP + (RH - 6) / 2 + (r - (rows - 1) / 2) * ch + (22 * s) / 2,
    };
  });

  return (
    <div ref={ref} className="pointer-events-none">
      <svg width="100%" height={H} viewBox={`0 0 ${w} ${H}`} className="block overflow-visible" aria-hidden>
        <motion.g initial={false} animate={{ x: x0 }} transition={spring.smooth}>
          <AnimatePresence initial={false}>
            {Array.from({ length: n }, (_, i) => (
              <Room key={i} x={roomX(i)} rw={RW} studio={studio} wall={wall} />
            ))}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {people.map((p) => (
              <Occupant key={p.k} x={p.x} y={p.y} s={p.s} />
            ))}
          </AnimatePresence>
        </motion.g>
      </svg>
      <div className="mt-2 flex h-[15px] justify-center">
        <AnimatePresence initial={false}>
          {over && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: exit }}
              transition={{ duration: 0.2, ease: ease.out }}
              className="t-helper border-l-2 border-signal-amber pl-2 font-medium text-signal-amber"
              data-testid="overcrowded"
            >
              {t('intakeArt.overcrowded')}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
