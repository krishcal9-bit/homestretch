'use client';
import Image from 'next/image';
import { animate, motion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { P } from '@/lib/illustrationPalette';
import { brand } from '@/lib/brand';
import { useLang } from '@/lib/i18n';
import { ArchBox, ARCH_BOX, LockupTitle, LOCKUP } from '@/components/brand/Wordmark';
import { hasWebGL } from '@/components/three/HouseCanvas';
import { STREET_SIZES, STREET_STILL, STREET_STILL_NIGHT } from '@/components/three/HeroHouse';
import { introStage, type ArchRect } from '@/components/three/introStage';
import { FILM, INTRO, INTRO_STILL, INTRO_WAIT_MS } from './introTimeline';

export { INTRO } from './introTimeline';

/**
 * The landing intro overlay: dusk to light, the 3D arch assembling, the keystone, the push through the arch to
 * the street, the name; then the hand-off to the hero (the lockup flies into the header, the house lands on
 * the hero's slot). Any click, wheel, touch or key skips straight to the final hero (the overlay fades in
 * 200ms). The hero is rendered underneath the whole time.
 * The film's canvas is the hero's own house canvas (components/three/HeroHouse.tsx): it hangs on this
 * overlay's stage while the film plays and docks into the hero's slot at the end (introStage.dock()). This
 * component owns the CSS sky, the depth of field (a blur on the stage), the 2D arch that the 3D one shrinks
 * into, and the live title lockup (text stays text).
 */
/** pending: the 3D stage is mounted, waiting for its first frame; late: it missed the wait → still. */
type Mode = 'pending' | 'late' | '3d' | 'still';
type Beat = 'film' | 'mount' | 'title' | 'exit' | 'landed';
const EASE = [0.23, 1, 0.32, 1] as const;
const heroSlot = () => document.querySelector('[data-testid=hero-house]')?.getBoundingClientRect() ?? null;
/** Without WebGL the arch is the static vector one, in the arch's own box. */
const ARCH_ASPECT = ARCH_BOX.w / ARCH_BOX.h;

export function Intro({ live = true, onStart, onHandoff, onDone, onSkip }: { live?: boolean; onStart?: (mode: '3d' | 'still') => void; onHandoff?: () => void; onDone: () => void; onSkip: () => void }) {
  const [vp, setVp] = useState<{ w: number; h: number } | null>(null);
  const [mode, setMode] = useState<Mode>('pending');
  const [beat, setBeat] = useState<Beat>('film');
  const [playing, setPlaying] = useState(false);
  const { t } = useLang();
  const titleRef = useRef<HTMLDivElement>(null);
  const titleSvg = useRef<SVGSVGElement>(null);
  const titleArch = useRef<SVGGElement>(null);
  const blurRef = useRef<HTMLDivElement>(null);
  const blurAnim = useRef<Animation | null>(null);
  const stillArch = useRef<HTMLDivElement>(null);
  const [shrink, setShrink] = useState<{ from: ArchRect; to: ArchRect; dur: number } | null>(null);
  const shrinkRef = useRef<HTMLDivElement>(null);
  const [stillTo, setStillTo] = useState<DOMRect | null>(null);
  const [stillHouse, setStillHouse] = useState(false);
  const finished = useRef(false);
  const t0 = useRef(0);
  const modeRef = useRef<Mode>('pending');
  const stageRef = useCallback((el: HTMLDivElement | null) => introStage.set({ stage: el }), []);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const end = useCallback(
    (skipped: boolean) => {
      if (finished.current) return;
      finished.current = true;
      timers.current.forEach(clearTimeout);
      document.documentElement.style.overflow = '';
      introStage.set({ mode: 'none' });
      if (skipped) {
        brand.set({ stage: 'header', fly: false });
        onSkip();
      } else onDone();
    },
    [onDone, onSkip],
  );

  /** The 3D arch has left the frame (or the still arch's turn is up): a 2D arch takes over at that rect and shrinks into the lockup's icon. */
  const archOut = useCallback((at: ArchRect | null) => {
    if (finished.current) return;
    // the 3D arch leaves the frame with its opening around the whole screen: the 2D arch starts there (its
    // stones just outside the edges) and closes in onto the lockup
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.max(vw * 1.8, vh * 1.56 * (ARCH_BOX.w / ARCH_BOX.h));
    const h = w * (ARCH_BOX.h / ARCH_BOX.w);
    const from = at ?? { left: (vw - w) / 2, top: -0.34 * h, width: w, height: h };
    const svg = titleSvg.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const k = r.width / LOCKUP.vb.w;
    const to = { left: r.left + (ARCH_BOX.x - LOCKUP.vb.x) * k, top: r.top + (ARCH_BOX.y - LOCKUP.vb.y) * k, width: ARCH_BOX.w * k, height: ARCH_BOX.h * k };
    const T = modeRef.current === '3d' ? FILM : INTRO_STILL;
    const now = (performance.now() - t0.current) / 1000;
    setShrink({ from, to, dur: Math.max(0.45, T.title + 0.06 - now) });
  }, []);

  // the shrink: one composited transform from the 3D arch's projected rect onto the lockup's arch, then the
  // lockup's own arch shows in the same frame and the overlay goes
  useLayoutEffect(() => {
    const el = shrinkRef.current;
    if (!shrink || !el) return;
    const { from, to, dur } = shrink;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const tf = `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})`;
    el.animate([{ transform: tf }, { transform: 'none' }], { duration: dur * 1000, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' });
    if (stillArch.current) {
      // the still: the vector arch hands over to the shrinking one in place (same drawing), then it shrinks
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'linear', fill: 'both' });
      stillArch.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'linear', fill: 'forwards' });
    }
    const id = setTimeout(() => {
      if (titleArch.current) titleArch.current.style.opacity = '1';
      el.style.visibility = 'hidden';
    }, dur * 1000);
    timers.current.push(id);
  }, [shrink]);

  /** Runs the film's overlay beats on one clock, anchored at the first 3D frame (or the still's start). */
  const run = useCallback(
    (m: '3d' | 'still') => {
      setMode(m);
      modeRef.current = m;
      t0.current = performance.now();
      setPlaying(true);
      introStage.set({ mode: m });
      performance.mark?.(`hs-intro-${m}`);
      // for the recording harness (a fake clock can't see performance marks)
      (window as Window & { __hsIntro?: { mode: string; t0: number } }).__hsIntro = { mode: m, t0: t0.current };
      onStart?.(m);
      const T = m === '3d' ? { ...INTRO, mount: FILM.mount } : INTRO_STILL;
      const at = (s: number, f: () => void) => timers.current.push(setTimeout(f, s * 1000));
      // depth of field: the stage softens as the arch rushes past, the street resolves, then it all blurs
      // behind the name (one compositor animation on the stage's filter)
      const blur = (el: HTMLDivElement | null) => {
        if (!el) return void requestAnimationFrame(() => blur(blurRef.current));
        if (finished.current) return;
        const total = T.exit;
        const k = (s: number) => Math.min(1, s / total);
        // [seconds, blur px]; each segment eases on its own
        const stops: [number, number][] =
          m === '3d'
            ? [
                [0, 0],
                [2.98, 0],
                [3.14, 5],
                [3.56, 0],
                [FILM.title, 0],
                [FILM.title + 0.4, 8],
                [total, 8],
              ]
            : [
                [0, 0],
                [T.title, 0],
                [T.title + 0.4, 8],
                [total, 8],
              ];
        const frames: Keyframe[] = stops.map(([s, px]) => ({ filter: `blur(${px}px)`, offset: k(s), easing: 'cubic-bezier(0.45, 0, 0.55, 1)' }));
        blurAnim.current = el.animate(frames, { duration: total * 1000, easing: 'linear', fill: 'forwards' });
      };
      blur(blurRef.current);
      at(T.mount, () => setBeat((b) => (b === 'film' ? 'mount' : b)));
      if (m === 'still') at(INTRO_STILL.out + 0.15, () => setStillHouse(true));
      if (m === 'still')
        at(INTRO_STILL.out, () => {
          const r = stillArch.current?.getBoundingClientRect();
          if (r) archOut({ left: r.left, top: r.top, width: r.width, height: r.height });
        });
      at(T.title, () => setBeat('title'));
      at(T.exit, () => {
        if (m === 'still') setStillTo(heroSlot());
        setBeat('exit');
        // un-blur from where the film left it
        const b = blurRef.current;
        if (b) {
          b.style.filter = 'blur(8px)';
          blurAnim.current?.cancel();
          void b.offsetWidth;
          b.style.transition = 'filter 300ms cubic-bezier(0.23,1,0.32,1)';
          b.style.filter = 'blur(0px)';
        }
        if (titleArch.current) titleArch.current.style.opacity = '1';
        brand.set({ stage: 'title', fly: true });
        onHandoff?.();
        // The lockup flies onto the header's slot: one vector element shrinking (crisp all the way), then the
        // header's own lockup takes over at the same size and place.
        const tl = titleRef.current;
        const from = titleSvg.current?.getBoundingClientRect();
        const to = document.querySelector('[data-brand-slot] svg')?.getBoundingClientRect();
        if (tl && from && to) {
          tl.style.transformOrigin = '0 0';
          animate(tl, { x: to.left - from.left, y: to.top - from.top, scale: to.width / from.width }, { type: 'spring', duration: 0.7, bounce: 0 }).then(() => {
            if (finished.current) return;
            brand.set({ stage: 'header', fly: true });
            setBeat('landed');
          });
        } else {
          brand.set({ stage: 'header', fly: true });
          setBeat('landed');
        }
      });
      at(T.total, () => {
        // the house canvas moves into the hero's slot (same frame) before the overlay goes
        if (m === '3d') introStage.dock();
        end(false);
      });
    },
    [archOut, end, onHandoff, onStart],
  );

  useEffect(() => {
    setVp({ w: window.innerWidth, h: window.innerHeight });
    brand.set({ stage: 'title', fly: false });
    requestAnimationFrame(() => document.documentElement.classList.remove('hs-veil'));
    document.documentElement.style.overflow = 'hidden';
    const skip = () => end(true);
    const opts = { once: true, passive: true } as const;
    window.addEventListener('pointerdown', skip, opts);
    window.addEventListener('keydown', skip, opts);
    window.addEventListener('wheel', skip, opts);
    window.addEventListener('touchmove', skip, opts);
    const gl = hasWebGL();
    introStage.set({ mode: gl ? 'pending' : 'still', firstFrame: false });
    if (!gl) run('still');
    // the hero's house canvas, on this stage, has drawn its first frame: the film starts
    const off = introStage.subscribe(() => {
      const s = introStage.get();
      if (s.firstFrame && s.mode === 'pending' && !finished.current) run('3d');
    });
    const offArch = introStage.onArchOut(() => archOut(null));
    const wait = gl ? setTimeout(() => setMode((m) => (m === 'pending' ? 'late' : m)), INTRO_WAIT_MS) : undefined;
    const list = timers.current;
    return () => {
      if (wait) clearTimeout(wait);
      off();
      offArch();
      introStage.set({ mode: 'none', stage: null });
      list.forEach(clearTimeout);
      ['pointerdown', 'keydown', 'wheel', 'touchmove'].forEach((e) => window.removeEventListener(e, skip));
      document.documentElement.style.overflow = '';
    };
  }, [archOut, end, run]);

  // three.js was too slow: play the still version instead
  useEffect(() => {
    if (mode === 'late' && !finished.current) run('still');
  }, [mode, run]);

  if (!vp) return <div className="ks-twilight fixed inset-0 z-[70]" aria-hidden />;

  // big: ~85% of a phone's width, ~60% of a desktop's
  const titleW = vp.w < 640 ? Math.round(vp.w * 0.86) : Math.round(Math.min(1080, Math.max(520, vp.w * 0.6)));
  const dim = beat === 'title' || beat === 'exit';
  // the sky stays gone once the hand-off starts (the lockup landing in the header must not bring it back)
  const exiting = beat === 'exit' || beat === 'landed';
  const T = mode === '3d' ? FILM : INTRO_STILL;
  // the still version: the locked arch (a render of the 3D one), then the house behind the name
  const archH = Math.min(vp.h * 0.46, (vp.w * 0.7) / ARCH_ASPECT);
  const archBox = { w: archH * ARCH_ASPECT, h: archH };
  const stillW = Math.min(vp.w * 0.86, vp.h * 0.7 * 1.25, 760);
  const stillBox = { left: (vp.w - stillW) / 2, top: vp.h * 0.5 - (stillW / 1.25) * 0.52, w: stillW };
  const showTitle = beat !== 'film' && beat !== 'landed';

  return (
    <div
      className={`fixed inset-0 z-[70] transition-opacity duration-200 ${playing ? 'ks-play' : ''}`}
      style={{ opacity: live ? 1 : 0, visibility: live ? undefined : 'hidden', pointerEvents: live ? undefined : 'none' }}
      aria-hidden
      data-testid={live ? 'intro' : undefined}
    >
      {/* the sky: the page's own sky under a deep ink-blue twilight that lifts, and a warm horizon glow rising */}
      <motion.div className="absolute inset-0" initial={false} animate={{ opacity: exiting ? 0 : 1 }} transition={{ duration: 0.45, ease: EASE }}>
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${P.skyTop} 0%, ${P.skyBottom} 72%)` }} />
        <div className="ks-horizon absolute inset-0" />
        <div className="ks-twilight absolute inset-0" style={{ animationDelay: `${(mode === '3d' ? FILM.sky : 0) * 1000}ms`, animationDuration: `${FILM.skyDur * 1000}ms` }} />
      </motion.div>

      {/* the stage: blurs (depth of field) and dims behind the name; the scene is never re-rendered for it */}
      <div ref={blurRef} className="absolute inset-0">
        {(mode === 'pending' || mode === '3d') && (
          <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: mode === '3d' ? 1 : 0 }} transition={{ duration: 0.3, ease: EASE }}>
            {/* the hero house's canvas hangs here during the film */}
            <div ref={stageRef} className="absolute inset-0" />
          </motion.div>
        )}
        {mode === 'still' && (
          <>
            <motion.div
              ref={stillArch}
              className="absolute"
              style={{ left: (vp.w - archBox.w) / 2, top: vp.h * 0.47 - archBox.h / 2, width: archBox.w, height: archBox.h }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: INTRO_STILL.arch }}
            >
              <ArchBox />
            </motion.div>
            {stillHouse && (
              <motion.div
                className="absolute"
                style={{ left: stillBox.left, top: stillBox.top, width: stillBox.w, aspectRatio: '5 / 4', originX: 0, originY: 0 }}
                initial={{ opacity: 0 }}
                animate={stillTo ? { opacity: 1, x: stillTo.left - stillBox.left, y: stillTo.top - stillBox.top, scale: stillTo.width / stillBox.w } : { opacity: 1 }}
                transition={stillTo ? { type: 'spring', duration: 0.5, bounce: 0 } : { duration: 0.6, ease: EASE }}
              >
                {/* the hero's own still (the house as it stands on the street), so the landing matches the slot */}
                <Image src={STREET_STILL} alt="" fill sizes={STREET_SIZES} className="still-day object-contain" />
                <Image src={STREET_STILL_NIGHT} alt="" fill sizes={STREET_SIZES} className="still-night object-contain" />
              </motion.div>
            )}
          </>
        )}
      </div>
      {/* dim to ~30% behind the name */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ background: P.skyBottom }}
        initial={{ opacity: 0 }}
        animate={{ opacity: dim && beat !== 'exit' ? 0.7 : 0 }}
        transition={{ duration: dim && beat !== 'exit' ? 0.4 : 0.35, ease: EASE }}
      />

      {/* the arch, shrinking from where the 3D one left the frame into the lockup's icon */}
      {shrink && !exiting && (
        <div ref={shrinkRef} className="pointer-events-none absolute" style={{ left: shrink.to.left, top: shrink.to.top, width: shrink.to.width, height: shrink.to.height, transformOrigin: '50% 50%', willChange: 'transform' }}>
          <ArchBox />
        </div>
      )}

      {/* the lockup: dead centre, the hero of the intro; mounted early (letters hidden) so the arch can land on it */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {showTitle && (
          <LockupTitle
            ref={titleRef}
            svgRef={titleSvg}
            archRef={titleArch}
            archHidden
            width={titleW}
            tagline={t('brand.tagline')}
            revealAt={Math.max(0, T.title - T.mount)}
            leaving={beat === 'exit'}
          />
        )}
      </div>
    </div>
  );
}
