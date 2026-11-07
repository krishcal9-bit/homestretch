'use client';
import Image from 'next/image';
import { animate, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { P } from '@/lib/illustrationPalette';
import { brand } from '@/lib/brand';
import { useLang } from '@/lib/i18n';
import { WordmarkTitle, TITLE_T } from '@/components/brand/Wordmark';
import { hasWebGL } from '@/components/three/HouseCanvas';
import { STREET_SIZES, STREET_STILL, STREET_STILL_NIGHT } from '@/components/three/HeroHouse';
import { introStage } from '@/components/three/introStage';
import { INTRO, INTRO_STILL, INTRO_WAIT_MS } from './introTimeline';

export { INTRO } from './introTimeline';

/**
 * The landing intro overlay: the 3D house film, then the HomeStretch title card, then the hand-off to the
 * hero (the wordmark flies into the header, the house lands on the hero's slot). Any click, wheel, touch or
 * key skips straight to the final hero. The hero is rendered underneath the whole time.
 * The film's canvas is the hero's own house canvas (components/three/HeroHouse.tsx): it hangs on this
 * overlay's stage while the film plays and docks into the hero's slot at the end (introStage.dock()).
 */
/** pending: the 3D stage is mounted, waiting for its first frame; late: it missed the wait → still. */
type Mode = 'pending' | 'late' | '3d' | 'still';
const EASE = [0.23, 1, 0.32, 1] as const;
const heroSlot = () => document.querySelector('[data-testid=hero-house]')?.getBoundingClientRect() ?? null;

export function Intro({ live = true, onStart, onHandoff, onDone, onSkip }: { live?: boolean; onStart?: (mode: '3d' | 'still') => void; onHandoff?: () => void; onDone: () => void; onSkip: () => void }) {
  const [vp, setVp] = useState<{ w: number; h: number } | null>(null);
  const [mode, setMode] = useState<Mode>('pending');
  const [beat, setBeat] = useState<'film' | 'title' | 'exit' | 'landed'>('film');
  const { t } = useLang();
  const titleRef = useRef<HTMLDivElement>(null);
  const titleSvg = useRef<SVGSVGElement>(null);
  const [pulse, setPulse] = useState(0);
  const [stillTo, setStillTo] = useState<DOMRect | null>(null);
  const finished = useRef(false);
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

  /** Runs the title card and the hand-off on a clock anchored at the film's start. */
  const run = useCallback(
    (m: '3d' | 'still') => {
      setMode(m);
      introStage.set({ mode: m });
      performance.mark?.(`hs-intro-${m}`);
      onStart?.(m);
      const T = m === '3d' ? INTRO : INTRO_STILL;
      const at = (s: number, f: () => void) => timers.current.push(setTimeout(f, s * 1000));
      at(T.title, () => setBeat('title'));
      at(T.exit, () => {
        if (m === 'still') setStillTo(heroSlot());
        setBeat('exit');
        brand.set({ stage: 'title', fly: true });
        onHandoff?.();
        // The title flies onto the header's slot: one vector element shrinking (crisp all the way), then the
        // header's own wordmark takes over at the same size and place.
        const el = titleRef.current;
        const from = titleSvg.current?.getBoundingClientRect();
        const to = document.querySelector('[data-brand-slot] svg')?.getBoundingClientRect();
        if (el && from && to) {
          el.style.transformOrigin = '0 0';
          animate(el, { x: to.left - from.left, y: to.top - from.top, scale: to.width / from.width }, { type: 'spring', duration: 0.7, bounce: 0 }).then(() => {
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
    [end, onHandoff, onStart],
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
    const wait = gl ? setTimeout(() => setMode((m) => (m === 'pending' ? 'late' : m)), INTRO_WAIT_MS) : undefined;
    const list = timers.current;
    return () => {
      if (wait) clearTimeout(wait);
      off();
      introStage.set({ mode: 'none', stage: null });
      list.forEach(clearTimeout);
      ['pointerdown', 'keydown', 'wheel', 'touchmove'].forEach((e) => window.removeEventListener(e, skip));
      document.documentElement.style.overflow = '';
    };
  }, [end, run]);

  // three.js was too slow: play the still version instead
  useEffect(() => {
    if (mode === 'late' && !finished.current) run('still');
  }, [mode, run]);

  if (!vp) return <div className="fixed inset-0 z-[70]" style={{ background: P.skyBottom }} aria-hidden />;

  // big: ~85% of a phone's width, ~68% of a desktop's (cap height ≈ 105px at 1440)
  const titleW = vp.w < 640 ? Math.round(vp.w * 0.85) : Math.round(Math.min(1120, Math.max(560, vp.w * 0.68)));
  const dim = beat === 'title';
  // the sky stays gone once the hand-off starts (the title landing in the header must not bring it back)
  const exiting = beat === 'exit' || beat === 'landed';
  // the still version: a large centred house that moves onto the hero slot at the end
  const stillW = Math.min(vp.w * 0.86, vp.h * 0.7 * 1.25, 760);
  const stillBox = { left: (vp.w - stillW) / 2, top: vp.h * 0.5 - (stillW / 1.25) * 0.52, w: stillW };

  return (
    <div className="fixed inset-0 z-[70] transition-opacity duration-200" style={{ opacity: live ? 1 : 0, visibility: live ? undefined : 'hidden', pointerEvents: live ? undefined : 'none' }} aria-hidden data-testid={live ? 'intro' : undefined}>
      {/* opaque base: the hero never shows through before the sky is up */}
      <motion.div className="absolute inset-0" style={{ background: P.skyBottom }} initial={false} animate={{ opacity: exiting ? 0 : 1 }} transition={{ duration: 0.45, ease: EASE }} />
      {/* soft sky (a gradient inside the illustration, modelling light) */}
      <motion.div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${P.skyTop} 0%, ${P.skyBottom} 72%)` }} initial={{ opacity: 0 }} animate={{ opacity: exiting ? 0 : 1 }} transition={{ duration: exiting ? 0.45 : 0.35, ease: EASE }} />

      {/* the stage: blurs and dims behind the title (CSS filter + overlay; the scene isn't re-rendered for it) */}
      <div className="absolute inset-0" style={{ filter: dim ? 'blur(8px)' : 'blur(0px)', transition: `filter ${dim ? 400 : 300}ms cubic-bezier(0.23,1,0.32,1)` }}>
        {(mode === 'pending' || mode === '3d') && (
          <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: mode === '3d' ? 1 : 0 }} transition={{ duration: 0.45, ease: EASE }}>
            {/* the hero house's canvas hangs here during the film */}
            <div ref={stageRef} className="absolute inset-0" />
          </motion.div>
        )}
        {mode === 'still' && (
          <motion.div
            className="absolute"
            style={{ left: stillBox.left, top: stillBox.top, width: stillBox.w, aspectRatio: '5 / 4', originX: 0, originY: 0 }}
            initial={{ y: 14 }}
            animate={stillTo ? { x: stillTo.left - stillBox.left, y: stillTo.top - stillBox.top, scale: stillTo.width / stillBox.w } : { y: 0 }}
            transition={stillTo ? { type: 'spring', duration: 0.5, bounce: 0 } : { duration: 0.5, ease: EASE }}
          >
            {/* the hero's own still (the house as it stands on the street), so the landing matches the slot */}
            <Image src={STREET_STILL} alt="" fill sizes={STREET_SIZES} priority className="still-day object-contain" />
            <Image src={STREET_STILL_NIGHT} alt="" fill sizes={STREET_SIZES} className="still-night object-contain" />
          </motion.div>
        )}
      </div>
      {/* dim to ~30% for the title, with a gentle brightness pulse when the mark's window lights */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ background: P.skyBottom }}
        initial={{ opacity: 0 }}
        animate={{ opacity: dim ? (pulse ? [0.7, 0.55, 0.7] : 0.7) : 0 }}
        transition={dim && pulse ? { duration: 0.7, times: [0, 0.35, 1], ease: 'easeInOut' } : { duration: dim ? 0.4 : 0.35, ease: EASE }}
      />

      {/* the title card: dead centre, the hero of the intro */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {(beat === 'title' || beat === 'exit') && (
          <WordmarkTitle ref={titleRef} svgRef={titleSvg} width={titleW} tagline={t('brand.tagline')} leaving={beat === 'exit'} onMarkLit={() => setPulse((p) => p + 1)} />
        )}
      </div>
    </div>
  );
}

/** The title card's duration (for docs/tests). */
export const TITLE_DURATION = TITLE_T.done;
