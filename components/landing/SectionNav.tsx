'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';

/**
 * Section-by-section navigation for the landing page.
 *  - Down / PageDown / Space / J → next section; Up / PageUp / K → previous. 700ms, cubic-bezier(0.77,0,0.175,1).
 *  - Presses during a move are ignored; keys are never hijacked while focus is in an input, slider,
 *    radio group or (for Space) a button.
 *  - Wheel/trackpad/touch scroll normally; CSS scroll-snap settles on sections.
 *  - Tracks the active section and how many times each has been activated (to replay its animation).
 */
type Ctx = { ids: string[]; active: number; activations: number[]; goTo: (i: number) => void; next: () => void };
const NavCtx = createContext<Ctx | null>(null);
export const useSectionNav = () => useContext(NavCtx)!;

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

export function SectionNavProvider({ ids, children, enabled = true }: { ids: string[]; children: ReactNode; enabled?: boolean }) {
  const [active, setActive] = useState(0);
  const [activations, setActivations] = useState<number[]>(() => ids.map((_, i) => (i === 0 ? 1 : 0)));
  const moving = useRef(false);
  const activeRef = useRef(0);

  // Scroll snapping only on the landing page.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('landing-snap');
    return () => html.classList.remove('landing-snap');
  }, []);

  // Track the active section (the one covering most of the viewport).
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const ratios = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) ratios.set(e.target.id, e.intersectionRatio);
        let best = activeRef.current;
        let bestR = -1;
        ids.forEach((id, i) => {
          const r = ratios.get(id) ?? 0;
          if (r > bestR) {
            bestR = r;
            best = i;
          }
        });
        if (bestR >= 0.45 && best !== activeRef.current) {
          activeRef.current = best;
          setActive(best);
          setActivations((a) => a.map((n, i) => (i === best ? n + 1 : n)));
        }
      },
      { threshold: [0, 0.25, 0.45, 0.6, 0.8, 1], rootMargin: `-${HEADER}px 0px 0px 0px` },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);

  const goTo = useCallback(
    (i: number) => {
      const idx = Math.max(0, Math.min(ids.length - 1, i));
      const el = document.getElementById(ids[idx]);
      if (!el || moving.current) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const from = window.scrollY;
      const to = idx === 0 ? 0 : el.getBoundingClientRect().top + window.scrollY - HEADER;
      if (reduce) return window.scrollTo(0, to);
      moving.current = true;
      const html = document.documentElement;
      html.classList.add('landing-snap-off'); // snapping would fight the programmatic scroll
      const t0 = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - t0) / 700);
        window.scrollTo(0, from + (to - from) * bez(p));
        if (p < 1) requestAnimationFrame(step);
        else {
          html.classList.remove('landing-snap-off');
          moving.current = false;
        }
      };
      requestAnimationFrame(step);
    },
    [ids],
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
      let dir = 0;
      if (k === 'ArrowDown' || k === 'PageDown' || k === 'j' || k === 'J' || (k === ' ' && !isButton && !e.shiftKey)) dir = 1;
      else if (k === 'ArrowUp' || k === 'PageUp' || k === 'k' || k === 'K' || (k === ' ' && !isButton && e.shiftKey)) dir = -1;
      if (!dir) return;
      e.preventDefault();
      if (moving.current) return; // ignore extra presses while a move is in progress
      goTo(activeRef.current + dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, goTo]);

  const value = useMemo(() => ({ ids, active, activations, goTo, next }), [ids, active, activations, goTo, next]);
  return <NavCtx.Provider value={value}>{children}</NavCtx.Provider>;
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
