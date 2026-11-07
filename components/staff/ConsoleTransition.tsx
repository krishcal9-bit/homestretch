'use client';
import { AnimatePresence, motion, useIsPresent, useReducedMotion, type Variants } from 'motion/react';
import { usePathname } from 'next/navigation';
import { LayoutRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useContext, useEffect, useRef, useState } from 'react';
import { dur, ease } from '@/lib/motion';
import { arrivingFromLogin, clearConsoleArrival } from './handoff';

// Console page switches: the old page leaves fast, the new one slides 12px in from the side of the tab
// you moved toward. With reduced motion there is no travel at all, only the short crossfade.
// Straight after sign-in the first page arrives the same way (from the right), continuing the login
// panel's exit to the left. The console frame commits before the page's data has streamed in, so the
// slide waits (holding at the start position) until the page has content, or 1.5s at most.
// A direct load or reload of a console page appears without travel.
const ORDER = ['/staff', '/staff/checkin', '/staff/homes', '/staff/match', '/staff/insights'];
const SLIDE = 12;
const ENTER = { duration: dur.short, ease: ease.out };
const EXIT = { duration: dur.short * 0.7, ease: ease.out }; // exits ~70% of the entrance

const page: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: SLIDE * dir }),
  shown: { opacity: 1, x: 0, transition: ENTER },
  leave: (dir: number) => ({ opacity: 0, x: -SLIDE * dir, transition: EXIT }),
};

function rank(path: string) {
  let i = 0;
  ORDER.forEach((p, j) => {
    if (p === '/staff' ? path === p : path.startsWith(p)) i = j;
  });
  return i;
}

/**
 * While a page exits, App Router has already moved on, so the leaving copy would render the new route.
 * Holding the router context it last saw while present keeps the old page on screen until it is gone.
 * Live pages read the current context, so search-param changes and refreshes still flow through.
 */
function HoldRoute({ children }: { children: React.ReactNode }) {
  const ctx = useContext(LayoutRouterContext);
  const present = useIsPresent();
  const held = useRef(ctx);
  if (present) held.current = ctx;
  return <LayoutRouterContext.Provider value={held.current}>{children}</LayoutRouterContext.Provider>;
}

export function ConsoleTransition({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const reduce = useReducedMotion();
  const [arrive] = useState(arrivingFromLogin);
  const [landed, setLanded] = useState(!arrive);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    clearConsoleArrival();
    const el = box.current;
    if (!arrive || !el) return;
    const land = () => setLanded(true);
    const ro = new ResizeObserver(() => {
      if (el.offsetHeight > 0) land();
    });
    ro.observe(el);
    const t = setTimeout(land, 1500);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, [arrive]);
  const prev = useRef(path);
  const dir = useRef(1);
  if (prev.current !== path) {
    dir.current = rank(path) >= rank(prev.current) ? 1 : -1;
    prev.current = path;
  }
  // MotionConfig would only skip the tween and still jump the page 12px, so drop the offset outright.
  const travel = reduce ? 0 : dir.current;
  return (
    <AnimatePresence mode="wait" initial={false} custom={travel}>
      <motion.div key={path} ref={box} custom={travel} variants={page} initial="enter" animate={landed ? 'shown' : 'enter'} exit="leave">
        <HoldRoute>{children}</HoldRoute>
      </motion.div>
    </AnimatePresence>
  );
}
