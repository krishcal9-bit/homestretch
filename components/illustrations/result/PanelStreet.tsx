'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { Skyline } from '@/components/ui/Skyline';

const ASPECT = 1440 / 120; // the Skyline's street viewBox

/**
 * The street under the result and plan Road, sized to its own aspect ratio from the panel's width, so the
 * whole street shows: the first houses' windows light up one per ticked plan item, and the last house (the
 * Keys house) turns its door brass when the date settles. (At a fixed height the street is cropped at both
 * ends inside a narrow panel, and neither would be visible.)
 */
export function PanelStreet({ litCount, keysLit }: { litCount: number; keysLit: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setH(Math.round(el.clientWidth / ASPECT));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    // aspect-ratio reserves the street's height before it's measured (no layout shift on the server-rendered plan page)
    <div ref={ref} className="-mx-5 mt-2 overflow-hidden" style={{ aspectRatio: `${ASPECT} / 1` }}>
      {h > 0 && <Skyline mode="static" count={10} height={h} className="opacity-70" keysLit={keysLit} litCount={litCount} />}
    </div>
  );
}
