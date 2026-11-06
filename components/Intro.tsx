'use client';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { ease } from '@/lib/motion';
import { IsoHouse, ISO, isoPaths, isoPx } from '@/components/illustrations/IsoHouse';

/**
 * "Blueprint to keys" — the landing intro, every load (~2.8s).
 *  0.0–0.6  blueprint: grid reveals from the center (clip-path circle); ground line, wall guides, roof diagonal and ticks sketch in
 *  0.6–1.6  the house builds on the guides (floor → walls extrude → roof drops → door fills brass → window lights); guides fade as parts finish
 *  1.6–2.2  a brass key slides along the ground to the door and turns; the door opens; "Homestretch" rises letter by letter
 *  2.2–2.8  pull back: the ground line becomes the hero's Road, the house shrinks onto the hero's Keys house
 * Any click, wheel, touch or key skips to the final frame. The hero is rendered underneath the whole time.
 */
export const INTRO = { pull: 2.2, total: 2.8 };
const pull = { type: 'spring', duration: 0.6, bounce: 0 } as const;
type Rect = { x: number; y: number; w: number };

export function Intro({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [vp, setVp] = useState<{ w: number; h: number } | null>(null);
  const [doorOpen, setDoorOpen] = useState(false);
  const [target, setTarget] = useState<null | { house: Rect; track: Rect & { cy: number } }>(null);
  const finished = useRef(false);

  useEffect(() => {
    setVp({ w: window.innerWidth, h: window.innerHeight });
    requestAnimationFrame(() => document.documentElement.classList.remove('hs-veil'));
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    const end = (skipped: boolean) => {
      if (finished.current) return;
      finished.current = true;
      html.style.overflow = prevOverflow;
      if (skipped) onSkip();
      else onDone();
    };
    const skip = () => end(true);
    const opts = { once: true, passive: true } as const;
    window.addEventListener('pointerdown', skip, opts);
    window.addEventListener('keydown', skip, opts);
    window.addEventListener('wheel', skip, opts);
    window.addEventListener('touchmove', skip, opts);
    const tDoor = setTimeout(() => setDoorOpen(true), 2050);
    const tPull = setTimeout(() => {
      const house = document.querySelector('[data-testid=sample-road] [data-testid=keys-house] svg');
      const track = document.querySelector('[data-testid=sample-road] svg line');
      if (!house || !track) return end(true);
      const h = house.getBoundingClientRect();
      const t = track.getBoundingClientRect();
      setTarget({ house: { x: h.left, y: h.top, w: h.width }, track: { x: t.left, y: t.top, w: t.width, cy: t.top + t.height / 2 } });
    }, INTRO.pull * 1000);
    const tEnd = setTimeout(() => end(false), (INTRO.total + 0.05) * 1000);
    return () => {
      [tDoor, tPull, tEnd].forEach(clearTimeout);
      ['pointerdown', 'keydown', 'wheel', 'touchmove'].forEach((e) => window.removeEventListener(e, skip));
      html.style.overflow = prevOverflow;
    };
  }, [onDone, onSkip]);

  if (!vp) return <div className="fixed inset-0 z-[70] bg-paper" aria-hidden />;

  // Stage geometry (px)
  const G = Math.round(vp.h * 0.6); // ground line
  const S = Math.round(Math.min(240, Math.max(150, vp.w * 0.17))); // house width
  const base = isoPx(S, 0, 0);
  const hx = Math.round(vp.w / 2 - S / 2); // house svg left
  const hy = Math.round(G - base.y); // house svg top
  const px = (x: number, y: number) => {
    const p = isoPx(S, x, y);
    return { x: hx + p.x, y: hy + p.y };
  };
  const left = px(0, 0);
  const right = px(ISO.W + ISO.dx, -ISO.dy);
  const top = px(0, -ISO.H).y;
  const peak = px(ISO.W / 2, -ISO.H - ISO.R);
  const run = peak.x - left.x;
  const slope = (peak.y - top) / run; // roof diagonal
  const door = px(isoPaths.door.x + isoPaths.door.w / 2, 0);
  const ticks = Array.from({ length: Math.ceil(vp.w / 48) }, (_, i) => i * 48 + 24);
  const word = 'Homestretch';
  const fadeAt = (at: number) => ({ initial: { opacity: 1 }, animate: { opacity: 0 }, transition: { duration: 0.25, delay: at } });

  const houseTo = target ? { x: target.house.x - hx, y: target.house.y - hy, scale: target.house.w / S } : null;
  const lineTo = target ? { x: target.track.x, y: target.track.cy - G, scaleX: target.track.w / vp.w } : null;

  return (
    <div className="fixed inset-0 z-[70]" aria-hidden data-testid="intro">
      {/* paper: fades away during the pull-back, revealing the hero underneath */}
      <motion.div className="absolute inset-0 bg-paper" initial={false} animate={{ opacity: target ? 0 : 1 }} transition={{ duration: 0.45, ease: ease.out }} />
      {/* blueprint grid, revealed from the center outward */}
      <motion.div
        className="absolute inset-0"
        style={{ backgroundImage: 'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)', backgroundSize: '24px 24px', backgroundPosition: `${vp.w / 2}px ${G}px` }}
        initial={{ clipPath: 'circle(0% at 50% 60%)', opacity: 0.5 }}
        animate={{ clipPath: 'circle(75% at 50% 60%)', opacity: target ? 0 : 0.5 }}
        transition={{ clipPath: { duration: 0.6, ease: ease.out }, opacity: { duration: 0.3 } }}
      />
      {/* construction sketch */}
      <svg className="absolute inset-0" width={vp.w} height={vp.h}>
        <motion.g {...fadeAt(1.5)}>
          {ticks.map((x, i) => (
            <motion.line key={x} x1={x} x2={x} y1={G} y2={G + 6} stroke="var(--pine)" strokeWidth="1" initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ duration: 0.15, delay: 0.3 + Math.min(i, 30) * 0.008 }} />
          ))}
        </motion.g>
        <motion.g {...fadeAt(1.0)}>
          {[left.x, right.x].map((x, i) => (
            <motion.line key={i} x1={x} x2={x} y1={G + 10} y2={top - 70} stroke="var(--pine)" strokeWidth="1" strokeDasharray="3 4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: ease.out, delay: 0.25 + i * 0.06 }} />
          ))}
        </motion.g>
        <motion.g {...fadeAt(1.3)}>
          <motion.line x1={left.x - 30} y1={top - slope * 30} x2={peak.x + run * 0.35} y2={peak.y + slope * run * 0.35} stroke="var(--pine)" strokeWidth="1" strokeDasharray="3 4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: ease.out, delay: 0.35 }} />
        </motion.g>
      </svg>
      {/* the ground line: becomes the hero's Road on the pull-back */}
      <motion.div
        className="absolute left-0"
        style={{ top: G - 1.5, width: vp.w, height: 3, originX: 0 }}
        initial={false}
        animate={lineTo ? { x: lineTo.x, y: lineTo.y, scaleX: lineTo.scaleX, opacity: [1, 1, 0] } : { x: 0, y: 0, scaleX: 1 }}
        transition={lineTo ? { ...pull, opacity: { duration: 0.6, times: [0, 0.8, 1] } } : undefined}
      >
        <svg width={vp.w} height="3" className="block">
          <motion.line x1="0" x2={vp.w} y1="1.5" y2="1.5" stroke="var(--pine)" strokeWidth="2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, ease: ease.inOut, delay: 0.05 }} />
        </svg>
      </motion.div>
      {/* the house: builds on the guides, then shrinks onto the hero's Keys house */}
      <motion.div
        className="absolute"
        style={{ left: hx, top: hy, originX: 0, originY: 0 }}
        initial={false}
        animate={houseTo ? { x: houseTo.x, y: houseTo.y, scale: houseTo.scale, opacity: [1, 1, 0] } : { x: 0, y: 0, scale: 1 }}
        transition={houseTo ? { ...pull, opacity: { duration: 0.6, times: [0, 0.9, 1] } } : undefined}
      >
        <IsoHouse size={S} build="intro" delay={0.6} lit doorOpen={doorOpen} strokeWidth={2} />
      </motion.div>
      {/* the key slides along the ground to the door and turns */}
      <motion.div
        className="absolute"
        style={{ left: 0, top: G - 24 }}
        initial={{ x: -48, opacity: 0 }}
        animate={target ? { x: door.x - 38, opacity: 0, transition: { duration: 0.15 } } : { x: door.x - 38, opacity: 1 }}
        transition={{ x: { duration: 0.4, ease: ease.inOut, delay: 1.6 }, opacity: { duration: 0.1, delay: 1.6 } }}
      >
        <motion.svg width="44" height="22" viewBox="0 0 28 14" initial={{ rotate: 0 }} animate={{ rotate: 90 }} transition={{ duration: 0.18, ease: ease.out, delay: 2.0 }} style={{ originX: '85%', originY: '50%' }}>
          <circle cx="6" cy="7" r="4.5" fill="none" stroke="var(--brass)" strokeWidth="2.2" />
          <path d="M10.5 7H26M21 7v4M24.5 7v3" fill="none" stroke="var(--brass)" strokeWidth="2.2" strokeLinecap="round" />
        </motion.svg>
      </motion.div>
      {/* the name, letter by letter */}
      <motion.p
        className="absolute flex justify-center text-[28px] font-semibold tracking-[-0.01em] text-ink"
        style={{ left: 0, width: vp.w, top: peak.y - 64 }}
        initial={false}
        animate={{ opacity: target ? 0 : 1 }}
        transition={{ duration: 0.15 }}
      >
        {word.split('').map((c, i) => (
          <span key={i} className="inline-block overflow-hidden">
            <motion.span className="inline-block" initial={{ y: '100%' }} animate={{ y: '0%' }} transition={{ duration: 0.3, ease: ease.out, delay: 1.7 + i * 0.025 }}>
              {c}
            </motion.span>
          </span>
        ))}
      </motion.p>
    </div>
  );
}
