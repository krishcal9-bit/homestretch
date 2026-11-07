'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { motion } from 'motion/react';

/**
 * Section-by-section navigation for the landing page.
 *  - Down / PageDown / Space / J → next section; Up / PageUp / K → previous. 800ms, cubic-bezier(0.77,0,0.175,1)
 *    (a camera move: each scene's layers travel at their own speed, the skies crossfade).
 *  - Presses during a move are ignored; keys are never hijacked while focus is in an input, slider,
 *    radio group or (for Space) a button.
 *  - Wheel/trackpad scroll smoothly (Lenis); touch scrolls natively. A pinned section (data-stages) takes one
 *    press per stage.
 *  - Tracks the active section and how many times each has been activated (to replay its animation).
 *  - Tracks the target: where the camera is headed. It changes the moment a move starts (arrow, dot, key)
 *    or, while scrolling freely, when a section crosses the middle of the viewport. The landing's sky
 *    crossfades and its scenes' ambient motion start and stop on the target (its own context, so only
 *    the few components that follow it re-render).
 */
type Ctx = {
  ids: string[];
  active: number;
  activations: number[];
  goTo: (i: number) => void;
  next: () => void;
  /** a section can hold a press of Down (return true to keep the camera where it is, e.g. to finish its own animation) */
  setHold: (index: number, hold: (() => boolean) | null) => void;
};
const NavCtx = createContext<Ctx | null>(null);
export const useSectionNav = () => useContext(NavCtx)!;
const TargetCtx = createContext(0);
/** The section the camera is on or headed to. */
export const useSectionTarget = () => useContext(TargetCtx);

// cubic-bezier(0.77, 0, 0.175, 1)
function bez(t: number) {
  const x1 = 0.77, y1 = 0, x2 = 0.175, y2 = 1;
  const at = (s: number, a: number, b: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  let lo = 0, hi = 1;
  for (let i = 0; i < 20; i++) {
    const m = (lo + hi) / 2;
    if (at(m, x1, x2) < t) lo = m;
    else hi = m;
  }
  return at((lo + hi) / 2, y1, y2);
}

const HEADER = 64;
/** One section change, start to land. */
export const MOVE_MS = 800;

type Lenis = import('lenis').default;
let lenisRef: Lenis | null = null;
/** The landing's smooth scroller (null with reduced motion, before it loads, or off the landing). */
export const getLenis = () => lenisRef;

/** Document y where a section rests under the fixed header. */
const restOf = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY - HEADER;

/**
 * Every place a press of Down can land, in document order: each section's resting position, plus, for a pinned
 * section (`data-stages="N"` on the section, its inner content sticky), N − 1 more evenly spaced stops through its
 * pinned scroll, so a pinned scene advances one stage per press before the page moves on.
 */
function readStops(ids: string[]) {
  const out: { y: number; section: number }[] = [];
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = i === 0 ? 0 : restOf(el);
    out.push({ y: top, section: i });
    const n = Number(el.dataset.stages ?? 0);
    if (n > 1) {
      const run = el.offsetHeight - (window.innerHeight - HEADER);
      for (let k = 1; k < n; k++) out.push({ y: top + (run * k) / (n - 1), section: i });
    }
  });
  return out;
}

export function SectionNavProvider({ ids, children, enabled = true }: { ids: string[]; children: ReactNode; enabled?: boolean }) {
  const [active, setActive] = useState(0);
  const [target, setTargetState] = useState(0);
  const targetRef = useRef(0);
  const activeRef = useRef(0);
  // play counts: a section's count goes up the moment it becomes the target (the press, not the landing), so its
  // reveal runs during the move and the section is never blank when it arrives
  const [activations, setActivations] = useState<number[]>(() => ids.map((_, i) => (i === 0 ? 1 : 0)));
  const setTarget = useCallback((i: number) => {
    if (targetRef.current === i) return;
    targetRef.current = i;
    setTargetState(i);
    setActivations((a) => a.map((n, k) => (k === i ? n + 1 : n)));
  }, []);
  const moving = useRef(false);
  const holds = useRef(new Map<number, () => boolean>());
  const setHold = useCallback((index: number, hold: (() => boolean) | null) => {
    if (hold) holds.current.set(index, hold);
    else holds.current.delete(index);
  }, []);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Smooth scrolling (Lenis) on the landing; native scrolling with reduced motion.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let alive = true;
    let raf = 0;
    import('lenis').then(({ default: Lenis }) => {
      if (!alive) return;
      const l = new Lenis({ lerp: 0.12, wheelMultiplier: 0.9, smoothWheel: true });
      lenisRef = l;
      if (!enabledRef.current) l.stop();
      const loop = (t: number) => {
        l.raf(t);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      lenisRef?.destroy();
      lenisRef = null;
    };
  }, []);

  // the intro owns the screen until it ends: no smooth scrolling under it
  useEffect(() => {
    const l = lenisRef;
    if (!l) return;
    if (enabled) l.start();
    else l.stop();
  }, [enabled]);

  // Where the camera is: the section whose resting position is above the viewport's middle (scroll position,
  // read once per frame; no observers, so a move never waits on one).
  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const mid = window.scrollY + (window.innerHeight - HEADER) / 2;
      let best = 0;
      ids.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el && (i === 0 ? 0 : restOf(el)) <= mid) best = i;
      });
      if (best !== activeRef.current) {
        activeRef.current = best;
        setActive(best);
      }
      if (!moving.current) setTarget(best);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ids, setTarget]);

  /** One camera move to a document y (section `sec` is the target from the first frame). */
  const moveTo = useCallback(
    (y: number, sec: number) => {
      if (moving.current) return;
      setTarget(sec);
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const l = lenisRef;
      if (reduce || !l) {
        if (reduce) return window.scrollTo(0, y);
        // Lenis not loaded yet: a plain eased scroll
        moving.current = true;
        const from = window.scrollY;
        const t0 = performance.now();
        const step = (now: number) => {
          const p = Math.min(1, (now - t0) / MOVE_MS);
          window.scrollTo(0, from + (y - from) * bez(p));
          if (p < 1) requestAnimationFrame(step);
          else moving.current = false;
        };
        return void requestAnimationFrame(step);
      }
      moving.current = true;
      l.scrollTo(y, {
        duration: MOVE_MS / 1000,
        easing: bez,
        lock: true,
        force: true,
        onComplete: () => {
          moving.current = false;
        },
      });
      // never stay locked if a move is interrupted
      window.setTimeout(() => (moving.current = false), MOVE_MS + 150);
    },
    [setTarget],
  );

  const goTo = useCallback(
    (i: number) => {
      const idx = Math.max(0, Math.min(ids.length - 1, i));
      const el = document.getElementById(ids[idx]);
      if (!el) return;
      moveTo(idx === 0 ? 0 : restOf(el), idx);
    },
    [ids, moveTo],
  );
  /** Down / Up: the next stop (a pinned scene's next stage, else the next section). */
  const step = useCallback(
    (dir: 1 | -1) => {
      // the section on screen may hold the press (it finishes its own sequence first)
      if (dir > 0 && holds.current.get(activeRef.current)?.()) return;
      const stops = readStops(ids);
      const y = window.scrollY;
      const s = dir > 0 ? stops.find((p) => p.y > y + 4) : [...stops].reverse().find((p) => p.y < y - 4);
      if (s) moveTo(s.y, s.section);
    },
    [ids, moveTo],
  );
  const next = useCallback(() => goTo(activeRef.current + 1 >= ids.length ? 0 : activeRef.current + 1), [goTo, ids.length]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      const role = el?.getAttribute?.('role');
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (role === 'slider' || role === 'radio' || role === 'tab' || role === 'listbox' || role === 'menu' || role === 'switch') return;
      const isButton = tag === 'BUTTON' || tag === 'A' || role === 'button';
      const k = e.key;
      let dir: 0 | 1 | -1 = 0;
      if (k === 'ArrowDown' || k === 'PageDown' || k === 'j' || k === 'J' || (k === ' ' && !isButton && !e.shiftKey)) dir = 1;
      else if (k === 'ArrowUp' || k === 'PageUp' || k === 'k' || k === 'K' || (k === ' ' && !isButton && e.shiftKey)) dir = -1;
      if (!dir) return;
      e.preventDefault();
      if (moving.current) return; // ignore extra presses while a move is in progress
      step(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, step]);

  const value = useMemo(() => ({ ids, active, activations, goTo, next, setHold }), [ids, active, activations, goTo, next, setHold]);
  return (
    <NavCtx.Provider value={value}>
      <TargetCtx.Provider value={target}>{children}</TargetCtx.Provider>
    </NavCtx.Provider>
  );
}

/**
 * A section's play count: 0 until it first becomes the target, then up by one each time it does (key content on
 * it to replay). It never drops back: a section's content is always there, its reveal simply runs again.
 */
export function useSectionPlay(index: number, ref?: RefObject<HTMLElement | null>) {
  void ref;
  const { activations } = useSectionNav();
  return activations[index] ?? 0;
}

/** Round arrow at the bottom center of a section: next section, or back to the top on the last one. */
export function SectionArrow({ index, label, topLabel, bob = false, tone = 'light' }: { index: number; label: string; topLabel: string; bob?: boolean; tone?: 'light' | 'dark' }) {
  const { ids, goTo, active } = useSectionNav();
  const last = index === ids.length - 1;
  const color = tone === 'dark' ? '#ffffff' : 'var(--pine)';
  return (
    <button
      type="button"
      onClick={() => goTo(last ? 0 : index + 1)}
      aria-label={last ? topLabel : label}
      className={`press absolute bottom-6 left-1/2 z-[2] flex h-[44px] w-[44px] -translate-x-1/2 items-center justify-center rounded-full border ${tone === 'dark' ? 'border-white/80 hover:bg-white/10' : 'border-pine bg-paper/80 hover:bg-pine-soft'}`}
      data-testid={`section-arrow-${index}`}
    >
      <span className="flex" style={{ transform: last ? 'rotate(180deg)' : undefined }}>
        <svg width="18" height="18" viewBox="0 0 18 18" className={bob && active === index ? 'arrow-bob' : undefined} aria-hidden>
          <path d="M9 3v11M4 9.5 9 14.5l5-5" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

/** Dot rail on the right edge (desktop): shows the current section; the active pill glides. */
export function SectionDots({ labels }: { labels: string[] }) {
  const { ids, active, goTo } = useSectionNav();
  return (
    <nav aria-label="Sections" className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-1 xl:flex" data-testid="section-dots">
      {ids.map((id, i) => (
        <button key={id} type="button" onClick={() => goTo(i)} aria-label={labels[i]} aria-current={active === i ? 'true' : undefined} className="relative flex h-[28px] w-[28px] items-center justify-center">
          <span className="block h-[6px] w-[6px] rounded-full bg-ink-2/40" />
          {active === i && <motion.span layoutId="section-dot" className="absolute h-[18px] w-[6px] rounded-full bg-pine" transition={{ type: 'spring', duration: 0.35, bounce: 0 }} />}
        </button>
      ))}
    </nav>
  );
}
