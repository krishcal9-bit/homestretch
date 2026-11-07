'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { P, mix } from '@/lib/illustrationPalette';
import { useSectionNav, useSectionPlay, useSectionTarget } from '../SectionNav';

/**
 * The landing's scene frame. Each landing section is ONE full-bleed illustrated place: its own sky, its own
 * ground and depth layers, and its centrepiece drawn into the same world. There is no background shared
 * between sections.
 *
 *   <SceneRoot index={2} sky={SKY.road} skyArt={<Stars />}>      the frame: fills the section, clips its layers
 *     <Layer speed={0.4}>…far hills…</Layer>                     depth layers, back to front
 *     <Layer speed={1}>…ground, road, house, car…</Layer>        (the centrepiece usually lives on speed 1)
 *     <Layer speed={1.2}>…grass in the near corners…</Layer>
 *   </SceneRoot>
 *
 * Camera move. Every layer's translateY is tied to the page scroll relative to where its section rests under
 * the header, by depth: speed < 1 travels slower than the page (far), 1 with it (ground), > 1 faster
 * (foreground). So a section change (Down arrow, dots, wheel, touch) reads as a camera move: the outgoing
 * layers slide up and away at different speeds, foreground fastest, while the incoming ones rise in.
 * Transforms only; none under reduced motion.
 *
 * Sky. Each scene's sky is fixed to the viewport (it stays put while the ground moves, like a real sky) and
 * crossfades with its neighbour's by the scroll: the incoming sky fades in on top while the outgoing one waits
 * underneath until covered, so the page's paper never shows. It lives in the scene (SceneRoot renders it);
 * `sky` is its CSS background (a SKY preset), `skyArt` anything drawn in it (glows; stars and moon with
 * the il-night class). Colours come from P, so the theme's night palette turns every sky into its night.
 *
 * Switches on the frame, read by CSS (app/globals.css, r6:scenes):
 *  - data-live: the camera has settled on this section: ambient loops (.sc-amb) run; paused otherwise and
 *    during every move.
 *  - data-night: force the night look regardless of the theme (dark theme turns it on anyway).
 * Scenes two or more sections from the camera skip rendering (content-visibility: hidden).
 * Inside a frame, size things with container query units (cqw/cqh) of the frame.
 */
export const HEADER = 64;

type SceneCtxValue = { d: MotionValue<number>; unit: RefObject<number> };
const SceneCtx = createContext<SceneCtxValue | null>(null);

/** Sky backgrounds, one per section (CSS; P is theme-aware, so each has a night). */
export const SKY = {
  /** late afternoon over a street */
  hero: `linear-gradient(180deg, ${P.skyTop} 0%, ${mix(P.skyTop, P.skyBottom, 0.55)} 46%, ${mix(P.skyBottom, P.goldBottom, 0.45)} 80%, ${mix(P.goldBottom, P.goldTop, 0.4)} 100%)`,
  /** indoors: the kitchen wall in warm window light */
  home: `linear-gradient(180deg, ${mix(P.wall, P.trim, 0.45)} 0%, ${mix(P.wall, P.trim, 0.15)} 40%, ${P.wall} 70%, ${mix(P.wall, P.wallShade, 0.55)} 100%)`,
  /** golden hour over open country */
  road: `linear-gradient(180deg, ${mix(P.skyTop, P.goldTop, 0.4)} 0%, ${mix(P.goldTop, P.goldBottom, 0.35)} 34%, ${P.goldBottom} 56%, ${mix(P.goldBottom, P.honeyLight, 0.32)} 74%, ${mix(P.goldTop, P.sageLight, 0.25)} 100%)`,
  /** a clear, high sky (an elevated view) */
  neighborhood: `linear-gradient(180deg, ${mix(P.skyTop, P.skyBottom, 0.2)} 0%, ${mix(P.skyTop, P.skyBottom, 0.7)} 38%, ${mix(P.skyBottom, P.sageLight, 0.18)} 100%)`,
  /** dusk, the last light low on the horizon */
  closing: `linear-gradient(180deg, ${mix(P.duskTop, P.ink, 0.35)} 0%, ${P.duskTop} 34%, ${mix(P.duskTop, P.duskBottom, 0.6)} 52%, ${mix(P.duskBottom, P.honey, 0.22)} 64%, ${mix(P.duskBottom, P.ink, 0.25)} 100%)`,
} as const;
const SKY_BY_INDEX = [SKY.hero, SKY.home, SKY.road, SKY.neighborhood, SKY.closing];

/**
 * Page scroll in px relative to where the element's section rests under the header (0 when the section is
 * in place; positive once it has moved up), clamped to ±1.25 screens. `unit` is a screen (px).
 */
export function useRestOffset(ref: RefObject<HTMLElement | null>) {
  const { scrollY } = useScroll();
  const geo = useRef({ rest: 0 });
  const unit = useRef(800);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const el = ref.current?.closest('section') ?? ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      geo.current.rest = r.top + window.scrollY - HEADER;
      unit.current = Math.max(1, window.innerHeight - HEADER);
      setTick((t) => t + 1);
    };
    measure();
    // an earlier section changing height moves this one: re-measure when the page's size changes
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(document.body);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [ref]);
  const clamp = (v: number) => Math.max(-unit.current * 1.25, Math.min(unit.current * 1.25, v));
  const d = useTransform(scrollY, (y) => clamp(y - geo.current.rest));
  // re-derive once after a measure, without waiting for the next scroll
  useEffect(() => {
    d.set(clamp(scrollY.get() - geo.current.rest));
  }, [tick, d, scrollY]);
  return { d, unit };
}

/** True while the camera has settled on section `index` (ambient motion runs only then). */
export function useSceneLive(index: number) {
  const target = useSectionTarget();
  const { active } = useSectionNav();
  return target === index && active === index;
}

/**
 * True while section `index` is where the camera rests, next to it, or where it is headed. Scenes farther
 * away skip rendering entirely (content-visibility: hidden): fewer layers to composite on every frame of a
 * move. Neighbours are switched at rest, so a move never pays for painting a scene; the hero (where "back
 * to the top" lands from anywhere) is always ready.
 */
export function useSceneShown(index: number) {
  const target = useSectionTarget();
  const { active } = useSectionNav();
  return index === 0 || Math.abs(active - index) <= 1 || target === index;
}

/**
 * The scene's centrepiece clock: 0 until the section first becomes active (draw the resting, "before"
 * state), then 1, 2, … on each activation (key the centrepiece on it so it replays: the car drives, the
 * phone fills, the badges count). It drops back to 0 once the section has left the screen entirely, so a
 * return replays from the start. It changes one frame after the section's text, so the two never share a
 * frame. Activation happens once the camera has landed (SectionNav), so the section's text reveals after
 * the scene arrives.
 */
export function useScenePlay(index: number) {
  const { ids } = useSectionNav();
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    ref.current = document.getElementById(ids[index]);
  }, [ids, index]);
  const n = useSectionPlay(index, ref);
  const [play, setPlay] = useState(n);
  useEffect(() => {
    const id = requestAnimationFrame(() => setPlay(n));
    return () => cancelAnimationFrame(id);
  }, [n]);
  return play;
}

/**
 * A scene's sky: fixed to the viewport behind every section (z -10), shown for this section only. Opacity
 * follows the scroll: the incoming sky (later in the page, so on top) fades in over the outgoing one, which
 * stays opaque until it is covered.
 */
function Sky({ d, unit, sky, children }: { d: MotionValue<number>; unit: RefObject<number>; sky: string; children?: ReactNode }) {
  const opacity = useTransform(d, (v) => {
    const p = v / unit.current;
    return p >= 0 ? (p < 1.5 ? 1 : 0) : Math.max(0, 1 + p);
  });
  return (
    <motion.div className="sc-sky pointer-events-none fixed inset-0 -z-10" style={{ background: sky, opacity }} aria-hidden>
      {children}
    </motion.div>
  );
}

/**
 * The scene frame: fills its section (absolute, inset 0), renders the scene's sky, clips its layers and
 * provides the scroll offset. `index` is the section's index in SectionNav. `sky` defaults to the section's
 * SKY preset. `night` forces the night look (the dark theme turns it on anyway).
 */
export function SceneRoot({ index, sky, skyArt, night = false, className = '', testId, interactive = false, children }: { index: number; sky?: string; skyArt?: ReactNode; night?: boolean; className?: string; testId?: string; /** the scene holds real controls (the hero's Road): its decorative layers hide themselves instead */ interactive?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = !!useReducedMotion();
  const live = useSceneLive(index);
  const shown = useSceneShown(index);
  const { d, unit } = useRestOffset(ref);
  const still = useMotionValue(0);
  const ctx = useMemo(() => ({ d: reduce ? still : d, unit }), [reduce, still, d, unit]);
  return (
    <div
      ref={ref}
      className="sc-root pointer-events-none absolute inset-0"
      aria-hidden={interactive ? undefined : true}
      data-testid={testId}
      data-live={live ? 'true' : 'false'}
      data-night={night ? 'true' : 'false'}
      style={shown ? undefined : { contentVisibility: 'hidden' }}
    >
      {/* the sky crossfades by the real scroll, reduced motion included (moves are instant then) */}
      <Sky d={d} unit={unit} sky={sky ?? SKY_BY_INDEX[index] ?? SKY.hero}>
        {skyArt}
      </Sky>
      <div className={`absolute inset-0 overflow-hidden ${className}`}>
        <SceneCtx.Provider value={ctx}>{children}</SceneCtx.Provider>
      </div>
    </div>
  );
}
/** The same frame, by its new name. */
export const SceneFrame = SceneRoot;

/**
 * One depth layer, filling the scene. `speed` is how fast it travels relative to the page: far 0.3–0.6,
 * ground 1 (put the centrepiece here), foreground 1.1–1.3. Each layer is its own compositor layer, so a move
 * never repaints a scene.
 */
export function Layer({ speed, className = '', style, children }: { speed: number; /** ignored (layers no longer fade) */ fade?: number; className?: string; style?: React.CSSProperties; children: ReactNode }) {
  const ctx = useContext(SceneCtx)!;
  const k = 1 - speed;
  const y = useTransform(ctx.d, (v) => v * k);
  return (
    <motion.div className={`sc-layer absolute inset-0 ${className}`} style={{ ...style, y }}>
      {children}
    </motion.div>
  );
}

/** Extra travel for something inside a layer that sits deeper than the layer itself (a view through a window). */
export function useDepthOffset(relative: number) {
  const ctx = useContext(SceneCtx)!;
  return useTransform(ctx.d, (v) => v * relative);
}

/**
 * Mounts a scene's art once the camera is on its section or next to it (or a few seconds after load, when
 * the page is idle), so the first paint only carries the hero. A neighbour mounts at rest, never mid-move.
 */
export function useSceneMount(index: number) {
  const { active } = useSectionNav();
  const [mounted, setMounted] = useState(index === 0);
  useEffect(() => {
    if (mounted) return;
    if (Math.abs(active - index) <= 1) return setMounted(true);
    type Idle = Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const w = window as Idle;
    let idle = 0;
    const t = window.setTimeout(() => {
      idle = w.requestIdleCallback ? w.requestIdleCallback(() => setMounted(true), { timeout: 4000 }) : window.setTimeout(() => setMounted(true), 0);
    }, 5200 + index * 400);
    return () => {
      clearTimeout(t);
      w.cancelIdleCallback?.(idle);
    };
  }, [active, index, mounted]);
  return mounted;
}
