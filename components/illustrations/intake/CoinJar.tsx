'use client';
import { useReducedMotion } from 'motion/react';
import { memo, useLayoutEffect, useRef } from 'react';
import { P } from '@/lib/illustrationPalette';
import { COIN, Coin, CoinDefs, Jar, JarDefs, ShadowDef, useSvgId } from './shared';

/** One coin per $400 a month (any income shows at least one), at most 24: two columns of 12. */
export const coinsFor = (monthly: number) => (monthly > 0 ? Math.min(24, Math.max(1, Math.round(monthly / 400))) : 0);
/** Folded bills standing at the back: one from $2,000 a month, two from $4,500, three from $7,500. */
export const billsFor = (monthly: number) => (monthly >= 7500 ? 3 : monthly >= 4500 ? 2 : monthly >= 2000 ? 1 : 0);

const FLOOR_FACE = -7.6; // face centre of a coin resting on the jar's floor
const COL = [-7.2, 7.2];
const JIT = [0, 0.9, -0.7, 0.5, 1.1, -0.4, 0.3, -1, 0.8, -0.6, 0.2, 1];
const BILL = [
  { x: -6, r: -9 },
  { x: 5.5, r: 8 },
  { x: -0.5, r: -1.5 },
];
const SCALE = 1.12;
const SVG_W = 56;
const SVG_H = 80;
const BASE = 75; // jar bottom inside the SVG
const DROP_MS = 460;
const ease = (e: readonly number[]) => `cubic-bezier(${e.join(',')})`;
const GRAVITY = ease([0.55, 0, 0.9, 0.45]); // accelerating, like a fall
const REBOUND = ease([0.2, 0.6, 0.4, 1]);

/** Where coin i rests: alternating columns, each a little off true. */
const restOf = (i: number) => ({ x: COL[i % 2] + JIT[Math.floor(i / 2) % JIT.length] * 0.8, y: FLOOR_FACE - Math.floor(i / 2) * COIN.t });

/** Remember the last value of `present` and run `go(was)` before paint when it flips (not on mount). */
function useFlip(present: boolean, go: (now: boolean) => void) {
  const was = useRef(present);
  const fn = useRef(go);
  fn.current = go;
  useLayoutEffect(() => {
    if (was.current === present) return;
    was.current = present;
    fn.current(present);
  }, [present]);
}

/**
 * One coin slot, always mounted (a tap or a keystroke only flips `present`, so it never builds DOM). Added:
 * it drops in through the neck, falls with gravity onto its column, squashes flat for a moment on contact
 * (scaleY/scaleX from its bottom), hops and settles. Removed: it lifts out and fades. Web Animations API,
 * transforms and opacity only; the inline style is the final state.
 */
export const JarCoin = memo(function JarCoin({ i, present, delay, id }: { i: number; present: boolean; delay: number; id: string }) {
  const reduce = useReducedMotion();
  const dropRef = useRef<SVGGElement>(null);
  const squash = useRef<SVGGElement>(null);
  const r = restOf(i);
  useFlip(present, (now) => {
    const d = dropRef.current;
    const s = squash.current;
    if (reduce || !d || !s || typeof d.animate !== 'function') return;
    d.getAnimations().forEach((a) => a.cancel());
    s.getAnimations().forEach((a) => a.cancel());
    if (!now) {
      d.animate([{ transform: 'translate(0px, 0px)', opacity: 1 }, { transform: 'translate(0px, -10px)', opacity: 0 }], { duration: 160, easing: REBOUND });
      return;
    }
    const fall = -64 - r.y; // starts above the neck, over its middle
    d.animate(
      [
        { transform: `translate(${(-r.x * 0.85).toFixed(2)}px, ${fall.toFixed(2)}px)`, opacity: 0, easing: GRAVITY },
        { opacity: 1, offset: 0.1, easing: GRAVITY },
        { transform: 'translate(0px, 0px)', opacity: 1, offset: 0.6, easing: REBOUND },
        { transform: 'translate(0px, -2.4px)', offset: 0.8, easing: GRAVITY },
        { transform: 'translate(0px, 0px)', opacity: 1 },
      ],
      { duration: DROP_MS, delay, fill: 'backwards' },
    );
    s.style.transformBox = 'fill-box';
    s.style.transformOrigin = '50% 100%';
    s.animate(
      [
        { transform: 'scale(1, 1)' },
        { transform: 'scale(1, 1)', offset: 0.57 },
        { transform: 'scale(1.18, 0.68)', offset: 0.65 },
        { transform: 'scale(0.96, 1.08)', offset: 0.82 },
        { transform: 'scale(1, 1)' },
      ],
      { duration: DROP_MS, delay, easing: 'ease-out' },
    );
  });
  return (
    <g transform={`translate(${r.x} ${r.y})`}>
      <g ref={dropRef} style={{ opacity: present ? 1 : 0 }}>
        <g ref={squash}>
          <Coin id={id} />
        </g>
      </g>
    </g>
  );
});

/** A folded bill standing at the back of the jar; slides down into place with a little bounce. */
const Bill = memo(function Bill({ k, present, id }: { k: number; present: boolean; id: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<SVGGElement>(null);
  const b = BILL[k];
  useFlip(present, (now) => {
    const el = ref.current;
    if (reduce || !el || typeof el.animate !== 'function') return;
    el.getAnimations().forEach((a) => a.cancel());
    el.animate(
      now
        ? [{ transform: 'translateY(-46px)', opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: 'translateY(2px)', offset: 0.7 }, { transform: 'translateY(0px)', opacity: 1 }]
        : [{ transform: 'translateY(0px)', opacity: 1 }, { transform: 'translateY(-12px)', opacity: 0 }],
      { duration: now ? 520 : 160, easing: now ? 'cubic-bezier(0.3, 0.7, 0.4, 1)' : REBOUND },
    );
  });
  return (
    <g ref={ref} style={{ opacity: present ? 1 : 0 }}>
      <g transform={`translate(${b.x} -4) rotate(${b.r})`}>
        <rect x={-7} y={-25} width={14} height={25} rx={1.2} fill={`url(#${id}-bill)`} />
        <rect x={0} y={-25} width={7} height={25} rx={1.2} fill={P.pine} opacity={0.22} />
        <ellipse cx={0} cy={-15} rx={3.4} ry={4.6} fill={P.sageLight} opacity={0.55} />
        <rect x={-5.5} y={-23.5} width={3} height={1.6} rx={0.6} fill={P.sageLight} opacity={0.8} />
        <rect x={2.5} y={-3.6} width={3} height={1.6} rx={0.6} fill={P.sageLight} opacity={0.8} />
      </g>
    </g>
  );
});

/** Coins for a count: new ones drop 40ms apart (counted from the previous count). */
export function JarCoins({ n, max, id }: { n: number; max: number; id: string }) {
  const prev = useRef(n);
  const from = prev.current;
  useLayoutEffect(() => {
    prev.current = n;
  }, [n]);
  return (
    <>
      {Array.from({ length: max }, (_, i) => (
        <JarCoin key={i} i={i} id={id} present={i < n} delay={Math.max(0, i - from) * 40} />
      ))}
    </>
  );
}

/**
 * Step 2: a glass jar beside the income field that fills as income rises: honey coins stack in two columns
 * and folded bills stand at the back. Sits in a 56×48 slot and draws upward into the label row. Decorative.
 */
export const CoinJar = memo(function CoinJar({ monthly, className = '' }: { monthly: number; className?: string }) {
  const id = useSvgId();
  const n = coinsFor(monthly);
  const bills = billsFor(monthly);
  return (
    <div className={`pointer-events-none relative h-[48px] shrink-0 ${className}`} style={{ width: SVG_W }} aria-hidden data-testid="coin-jar">
      <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="absolute bottom-[-4px] left-0 overflow-visible">
        <defs>
          <ShadowDef id={id} />
          <JarDefs id={id} />
          <CoinDefs id={id} />
          <linearGradient id={`${id}-bill`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={P.pineLighter} />
            <stop offset="1" stopColor={P.pineLight} />
          </linearGradient>
        </defs>
        <g transform={`translate(${SVG_W / 2} ${BASE}) scale(${SCALE})`}>
          <Jar id={id}>
            {[0, 1, 2].map((k) => (
              <Bill key={k} k={k} id={id} present={k < bills} />
            ))}
            <JarCoins n={n} max={24} id={id} />
          </Jar>
        </g>
      </svg>
    </div>
  );
});
