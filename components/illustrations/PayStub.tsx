'use client';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { P } from '@/lib/illustrationPalette';
import { spring } from '@/lib/motion';

/** One sweep of the scan beam, top to bottom. Callers wait for whole sweeps before showing what was read. */
export const SCAN_MS = 800;
/** The amount's flight into its field: a short lift off the paper, then the travel. */
export const FLY_MS = 620;

const VB = { w: 88, h: 100 };
/** Where the amount sits on the stub (viewBox units). */
const BOX = { x: 26, y: 73, w: 56, h: 19 };
const PAPER = 'M3 3H70L85 18V97H3Z';

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
/** The scan beam: a honey-light band with a bright leading edge (it travels downward). */
const BEAM = `linear-gradient(to bottom, ${rgba(P.glow, 0)} 0%, ${rgba(P.glow, 0.35)} 45%, ${rgba(P.honeyLight, 0.75)} 82%, ${rgba(P.honey, 0.95)} 90%, ${rgba(P.glow, 0.5)} 94%, ${rgba(P.glow, 0)} 100%)`;

type Target = string | { id: string; inset?: number };
type Flight = { text: string; from: { left: number; top: number; width: number; height: number }; x: number; y: number; s: number; font: number };

/**
 * A pay stub on the desk: paper with a faint fibre texture, a folded top-right corner, a soft shadow, a pine
 * employer band, printed rows as rounded bars and the gross-pay box.
 *
 * - `scanning`: the paper lifts a little and a honey-light scan beam passes top to bottom (WAAPI transform,
 *   on the compositor), once per SCAN_MS, until it stops.
 * - `amount`: shown in the gross-pay box once scanning stops.
 * - `flyTo` (an element id, or { id, inset } where inset is the px from the target's left edge where the text
 *   should land): the amount lifts off the paper and flies along an arc into that field, growing to the
 *   field's font size; `onLanded` fires when it arrives (immediately with reduced motion, or when the field
 *   is off screen). Without `flyTo`, `onLanded` fires once the amount has settled on the paper.
 *
 * Self-contained: the landing page and the intake both use it.
 */
export function PayStub({
  amount,
  scanning = false,
  flyTo,
  onLanded,
  width = 88,
  className = '',
}: {
  amount?: string;
  scanning?: boolean;
  flyTo?: Target;
  onLanded?: () => void;
  width?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const k = width / VB.w;
  const height = VB.h * k;
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const beam = useRef<HTMLDivElement>(null);
  const amountRef = useRef<HTMLSpanElement>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const shown = !!amount && !scanning;
  const landed = useRef(onLanded);
  useLayoutEffect(() => {
    landed.current = onLanded;
  });

  // the beam sweeps while scanning (whole sweeps; the caller decides when to stop)
  useEffect(() => {
    const el = beam.current;
    if (!scanning || reduce || !el || typeof el.animate !== 'function') return;
    const band = el.offsetHeight;
    const a = el.animate(
      [
        { transform: `translateY(${-band}px)`, opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { opacity: 1, offset: 0.9 },
        { transform: `translateY(${height}px)`, opacity: 0 },
      ],
      { duration: SCAN_MS, iterations: Infinity, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' },
    );
    return () => a.cancel();
  }, [scanning, reduce, height]);

  // once read: fly the amount into its field (or just let it settle on the paper)
  const targetId = typeof flyTo === 'string' ? flyTo : flyTo?.id;
  const inset = typeof flyTo === 'object' ? flyTo.inset : undefined;
  useEffect(() => {
    if (!shown) return;
    if (!targetId) {
      const t = setTimeout(() => landed.current?.(), reduce ? 0 : 260);
      return () => clearTimeout(t);
    }
    // the amount shows on the paper for a beat (and the paper settles) before it lifts off
    const t = setTimeout(
      () => {
        const span = amountRef.current;
        const target = document.getElementById(targetId);
        const box = span?.getBoundingClientRect();
        const r = target?.getBoundingClientRect();
        if (reduce || !span || !target || !box || !r || box.width === 0 || r.top < 0 || r.bottom > window.innerHeight) {
          landed.current?.();
          return;
        }
        // the paper is turned 2.5°: start from the box's own size around its centre (the flight turns it upright)
        const w = BOX.w * k;
        const h = BOX.h * k;
        const from = { left: box.left + box.width / 2 - w / 2, top: box.top + box.height / 2 - h / 2, width: w, height: h };
        // where the text sits inside the box, so the copy's text lands exactly on the field's text
        const range = document.createRange();
        range.selectNodeContents(span);
        const txtW = range.getBoundingClientRect().width;
        const cs = getComputedStyle(target);
        const font = parseFloat(cs.fontSize) || 16;
        const s = font / (13 * k);
        const a = (w - txtW) / 2;
        const b = h / 2;
        const left = inset ?? (parseFloat(cs.paddingLeft) || 0);
        setFlight({ text: amount!, from, x: r.left + left - from.left - s * a, y: r.top + r.height / 2 - from.top - s * b, s, font: 13 * k });
      },
      reduce ? 0 : 280,
    );
    return () => clearTimeout(t);
    // a new flight for each new amount or target
  }, [shown, amount, targetId, inset, reduce, k]);

  const land = () => {
    setFlight(null);
    landed.current?.();
  };

  const box = { left: BOX.x * k, top: BOX.y * k, width: BOX.w * k, height: BOX.h * k };
  return (
    <div className={`pointer-events-none relative shrink-0 ${className}`} style={{ width, height }} aria-hidden data-testid="pay-stub">
      <motion.div className="absolute inset-0" style={{ rotate: -2.5 }} initial={false} animate={{ scale: scanning ? 1.03 : shown ? 1 : 0.97, y: scanning ? -2 : 0 }} transition={spring.smooth}>
        <svg width={width} height={height} viewBox={`0 0 ${VB.w} ${VB.h}`} className="absolute inset-0 overflow-visible">
          <defs>
            <filter id={`${uid}-blur`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.2" />
            </filter>
            <linearGradient id={`${uid}-paper`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={P.trim} />
              <stop offset="0.5" stopColor={P.paper} />
              <stop offset="1" stopColor={P.paperShade} />
            </linearGradient>
            <linearGradient id={`${uid}-band`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={P.pineLight} />
              <stop offset="1" stopColor={P.pine} />
            </linearGradient>
            <linearGradient id={`${uid}-fold`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={P.paper} />
              <stop offset="1" stopColor={P.paperShade} />
            </linearGradient>
            {/* paper fibre: a few short strands, repeated */}
            <pattern id={`${uid}-fib`} width="9" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
              <path d="M1 2.1l2.4 0.5M5.2 5.4l1.7-0.4M6.6 1.2l1.2 0.3M2.3 5.8h0.8" stroke={P.paperShade} strokeWidth="0.45" strokeLinecap="round" opacity="0.7" />
            </pattern>
          </defs>
          {/* soft shadow: light from the top-left, so it falls down and to the right */}
          <path d={PAPER} transform="translate(2.4 3)" fill={P.ink} opacity={0.16} filter={`url(#${uid}-blur)`} />
          <path d={PAPER} fill={`url(#${uid}-paper)`} />
          <path d={PAPER} fill={`url(#${uid}-fib)`} />
          {/* employer band: logo and name */}
          <path d="M3 3H70L85 18V20H3Z" fill={`url(#${uid}-band)`} />
          <circle cx={11.5} cy={11.5} r={4.4} fill={P.pineLighter} />
          <path d="M9.4 13.2l2.1-3.6 2.1 3.6Z" fill={P.trim} opacity={0.9} />
          <rect x={19.5} y={8} width={27} height={3} rx={1.5} fill={P.trim} opacity={0.92} />
          <rect x={19.5} y={13.4} width={18} height={2.2} rx={1.1} fill={P.trim} opacity={0.5} />
          {/* printed rows */}
          <rect x={8} y={26.5} width={30} height={3.2} rx={1.6} fill={P.ink2} opacity={0.55} />
          <path d="M8 35H80" stroke={P.paperShade} strokeWidth={1.4} strokeDasharray="0.1 3" strokeLinecap="round" />
          {[
            [41, 20, 18],
            [49, 15, 14],
            [57, 24, 20],
          ].map(([y, l, v]) => (
            <g key={y}>
              <rect x={8} y={y} width={l} height={3} rx={1.5} fill={P.ink2} opacity={0.3} />
              <rect x={80 - v} y={y} width={v} height={3} rx={1.5} fill={P.ink} opacity={0.4} />
            </g>
          ))}
          <path d="M8 65.5H80" stroke={P.paperShade} strokeWidth={1} />
          {/* gross pay: a label and the amount box, printed slightly inset */}
          <rect x={8} y={81} width={13} height={3} rx={1.5} fill={P.ink2} opacity={0.5} />
          <rect x={BOX.x} y={BOX.y} width={BOX.w} height={BOX.h} rx={3} fill={P.pineSoft} />
          <rect x={BOX.x} y={BOX.y} width={BOX.w} height={2} rx={1} fill={P.pine} opacity={0.14} />
          <rect x={BOX.x + 2} y={BOX.y + BOX.h - 1} width={BOX.w - 4} height={0.8} rx={0.4} fill={P.trim} opacity={0.8} />
          <motion.rect x={BOX.x + 16} y={BOX.y + 8} width={24} height={3} rx={1.5} fill={P.pine} initial={false} animate={{ opacity: shown ? 0 : 0.18 }} transition={{ duration: 0.15 }} />
          {/* the folded corner: the paper's back, with a crease shadow along the fold */}
          <path d="M70 3L85 18H72.5Q70 18 70 15.5Z" fill={P.ink} opacity={0.12} transform="translate(-1 1.2)" />
          <path d="M70 3L85 18H72.5Q70 18 70 15.5Z" fill={`url(#${uid}-fold)`} />
        </svg>
        {/* the scan beam, clipped to the paper */}
        <div className="absolute overflow-hidden" style={{ left: 3 * k, top: 3 * k, width: 82 * k, height: 94 * k, clipPath: `polygon(0 0, ${67 * k}px 0, 100% ${15 * k}px, 100% 100%, 0 100%)` }}>
          <div ref={beam} className="absolute inset-x-0 top-0" style={{ height: 26 * k, background: BEAM, opacity: 0 }} />
        </div>
        <span
          ref={amountRef}
          className="tnum absolute flex items-center justify-center text-ink"
          style={{ ...box, fontSize: 13 * k, lineHeight: `${15 * k}px`, opacity: shown && !flight ? 1 : 0, transition: shown && !flight ? 'opacity 160ms ease' : 'none' }}
        >
          {amount}
        </span>
      </motion.div>
      {flight && createPortal(<FlyingAmount key={`${flight.text}${flight.from.top}`} {...flight} onLand={land} />, document.body)}
    </div>
  );
}

/** Ease-in-out for the travel (a smootherstep: no snap at either end). */
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/**
 * The amount, copied off the paper, flying into the field. It lifts (rises 5px, grows 8%, its shadow
 * appears), then travels along an arc that rises a little above the field and comes down onto it, ending
 * with its text exactly over the field's text at the field's size. Precomputed WAAPI keyframes (linear
 * between samples), so the flight runs on the compositor even while React renders the landing.
 */
function FlyingAmount({ text, from, x, y, s, font, onLand }: Flight & { onLand: () => void }) {
  const el = useRef<HTMLSpanElement>(null);
  const shadow = useRef<HTMLSpanElement>(null);
  const chip = useRef<HTMLSpanElement>(null);
  const done = useRef(onLand);
  done.current = onLand;
  useLayoutEffect(() => {
    const node = el.current;
    if (!node || typeof node.animate !== 'function') {
      done.current();
      return;
    }
    const LIFT = 0.2; // share of the time spent lifting off the paper
    const frames: Keyframe[] = [];
    const N = 28;
    const lift = { x: 0, y: -5, s: 1.08 };
    // the arc: a quadratic curve from the lifted spot to the field, its control point above the field
    const c = { x: lift.x + (x - lift.x) * 0.3, y: Math.min(lift.y, y) - 28 };
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      let px: number, py: number, sc: number;
      let rot = 0; // the paper is turned 2.5°; the amount straightens as it lifts
      if (t <= LIFT) {
        const u = 1 - Math.pow(1 - t / LIFT, 3);
        px = lift.x * u;
        py = lift.y * u;
        sc = 1 + (lift.s - 1) * u;
        rot = -2.5 * (1 - u);
      } else {
        const u = smooth((t - LIFT) / (1 - LIFT));
        const m = 1 - u;
        px = m * m * lift.x + 2 * m * u * c.x + u * u * x;
        py = m * m * lift.y + 2 * m * u * c.y + u * u * y;
        sc = lift.s + (s - lift.s) * u;
      }
      frames.push({ transform: `translate(${px.toFixed(2)}px, ${py.toFixed(2)}px) scale(${sc.toFixed(4)}) rotate(${rot.toFixed(2)}deg)`, offset: t });
    }
    const a = node.animate(frames, { duration: FLY_MS, easing: 'linear', fill: 'forwards' });
    const b = shadow.current?.animate([{ opacity: 0 }, { opacity: 0.9, offset: LIFT }, { opacity: 0.5, offset: 0.7 }, { opacity: 0 }], { duration: FLY_MS, fill: 'forwards' });
    const d = chip.current?.animate([{ opacity: 1 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: FLY_MS, fill: 'forwards' });
    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      done.current();
    };
    a.finished.then(fire, () => {});
    const backstop = setTimeout(fire, FLY_MS + 400);
    return () => {
      clearTimeout(backstop);
      a.cancel();
      b?.cancel();
      d?.cancel();
    };
  }, [x, y, s]);
  return (
    <span
      ref={el}
      aria-hidden
      className="pointer-events-none fixed z-50 flex items-center justify-center"
      style={{ left: from.left, top: from.top, width: from.width, height: from.height, transformOrigin: '0 0', willChange: 'transform' }}
    >
      <span ref={shadow} className="absolute inset-x-1 -bottom-1 h-2 rounded-full" style={{ background: rgba(P.ink, 0.22), filter: 'blur(3px)', opacity: 0 }} />
      <span ref={chip} className="absolute inset-0 rounded-[3px]" style={{ background: P.pineSoft }} />
      <span className="tnum relative text-ink" style={{ fontSize: font, lineHeight: `${(15 * font) / 13}px` }}>
        {text}
      </span>
    </span>
  );
}
