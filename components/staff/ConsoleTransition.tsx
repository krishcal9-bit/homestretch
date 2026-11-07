'use client';
import { AnimatePresence, motion, useIsPresent, useReducedMotion, type Variants } from 'motion/react';
import { usePathname } from 'next/navigation';
import { LayoutRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { dur, ease } from '@/lib/motion';
import { arrivingFromLogin, clearConsoleArrival } from './handoff';

// Console page switches: the old page leaves fast, the new one slides 12px in from the side of the tab
// you moved toward. With reduced motion there is no travel at all, only the short crossfade.
// A tab's page often commits before its data has streamed in (the frame is shared, the page is dynamic), so
// the arriving page holds at its start position, invisible, until it has content (or 1.5s at most) and only
// then slides in: never a fade over an empty page followed by a pop. Straight after sign-in the first page
// arrives the same way (from the right), continuing the login panel's exit to the left.
// A direct load or reload of a console page appears without travel.
const ORDER = ['/staff', '/staff/stress', '/staff/ready', '/staff/checkin', '/staff/homes', '/staff/match', '/staff/insights', '/staff/digest'];
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

/**
 * One page: waits (held at 'enter') until it has laid out content, then plays its entrance from a fresh
 * frame. Rendering a page is a long task, and an animation started in the frame that ran it is timed from
 * that frame's start: it would be most of the way done before its first visible frame (a pop, not a slide).
 */
function Page({ wait, travel, children }: { wait: boolean; travel: number; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(!wait);
  useLayoutEffect(() => {
    const el = box.current;
    if (ready || !el) return;
    let raf = 0;
    const land = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => (raf = requestAnimationFrame(() => setReady(true))));
    };
    if (el.offsetHeight > 0) land();
    const ro = new ResizeObserver(() => el.offsetHeight > 0 && land());
    ro.observe(el);
    const t = setTimeout(() => setReady(true), 1500);
    return () => {
      ro.disconnect();
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [ready]);
  return (
    <motion.div ref={box} custom={travel} variants={page} initial="enter" animate={ready ? 'shown' : 'enter'} exit="leave">
      <HoldRoute>{children}</HoldRoute>
    </motion.div>
  );
}

export function ConsoleTransition({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const reduce = useReducedMotion();
  const [arrive] = useState(arrivingFromLogin);
  useEffect(() => clearConsoleArrival(), []);
  const first = useRef(path);
  const moved = useRef(false);
  const prev = useRef(path);
  const dir = useRef(1);
  if (prev.current !== path) {
    dir.current = rank(path) >= rank(prev.current) ? 1 : -1;
    prev.current = path;
  }
  if (path !== first.current) moved.current = true;
  // MotionConfig would only skip the tween and still jump the page 12px, so drop the offset outright.
  const travel = reduce ? 0 : dir.current;
  return (
    <AnimatePresence mode="wait" initial={false} custom={travel}>
      <Page key={path} wait={moved.current || arrive} travel={travel}>
        {children}
      </Page>
    </AnimatePresence>
  );
}
