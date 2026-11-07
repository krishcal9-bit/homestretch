'use client';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ease } from '@/lib/motion';
import { P } from '@/lib/illustrationPalette';
import { Pen } from './Pen';
import { DESK_STYLE, DeskDecor } from './DeskScene';

export const RULE = 24; // px: every line of text on the sheet sits on this grid
export const PAD_TOP = 20;
export const PAD_BOTTOM = 16;
const LINE_SECONDS = 0.075; // how long the writing takes to cross one line
const FOLD = 22; // the folded corner, px
const SIGN_SECONDS = 0.75;

/**
 * The paper's fibres: a deterministic tile of short, faintly curved strands over a fine grain, made once
 * as an SVG data URI (a background image is rasterised once, so the texture costs nothing while it moves).
 */
const FIBRES = (() => {
  let seed = 11;
  const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const T = 180;
  let d = '';
  for (let i = 0; i < 52; i++) {
    const x = r() * T;
    const y = r() * T;
    const a = r() * Math.PI;
    const l = 4 + r() * 10;
    const b = (r() - 0.5) * 5;
    const x2 = x + Math.cos(a) * l;
    const y2 = y + Math.sin(a) * l;
    const cx = (x + x2) / 2 + Math.cos(a + Math.PI / 2) * b;
    const cy = (y + y2) / 2 + Math.sin(a + Math.PI / 2) * b;
    d += `M${x.toFixed(1)} ${y.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='${T}' height='${T}'>` +
    `<filter id='g' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='3' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 0.43 0 0 0 0 0.40 0 0 0 0 0.34 0 0 0 0.07 0'/></filter>` +
    `<rect width='${T}' height='${T}' filter='url(#g)'/>` +
    `<path d='${d}' fill='none' stroke='${P.stoneShade}' stroke-width='0.6' stroke-linecap='round' opacity='0.32'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();
/** The sheet's soft shadow, blurred once inside an image (no live CSS blur to redo while things move over it). */
const SHEET_SHADOW = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'><filter id='b' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='3.2'/></filter><rect x='7' y='7' width='86' height='86' rx='2' fill='rgba(24,36,32,0.13)' filter='url(#b)'/></svg>`,
)}")`;
const PAPER_STYLE = {
  backgroundColor: P.paper,
  // light from the top-left falls off across the sheet; the fibres sit under it
  backgroundImage: `linear-gradient(155deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 42%, ${P.paperShade}66 100%), ${FIBRES}`,
  border: `1px solid ${P.paperShade}`,
  borderRadius: 4,
  clipPath: `polygon(0 0, calc(100% - ${FOLD}px) 0, 100% ${FOLD}px, 100% 100%, 0 100%)`,
} as const;

/** A hand-signed flourish in a 120 × 32 box (drawn with pathLength; the pen rides its leading end). */
const SIGNATURE =
  'M4 25C9 23 13 7 19 6C25 5 23 27 15 26C10 25.4 13 15 23 16C29 16.6 31 23 35 22.6C39 22.2 41 12 45 12C49 12 47 22 52 22.4C56 22.7 59 13 63 13.4C67 13.8 65 22 70 22.4C76 22.8 80 9 86 9.4C91 9.8 88 24 94 22.6C101 21 106 15.6 116 14.6';

/**
 * A sheet of paper with real material: faint fibres, light falling from the top-left, a folded top-right
 * corner and a soft shadow where it rests. It slides up and settles (a spring with a little give), then the
 * content is written onto it line by line (a clip that uncovers each line behind a small caret), and if the
 * content has a signature line (an element marked data-sign-line), an illustrated pen comes in and signs it
 * with a drawn stroke before lifting away. Children must keep every line on the 24px grid.
 * `streaming` holds back the last (possibly partial) line until the text is complete.
 */
export function PaperSheet({
  children,
  streaming = false,
  write = true,
  minLines = 8,
  lineCount,
  onWritten,
  className = '',
  testId,
}: {
  children: ReactNode;
  streaming?: boolean;
  /** false: show the content as is (e.g. reopened), no writing */
  write?: boolean;
  minLines?: number;
  /** lines of actual text when the content is taller than its text (a text area with a minimum height) */
  lineCount?: number;
  onWritten?: () => void;
  className?: string;
  testId?: string;
}) {
  const reduce = useReducedMotion();
  const paper = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const caret = useRef<HTMLSpanElement>(null);
  const sig = useRef<HTMLDivElement>(null);
  const sigPath = useRef<SVGPathElement>(null);
  const pen = useRef<HTMLDivElement>(null);
  const desk = useRef<HTMLDivElement>(null);
  const deskPen = useRef<HTMLImageElement>(null);
  const [measured, setMeasured] = useState(0);
  const [width, setWidth] = useState(0);
  const [landed, setLanded] = useState(false);
  // 'write' → 'sign' → 'done'
  const [stage, setStage] = useState<'write' | 'sign' | 'done'>(write && !reduce ? 'write' : 'done');
  const [signed, setSigned] = useState(!write || !!reduce);
  const doneRef = useRef(onWritten);
  doneRef.current = onWritten;

  useLayoutEffect(() => {
    const el = content.current;
    if (!el) return;
    const measure = () => {
      setMeasured(Math.max(0, Math.round((el.offsetHeight - PAD_TOP - PAD_BOTTOM) / RULE)));
      setWidth(el.offsetWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // writing starts once the sheet has mostly settled (its spring's tail still eases out underneath)
  useEffect(() => {
    const id = setTimeout(() => setLanded(true), reduce ? 0 : 420);
    return () => clearTimeout(id);
  }, [reduce]);

  const lines = lineCount ?? measured;
  const available = streaming ? Math.max(0, lines - 1) : lines;

  // The writing head, in lines (3.4 = three lines written and 40% of the fourth).
  const head = useMotionValue(0);
  const clip = useTransform(head, (h) => {
    const full = Math.floor(h);
    const y1 = PAD_TOP + full * RULE;
    const x = 20 + (h - full) * Math.max(0, width - 40);
    return `polygon(0 0, 100% 0, 100% ${y1}px, ${x}px ${y1}px, ${x}px ${y1 + RULE}px, 0 ${y1 + RULE}px)`;
  });
  const caretX = useTransform(head, (h) => 20 + (h - Math.floor(h)) * Math.max(0, width - 40));
  const caretY = useTransform(head, (h) => PAD_TOP + Math.floor(h) * RULE + 4);
  // re-checked each time the head catches up with the text that's there
  const [caughtUp, setCaughtUp] = useState(0);
  useEffect(() => {
    if (stage !== 'write' || !landed) return;
    const from = head.get();
    if (available > from) {
      const c = animate(head, available, { duration: (available - from) * LINE_SECONDS, ease: 'linear', onComplete: () => setCaughtUp((n) => n + 1) });
      return () => c.stop();
    }
    if (!streaming && lines > 0 && from >= lines) setStage('sign');
  }, [stage, landed, available, streaming, lines, head, caughtUp]);

  // Where the signature goes: over the content's signature line (re-placed whenever the content changes).
  const target = useRef<{ x: number; y: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const p = paper.current;
    const line = p?.querySelector<HTMLElement>('[data-sign-line]');
    const s = sig.current;
    if (!p || !s) return;
    if (!line || !line.offsetWidth) {
      target.current = null;
      s.style.visibility = 'hidden';
      return;
    }
    const pr = p.getBoundingClientRect();
    const lr = line.getBoundingClientRect();
    const w = Math.min(168, Math.max(96, lr.width * 0.85));
    // the flourish's baseline (y ≈ 24 of 32) sits just on the line, so its loops cross it like a real signature
    target.current = { x: lr.left - pr.left + 2, y: lr.bottom - pr.top - 5 - 24 * (w / 120), w };
    s.style.visibility = signed || stage === 'sign' ? 'visible' : 'hidden';
    s.style.transform = `translate(${target.current.x}px, ${target.current.y}px)`;
    s.style.width = `${w}px`;
  });

  // The pen is picked up from the desk, signs, and is put back; then the sheet is done.
  const ink = useMotionValue(0);
  // no ink until the nib touches the paper (a zero-length round-capped stroke would leave dots)
  const inkOn = useTransform(ink, (v) => (v > 0.002 ? 1 : 0));
  useEffect(() => {
    if (stage !== 'sign') return;
    const t = target.current;
    const path = sigPath.current;
    const pe = pen.current;
    const dk = desk.current;
    const pa = paper.current;
    if (!t || !path || !pe || !dk || !pa) {
      setStage('done');
      return;
    }
    // everything in the desk's coordinates (the pen travels outside the paper)
    const dr = dk.getBoundingClientRect();
    const pr = pa.getBoundingClientRect();
    const ox = pr.left - dr.left;
    const oy = pr.top - dr.top;
    const k = t.w / 120;
    const len = path.getTotalLength();
    const at = (v: number) => {
      const pt = path.getPointAtLength(len * v);
      return { x: ox + t.x + pt.x * k, y: oy + t.y + pt.y * k };
    };
    // where the pen lies on the desk: its nib at the left end, rotated a little off the writing angle
    const rest = deskPen.current?.getBoundingClientRect();
    const home = rest ? { x: rest.left - dr.left + 12, y: rest.top - dr.top + rest.height * 0.62 } : { x: dr.width - 40, y: dr.height - 16 };
    const REST_ANGLE = 21;
    const place = (x: number, y: number, r: number, sc = 1) => (pe.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg) scale(${sc})`);
    /** moves the pen between two points on an arc (lifted off the desk in between, a touch larger as it lifts) */
    const travel = (a: { x: number; y: number }, b: { x: number; y: number }, ra: number, rb: number, duration: number, done: () => void) =>
      animate(0, 1, {
        duration,
        ease: ease.inOut,
        onUpdate: (v) => {
          const lift = Math.sin(v * Math.PI);
          place(a.x + (b.x - a.x) * v, a.y + (b.y - a.y) * v - lift * 26, ra + (rb - ra) * v, 1 + lift * 0.06);
        },
        onComplete: done,
      });
    const start = at(0);
    place(home.x, home.y, REST_ANGLE);
    pe.style.opacity = '1';
    const runs: { stop: () => void }[] = [];
    runs.push(
      travel(home, start, REST_ANGLE, 0, 0.42, () =>
        // the stroke: ink follows the nib along the flourish
        runs.push(
          animate(ink, 1, {
            duration: SIGN_SECONDS,
            ease: ease.inOut,
            onUpdate: (v) => {
              const pt = at(v);
              place(pt.x, pt.y, Math.sin(v * Math.PI * 6) * 2);
            },
            // follow-through: back to where it lay, and the desk has its pen again
            onComplete: () =>
              runs.push(
                travel(at(1), home, 0, REST_ANGLE, 0.36, () => {
                  pe.style.opacity = '0';
                  setSigned(true);
                  setStage('done');
                }),
              ),
          }),
        ),
      ),
    );
    return () => runs.forEach((r) => r.stop());
  }, [stage, ink]);

  const finished = useRef(false);
  useEffect(() => {
    if (stage !== 'done' || finished.current || streaming || lines === 0) return;
    finished.current = true;
    doneRef.current?.();
  }, [stage, streaming, lines]);

  const writing = stage === 'write';
  return (
    <motion.div
      ref={desk}
      className={`relative isolate overflow-hidden rounded-[10px] px-3 pb-9 pt-[60px] sm:px-6 ${className}`}
      style={DESK_STYLE}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: ease.out }}
    >
      <DeskDecor penAway={stage === 'sign'} penRef={deskPen} />
      <motion.div
        className="relative"
        style={{ originX: 0.5, originY: 1 }}
        initial={reduce ? { opacity: 0 } : { y: 28, opacity: 0, rotate: -1.2 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        transition={{ y: { type: 'spring', duration: 0.55, bounce: 0.14, delay: 0.08 }, rotate: { type: 'spring', duration: 0.6, bounce: 0.3, delay: 0.08 }, opacity: { duration: 0.16, delay: 0.08 } }}
        data-testid={testId}
      >
        {/* where it rests: a soft shadow, a little to the right and below (light from the top-left) */}
        <div aria-hidden className="pointer-events-none absolute -inset-x-[4px] -bottom-[14px] top-[2px]" style={{ backgroundImage: SHEET_SHADOW, backgroundSize: '100% 100%', transform: 'translate(4px, 2px)' }} />
        <div aria-hidden className="pointer-events-none absolute inset-x-[10%] bottom-[-5px] h-[12px]" style={{ background: `radial-gradient(closest-side, ${P.shadow}, transparent)` }} />
        {/* its own layer: writing repaints only the sheet, never the blurred shadow and the desk under it */}
        <div ref={paper} className="group relative" style={{ ...PAPER_STYLE, minHeight: PAD_TOP + minLines * RULE + PAD_BOTTOM, willChange: 'transform' }}>
          {/* while it's being written the text is its own layer, so uncovering a line never repaints the paper's fibres */}
          <motion.div ref={content} style={writing && !reduce ? { clipPath: clip, willChange: 'transform' } : undefined}>
            {children}
          </motion.div>
          {writing && !reduce && landed && <motion.span ref={caret} aria-hidden className="pointer-events-none absolute left-0 top-0 h-[16px] w-[1.5px] rounded-full" style={{ x: caretX, y: caretY, background: P.ink2, willChange: 'transform' }} />}
          {/* the signature: drawn once, then stays on the paper */}
          <div ref={sig} aria-hidden className="pointer-events-none absolute left-0 top-0" style={{ visibility: 'hidden', willChange: 'transform' }}>
            <svg viewBox="0 0 120 32" className="block h-auto w-full overflow-visible">
              <motion.path ref={sigPath} d={SIGNATURE} fill="none" stroke={P.ink} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ pathLength: signed ? 1 : ink, opacity: signed ? 1 : inkOn }} />
            </svg>
          </div>
          {/* the folded corner: the flap catches less light than the sheet, with a soft shadow under its edge */}
          <span aria-hidden className="pointer-events-none absolute right-0 top-0" style={{ width: FOLD + 4, height: FOLD + 4 }}>
            <span className="absolute right-0 top-0 block" style={{ width: FOLD + 3, height: FOLD + 3, background: `linear-gradient(45deg, ${P.shadowSoft}, transparent 60%)`, clipPath: 'polygon(0 0, 100% 100%, 0 100%)', transform: 'translate(-1px, 1px)' }} />
            <span className="absolute right-0 top-0 block" style={{ width: FOLD, height: FOLD, background: `linear-gradient(45deg, ${P.paperShade} 20%, ${P.paper})`, clipPath: 'polygon(0 0, 100% 100%, 0 100%)' }} />
          </span>
          {/* keyboard focus inside (the letter is editable) */}
          <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[4px] border-2 border-pine opacity-0 group-focus-within:opacity-100" />
        </div>
      </motion.div>
      {/* the pen in the hand: picked up from the desk to sign (it travels over the paper's edge, so it lives on the desk) */}
      <div ref={pen} aria-hidden className="pointer-events-none absolute left-0 top-0 z-10" style={{ opacity: 0, willChange: 'transform' }}>
        {stage === 'sign' && <Pen size={40} />}
      </div>
    </motion.div>
  );
}
