'use client';
import { startTransition, useEffect, useState, type RefObject } from 'react';
import { P, mix } from '@/lib/illustrationPalette';

const BARK_SHADE = mix(P.bark, P.ink, 0.25);

/**
 * Shared pieces for the landing scene illustrations: a seeded random, an on-screen hook (ambient loops run
 * only while their scene is visible), shaded trees and soft cloud puffs. Light comes from the top-left: every
 * rounded form carries a radial gradient whose bright spot sits up and to the left, and shadows fall right.
 * Soft shadows are radial-gradient ellipses (no blur filters, so they cost nothing to repaint).
 */

/** A palette colour at some opacity (for gradients that fade a palette colour to nothing). */
export function alpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Deterministic pseudo-random (same on server and client). */
export function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export type Pt = { x: number; y: number };
export type Cubic = [Pt, Pt, Pt, Pt];

/** A path made of cubic segments, sampled into an arc-length table (no DOM: works on the server too). */
export function arcPath(segs: Cubic[], per = 80) {
  const pts: Pt[] = [];
  segs.forEach(([a, b, c, d], k) => {
    for (let i = k === 0 ? 0 : 1; i <= per; i++) {
      const t = i / per;
      const u = 1 - t;
      pts.push({ x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x, y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y });
    }
  });
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = cum[cum.length - 1];
  /** Point and unit tangent at a fraction (0–1) of the arc length. */
  const at = (f: number) => {
    const L = Math.max(0, Math.min(1, f)) * total;
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (cum[m] < L) lo = m;
      else hi = m;
    }
    const seg = cum[hi] - cum[lo] || 1;
    const k = (L - cum[lo]) / seg;
    const p = pts[lo];
    const q = pts[hi];
    const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k, tx: (q.x - p.x) / len, ty: (q.y - p.y) / len };
  };
  return { at, total, d: `M${segs[0][0].x} ${segs[0][0].y}` + segs.map(([, b, c, d]) => `C${b.x} ${b.y} ${c.x} ${c.y} ${d.x} ${d.y}`).join('') };
}

/** Inverse of a cubic-bezier easing: the time (0–1) at which the eased progress reaches `p`. */
export function easeInverse(x1: number, y1: number, x2: number, y2: number, p: number) {
  const bez = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  // progress y for a given time x: solve x(s) = time, then y(s); invert by bisection on the time
  const yAtTime = (time: number) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2;
      if (bez(m, x1, x2) < time) lo = m;
      else hi = m;
    }
    return bez((lo + hi) / 2, y1, y2);
  };
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    if (yAtTime(m) < p) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/**
 * Mounts a scene in stages, one more each animation frame, each as a transition (React may slice the work),
 * so no single frame carries the whole illustration. Returns how many stages are mounted (1…count).
 */
export function useStaged(count: number) {
  const [n, setN] = useState(1);
  useEffect(() => {
    if (n >= count) return;
    const id = requestAnimationFrame(() => startTransition(() => setN((v) => Math.min(count, v + 1))));
    return () => cancelAnimationFrame(id);
  }, [n, count]);
  return n;
}

/** True while the element is at least partly on screen. */
export function useOnScreen(ref: RefObject<Element | null>) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return on;
}

/** Gradients shared by the trees, shadows and clouds in one <svg> (ids are suffixed so several scenes can coexist). */
export function KitDefs({ id }: { id: string }) {
  return (
    <>
      <radialGradient id={`${id}-crown`} cx="0.34" cy="0.3" r="0.78">
        <stop offset="0" stopColor={P.pineLighter} />
        <stop offset="0.38" stopColor={P.treeLight} />
        <stop offset="0.78" stopColor={P.tree} />
        <stop offset="1" stopColor={P.treeDark} />
      </radialGradient>
      <radialGradient id={`${id}-crownFar`} cx="0.34" cy="0.3" r="0.8">
        <stop offset="0" stopColor={P.sageLight} />
        <stop offset="0.6" stopColor={P.sage} />
        <stop offset="1" stopColor={P.sageDark} />
      </radialGradient>
      <radialGradient id={`${id}-shadow`}>
        <stop offset="0" stopColor={P.ink} stopOpacity="0.2" />
        <stop offset="0.55" stopColor={P.ink} stopOpacity="0.1" />
        <stop offset="1" stopColor={P.ink} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-trunk`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={P.bark} />
        <stop offset="0.5" stopColor={P.bark} />
        <stop offset="0.5" stopColor={BARK_SHADE} />
        <stop offset="1" stopColor={BARK_SHADE} />
      </linearGradient>
      <radialGradient id={`${id}-cloud`} cx="0.35" cy="0.25" r="0.85">
        <stop offset="0" stopColor={P.trim} />
        <stop offset="0.7" stopColor={P.trim} />
        <stop offset="1" stopColor={P.skyTop} />
      </radialGradient>
    </>
  );
}

/** A soft contact shadow (radial gradient ellipse). */
export function Shade({ id, cx, cy, rx, ry, opacity = 1 }: { id: string; cx: number; cy: number; rx: number; ry: number; opacity?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${id}-shadow)`} opacity={opacity} />;
}

/**
 * A rounded tree: trunk, a crown of overlapping lit spheres, a contact shadow falling right.
 * Origin at the trunk base; `s` scales it; `far` uses the pale sage crown for distant trees.
 */
export function Tree({ id, x, y, s = 1, kind = 'round', far = false, shadow = true }: { id: string; x: number; y: number; s?: number; kind?: 'round' | 'tall' | 'cluster'; far?: boolean; shadow?: boolean }) {
  const crown = `url(#${id}-${far ? 'crownFar' : 'crown'})`;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {shadow && <Shade id={id} cx={9} cy={0} rx={22} ry={5} />}
      <rect x={-2.2} y={-16} width={4.4} height={16.5} rx={1.6} fill={`url(#${id}-trunk)`} />
      {kind === 'tall' ? (
        <>
          <ellipse cx={0} cy={-36} rx={12.5} ry={24} fill={crown} />
          <ellipse cx={-3} cy={-44} rx={7.5} ry={12} fill={crown} opacity={0.9} />
        </>
      ) : kind === 'cluster' ? (
        <>
          <circle cx={7} cy={-24} r={12} fill={crown} />
          <circle cx={-8} cy={-25} r={12.5} fill={crown} />
          <circle cx={0} cy={-36} r={13.5} fill={crown} />
        </>
      ) : (
        <>
          <circle cx={0} cy={-31} r={18} fill={crown} />
          <circle cx={-6} cy={-38} r={10} fill={crown} opacity={0.95} />
        </>
      )}
    </g>
  );
}

/** A cloud: three lit puffs on a flat base. Origin at the base centre. */
export function Cloud({ id, x, y, s = 1 }: { id: string; x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={-6} rx={34} ry={7} fill={`url(#${id}-cloud)`} />
      <circle cx={-14} cy={-12} r={11} fill={`url(#${id}-cloud)`} />
      <circle cx={4} cy={-17} r={15} fill={`url(#${id}-cloud)`} />
      <circle cx={20} cy={-10} r={9} fill={`url(#${id}-cloud)`} />
    </g>
  );
}
