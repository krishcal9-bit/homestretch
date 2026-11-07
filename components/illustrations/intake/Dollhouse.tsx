'use client';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useLang } from '@/lib/i18n';
import { CLOTH, P, mix, type ClothKey } from '@/lib/illustrationPalette';
import { ease, exit } from '@/lib/motion';
import { Figure } from '@/components/illustrations/Figure';
import { Shadow, ShadowDef, look, useSvgId } from './shared';

/** Same rule as the engine: more than 2 people per bedroom (or more than 2 with no bedroom). */
export const isOvercrowded = (bedrooms: number, occupants: number) => (bedrooms > 0 ? occupants / bedrooms > 2 : occupants > 2);

/* House-local geometry: origin at the bottom-left of the ground floor slab, y up is negative. */
const PW = 70; // one room's pitch (interior + one wall)
const WT = 4; // wall thickness
const SLAB = 5;
const RIN = 47; // room interior height
const SH = SLAB + RIN; // one storey
const RIW = PW - WT; // room interior width
const EAVE = 10;
const ROOF_H = 30;
const VH = 156; // the view's height (fixed: rooms are added by zooming out, never by growing the page)
const GROUND = VH - 13;
const BLANKETS: ClothKey[] = ['sage', 'sky', 'pine', 'wall', 'honey'];

type Cell = { key: string; kind: 'bed' | 'studio' | 'stairs'; c: number; r: number; room: number };

/** Up to 4 rooms side by side; more go on two floors (the bottom fills first; an odd one leaves space for stairs). */
function layout(bedrooms: number): { cols: number; rows: number; cells: Cell[] } {
  if (bedrooms <= 0) return { cols: 1, rows: 1, cells: [{ key: 'studio', kind: 'studio', c: 0, r: 0, room: 0 }] };
  const n = Math.min(8, bedrooms);
  if (n <= 4) return { cols: n, rows: 1, cells: Array.from({ length: n }, (_, i) => ({ key: `b${i}`, kind: 'bed' as const, c: i, r: 0, room: i })) };
  const cols = Math.ceil(n / 2);
  const cells: Cell[] = Array.from({ length: n }, (_, i) => ({ key: `b${i}`, kind: 'bed' as const, c: i < cols ? i : i - cols, r: i < cols ? 0 : 1, room: i }));
  if (n % 2) cells.push({ key: 'stairs', kind: 'stairs', c: cols - 1, r: 1, room: -1 });
  return { cols, rows: 2, cells };
}

/** Where people stand in a room: up to two with room to spare; more squeeze together, then stand two deep. */
function spots(k: number) {
  if (k <= 2) return Array.from({ length: k }, (_, j) => ({ x: (j - (k - 1) / 2) * 17, y: 0, s: 1, back: false }));
  const backN = k > 5 ? Math.floor(k / 2) : 0;
  const frontN = k - backN;
  const row = (count: number, y: number, s: number, back: boolean, span: number) =>
    Array.from({ length: count }, (_, j) => ({ x: (j - (count - 1) / 2) * Math.min(12, span / Math.max(1, count - 1)), y, s, back }));
  return [...row(backN, -4.5, 0.82, true, 40), ...row(frontN, 0, 0.92, false, 46)];
}

function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  // measured before the first paint, so the house never glides into place on mount
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.round(el.clientWidth) || fallback);
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, w] as const;
}

/**
 * Balanced counts per room (like the engine's per-bedroom share), moving as few people as possible from
 * `prev`: a new bedroom takes a few people from the others; a new person goes to the emptiest room.
 */
export function rebalance(prev: number[], rooms: number, occ: number): number[] {
  const base = Math.floor(occ / rooms);
  let extra = occ % rooms; // how many rooms may hold one more
  const counts = new Array<number>(rooms).fill(0);
  const out = new Array<number>(occ).fill(-1);
  for (let p = 0; p < occ; p++) {
    const r = prev[p];
    if (r === undefined || r < 0 || r >= rooms) continue;
    if (counts[r] < base) {
      out[p] = r;
      counts[r]++;
    } else if (counts[r] === base && extra > 0) {
      out[p] = r;
      counts[r]++;
      extra--;
    }
  }
  for (let p = 0; p < occ; p++) {
    if (out[p] >= 0) continue;
    let best = -1;
    for (let r = 0; r < rooms; r++) if (counts[r] < base && (best < 0 || counts[r] < counts[best])) best = r;
    if (best < 0)
      for (let r = 0; r < rooms; r++)
        if (counts[r] === base && extra > 0) {
          best = r;
          extra--;
          break;
        }
    out[p] = best;
    counts[best]++;
  }
  return out;
}

/** Interior box in one-point perspective: dark ceiling, shaded left wall, lit right wall, warm back wall, timber floor. */
function Interior({ id, x, top }: { id: string; x: number; top: number }) {
  const bot = top + RIN;
  const dx = 8;
  const dt = 6;
  const db = 7;
  return (
    <>
      <path d={`M${x} ${top}H${x + RIW}L${x + RIW - dx} ${top + dt}H${x + dx}Z`} fill={P.wallDeep} />
      <path d={`M${x} ${top}L${x + dx} ${top + dt}V${bot - db}L${x} ${bot}Z`} fill={`url(#${id}-lw)`} />
      <path d={`M${x + RIW} ${top}L${x + RIW - dx} ${top + dt}V${bot - db}L${x + RIW} ${bot}Z`} fill={`url(#${id}-rw)`} />
      <rect x={x + dx} y={top + dt} width={RIW - 2 * dx} height={RIN - dt - db} fill={`url(#${id}-bw)`} />
      {/* ambient occlusion under the ceiling */}
      <rect x={x + dx} y={top + dt} width={RIW - 2 * dx} height={4} fill={`url(#${id}-ao)`} />
      <path d={`M${x} ${bot}H${x + RIW}L${x + RIW - dx} ${bot - db}H${x + dx}Z`} fill={`url(#${id}-fl)`} />
      <path d={`M${x + 3} ${bot - 2.4}H${x + RIW - 3}M${x + 6} ${bot - 4.8}H${x + RIW - 6}`} stroke={P.timberShade} strokeWidth={0.6} opacity={0.7} />
    </>
  );
}

function Bed({ x, y, blanket }: { x: number; y: number; blanket: ClothKey }) {
  const [bl, bd] = CLOTH[blanket];
  // x: left end against the back wall; y: the floor line under it
  return (
    <g>
      <rect x={x} y={y - 15} width={3.4} height={15} rx={1} fill={P.bark} />
      <rect x={x + 2.2} y={y - 15} width={1.2} height={15} fill={P.ink} opacity={0.18} />
      <rect x={x + 3} y={y - 8} width={27} height={5} rx={1.2} fill={P.trim} />
      <rect x={x + 3} y={y - 4} width={27} height={1.6} fill={P.trimShade} />
      <rect x={x + 4} y={y - 11} width={8} height={4} rx={2} fill={P.trim} />
      <rect x={x + 4} y={y - 8.6} width={8} height={1.4} rx={0.7} fill={P.trimShade} />
      <path d={`M${x + 12} ${y - 8.6}Q${x + 20} ${y - 10} ${x + 30.6} ${y - 8.4}V${y - 2}H${x + 12}Z`} fill={bl} />
      <path d={`M${x + 22} ${y - 9.2}Q${x + 27} ${y - 9} ${x + 30.6} ${y - 8.4}V${y - 2}H${x + 22}Z`} fill={bd} opacity={0.8} />
      <rect x={x + 3.5} y={y - 2.4} width={1.6} height={2.4} fill={P.bark} />
      <rect x={x + 27.5} y={y - 2.4} width={1.6} height={2.4} fill={P.bark} />
    </g>
  );
}

function Window({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x - 1.4} y={y - 1.4} width={15.8} height={13.8} rx={0.8} fill={P.trim} />
      <rect x={x} y={y} width={13} height={11} fill="url(#dh-glass)" />
      <path d={`M${x + 2} ${y + 11}L${x + 7.5} ${y}h2.6L${x + 4.6} ${y + 11}Z`} fill={P.trim} opacity={0.35} />
      <path d={`M${x + 6.5} ${y}V${y + 11}M${x} ${y + 5.5}H${x + 13}`} stroke={P.trim} strokeWidth={1} />
      <rect x={x - 2.2} y={y + 11.6} width={17.4} height={1.6} fill={P.trimShade} />
    </g>
  );
}

/** The room's walls, interior and furniture: drawn once per room (a tap that changes only people skips it). */
const Furnishing = memo(function Furnishing({ id, kind, room }: { id: string; kind: Cell['kind']; room: number }) {
  const top = -(SLAB + RIN);
  const bot = -SLAB;
  const ix = WT;
  return (
    <>
      {/* the cut: floor slab and left wall, solid like a section drawing */}
      <rect x={0} y={-SLAB} width={PW + WT} height={SLAB} fill={P.wallDeep} />
      <rect x={0} y={-SLAB} width={PW + WT} height={1.2} fill={P.trim} opacity={0.5} />
      <rect x={0} y={top} width={WT} height={RIN} fill={P.wallShade} />
      <rect x={WT - 1.2} y={top} width={1.2} height={RIN} fill={P.wallDeep} />
      <Interior id={id} x={ix} top={top} />
      {kind === 'stairs' ? (
        <g>
          {Array.from({ length: 6 }, (_, s) => (
            <g key={s}>
              <rect x={ix + 10 + s * 8} y={bot - 7 - (s + 1) * 6.4} width={10} height={(s + 1) * 6.4} fill={s % 2 ? P.timberShade : P.timber} />
              <rect x={ix + 10 + s * 8} y={bot - 7 - (s + 1) * 6.4} width={10} height={1.4} fill={P.trim} opacity={0.5} />
            </g>
          ))}
          <path d={`M${ix + 12} ${bot - 22}L${ix + 60} ${bot - 52}`} stroke={P.bark} strokeWidth={1.6} strokeLinecap="round" />
        </g>
      ) : kind === 'studio' ? (
        <g>
          {/* sofa bed and a kitchenette */}
          <rect x={ix + 9} y={bot - 19} width={26} height={9} rx={2.4} fill={CLOTH.sky[1]} />
          <rect x={ix + 9} y={bot - 12} width={26} height={6} rx={1.6} fill={CLOTH.sky[0]} />
          <rect x={ix + 7} y={bot - 15} width={4} height={9} rx={1.6} fill={CLOTH.sky[1]} />
          <rect x={ix + 33} y={bot - 15} width={4} height={9} rx={1.6} fill={CLOTH.sky[1]} />
          <rect x={ix + 43} y={bot - 21} width={15} height={14} fill={P.slateLight} />
          <rect x={ix + 43} y={bot - 22.6} width={15} height={2.4} fill={P.stone} />
          <rect x={ix + 50.2} y={bot - 19} width={0.8} height={10} fill={P.slateDark} opacity={0.6} />
          <rect x={ix + 45} y={bot - 36} width={11} height={6} fill={P.slateLight} />
        </g>
      ) : (
        <g>
          <Window x={ix + 33} y={top + 12} />
          <Bed x={ix + 9} y={bot - 6} blanket={BLANKETS[room % BLANKETS.length]} />
        </g>
      )}
    </>
  );
});

/** Gradients shared by every room (rendered once). */
const Defs = memo(function Defs({ id }: { id: string }) {
  return (
    <defs>
      <ShadowDef id={id} />
      <linearGradient id={`${id}-lw`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={P.wallShade} />
        <stop offset="1" stopColor={P.wallDeep} />
      </linearGradient>
      <linearGradient id={`${id}-rw`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={mix(P.wall, P.honeyLight, 0.35)} />
        <stop offset="1" stopColor={P.wall} />
      </linearGradient>
      <linearGradient id={`${id}-bw`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={mix(P.wall, P.honeyLight, 0.45)} />
        <stop offset="0.55" stopColor={mix(P.wall, P.honeyLight, 0.15)} />
        <stop offset="1" stopColor={P.wallShade} />
      </linearGradient>
      <linearGradient id={`${id}-ao`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={P.ink} stopOpacity={0.12} />
        <stop offset="1" stopColor={P.ink} stopOpacity={0} />
      </linearGradient>
      <linearGradient id={`${id}-fl`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={mix(P.timber, P.trim, 0.25)} />
        <stop offset="1" stopColor={P.timber} />
      </linearGradient>
      <linearGradient id="dh-glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={P.skyTop} />
        <stop offset="1" stopColor={P.glassLight} />
      </linearGradient>
      <linearGradient id={`${id}-roof`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={P.slateLight} />
        <stop offset="0.5" stopColor={P.slateLight} />
        <stop offset="0.5" stopColor={P.slate} />
        <stop offset="1" stopColor={P.slateDark} />
      </linearGradient>
      <linearGradient id={`${id}-attic`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={P.wallDeep} />
        <stop offset="1" stopColor={P.wallShade} />
      </linearGradient>
    </defs>
  );
});

/* ---------- motion: compositor transforms with a spring-shaped easing ---------- */

/**
 * A damped spring (the step response of a mass on a spring) sampled into a CSS `linear()` easing, so a
 * Web Animation moves with weight (a slight overshoot and a settle) and still runs on the compositor.
 */
function springEase(zeta: number, samples = 36) {
  const w = 8.2; // natural frequency in "durations"; the spring has settled by t = 1
  const wd = w * Math.sqrt(1 - zeta * zeta);
  const pts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const y = i === samples ? 1 : 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
    pts.push(y.toFixed(4));
  }
  return `linear(${pts.join(', ')})`;
}
/** Physical things: a little overshoot, a damped settle. */
const SETTLE = { duration: 560, easing: springEase(0.72) };
/** A figure set down: a touch more bounce. */
const DROP = { duration: 480, easing: springEase(0.6) };
const OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** The element's current transform (mid-animation included); reading it forces a style recalc, so only when interrupted. */
const liveTransform = (el: HTMLElement, fallback: string) => (el.getAnimations().length ? getComputedStyle(el).transform : fallback);

/**
 * Move an element to a new transform with the spring easing (from wherever it is, if it was still moving).
 * The inline style already holds the target; the animation carries it there.
 */
function glide(el: HTMLElement | null, from: string, to: string, opts = SETTLE, reduce = false) {
  if (!el || reduce || from === to || typeof el.animate !== 'function') return;
  const start = liveTransform(el, from);
  el.getAnimations().forEach((a) => a.cancel());
  el.animate([{ transform: start }, { transform: to }], opts);
}

/** Runs `fn(prev)` before paint whenever `value` changes (not on mount). */
function useChange<T>(value: T, fn: (prev: T) => void) {
  const prev = useRef(value);
  const cb = useRef(fn);
  cb.current = fn;
  useLayoutEffect(() => {
    if (Object.is(prev.current, value)) return;
    const p = prev.current;
    prev.current = value;
    cb.current(p);
  }, [value]);
}

/* ---------- people ---------- */

/** A figure's box in house units: feet at (FX, FY) inside it. */
const FIG = { w: 26, h: 42, fx: 13, fy: 37 };
const figT = (x: number, y: number, s: number) => `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${s})`;

/**
 * A person in the dollhouse, always mounted (a tap only changes props, so it never builds DOM): a small HTML
 * layer with its own little SVG, so every move runs on the compositor. Placed in a room: lowered in from
 * above, like a hand placing a figure in a dollhouse. Moved to another room: lifted out and set down there.
 * Same room, new spot: slides over (squeezing in when the room gets crowded). Away: display none.
 */
const Occupant = memo(function Occupant({ p, present, x, y, s, room }: { p: number; present: boolean; x: number; y: number; s: number; room: number }) {
  const reduce = useReducedMotion();
  const el = useRef<HTMLDivElement>(null);
  const last = useRef({ present, room, x, y, s });
  const L = look(p);
  const figure = useMemo(
    () => (
      <svg width={FIG.w} height={FIG.h} viewBox={`${-FIG.fx} ${-FIG.fy} ${FIG.w} ${FIG.h}`} className="block overflow-visible">
        <g transform="scale(0.3)">
          <Figure kind={L.kind} skin={L.skin} hair={L.hair} hairStyle={L.hairStyle} top={L.top} bottom={L.bottom} build={L.build} />
        </g>
      </svg>
    ),
    [L],
  );
  const target = figT(x, y, s);
  useLayoutEffect(() => {
    if (!present && el.current) el.current.style.display = 'none';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => {
    const was = last.current;
    last.current = { present, room, x, y, s };
    const node = el.current;
    if (!node || (was.present === present && was.room === room && was.x === x && was.y === y && was.s === s)) return;
    const from = figT(was.x, was.y, was.s);
    if (present) node.style.display = '';
    if (reduce || typeof node.animate !== 'function') {
      if (!present) node.style.display = 'none';
      return;
    }
    const lower = (delay = 0) => {
      node.animate([{ transform: figT(x, y - 12, s), opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: target, opacity: 1 }], { ...DROP, delay, fill: 'backwards' });
    };
    if (!present) {
      const a = node.animate([{ transform: from, opacity: 1 }, { transform: figT(was.x, was.y - 6, was.s), opacity: 0 }], { duration: 120, easing: OUT });
      a.finished.then(() => {
        if (!last.current.present) node.style.display = 'none';
      }, () => {});
    } else if (!was.present) lower();
    else if (was.room !== room) {
      // lifted out of the old room, then set down in the new one
      node.animate([{ transform: from, opacity: 1 }, { transform: figT(was.x, was.y - 8, was.s), opacity: 0 }], { duration: 110, easing: OUT });
      lower(110);
    } else glide(node, from, target);
  }, [present, room, x, y, s, reduce, target]);
  return (
    <div
      ref={el}
      className="absolute"
      style={{ left: -FIG.fx, top: -FIG.fy, width: FIG.w, height: FIG.h, transformOrigin: `${FIG.fx}px ${FIG.fy}px`, transform: target, opacity: present ? 1 : 0 }}
    >
      {figure}
    </div>
  );
});

/* ---------- rooms ---------- */

const roomT = (c: number, r: number, away: boolean) => `translate(${c * PW + (away ? 30 : 0)}px, ${-r * SH}px)`;

/**
 * One room as a module, always mounted (a tap only changes its props): a small HTML layer holding the room's
 * SVG (floor slab, left wall, interior and furniture), drawn once. Added: it slides in from the right as it
 * fades in; removed: slides out and fades, then leaves the paint tree. Crowded: an amber tint fades over it.
 */
const Room = memo(function Room({ id, kind, room, c, r, present, crowded }: { id: string; kind: Cell['kind']; room: number; c: number; r: number; present: boolean; crowded: boolean }) {
  const reduce = useReducedMotion();
  const el = useRef<HTMLDivElement>(null);
  const tint = useRef<HTMLDivElement>(null);
  const to = roomT(c, r, !present);
  const pos = useRef(to);
  useLayoutEffect(() => {
    // absent at mount: out of the paint tree (later changes are handled with the animations)
    if (!present && el.current) el.current.style.display = 'none';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const floor = useRef(r);
  useLayoutEffect(() => {
    const node = el.current;
    const from = pos.current;
    const fromFloor = floor.current;
    pos.current = to;
    floor.current = r;
    if (!node || from === to) return;
    if (fromFloor !== r && present && !reduce && typeof node.animate === 'function') {
      // changing floors (one storey to two or back): fade out where it was, fade in where it goes, so rooms
      // never slide through each other
      node.getAnimations().forEach((a) => a.cancel());
      node.animate([{ transform: from, opacity: 1 }, { transform: from, opacity: 0 }], { duration: 120, easing: OUT });
      node.animate([{ transform: `${to} translateY(-8px)`, opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: to, opacity: 1 }], { ...DROP, delay: 120, fill: 'backwards' });
      return;
    }
    glide(node, from, to, SETTLE, !!reduce);
  }, [to, r, present, reduce]);
  useChange(present, () => {
    const node = el.current;
    if (!node) return;
    if (present) node.style.display = '';
    if (reduce || typeof node.animate !== 'function') {
      if (!present) node.style.display = 'none';
      return;
    }
    const a = node.animate([{ opacity: present ? 0 : 1 }, { opacity: present ? 1 : 0 }], { duration: present ? 200 : 160, easing: OUT });
    if (!present)
      a.finished.then(() => {
        if (el.current && el.current.style.opacity === '0') el.current.style.display = 'none';
      }, () => {});
  });
  useChange(crowded, () => {
    const node = tint.current;
    if (!node || reduce || typeof node.animate !== 'function') return;
    node.animate([{ opacity: crowded ? 0 : 1 }, { opacity: crowded ? 1 : 0 }], { duration: 240, easing: OUT });
  });
  const furnishing = useMemo(
    () => (
      <svg width={PW + WT} height={SH} viewBox={`0 ${-SH} ${PW + WT} ${SH}`} className="block overflow-visible">
        <Furnishing id={id} kind={kind} room={room} />
      </svg>
    ),
    [id, kind, room],
  );
  return (
    <div ref={el} className="absolute" style={{ left: 0, top: -SH, width: PW + WT, height: SH, transform: to, opacity: present ? 1 : 0 }}>
      {furnishing}
      {/* overcrowded: the room tints amber (amber-soft over the interior, a breath of amber) */}
      <div ref={tint} className="absolute" style={{ left: WT, top: 0, width: RIW, height: RIN, opacity: crowded ? 1 : 0 }}>
        <div className="absolute inset-0" style={{ background: P.amberSoft, opacity: 0.62 }} />
        <div className="absolute inset-0" style={{ background: P.amber, opacity: 0.14 }} />
      </div>
    </div>
  );
});

const BED_KEYS = [0, 1, 2, 3, 4, 5, 6, 7];
const PEOPLE = Array.from({ length: 16 }, (_, p) => p);

/* ---------- the shell and the camera ---------- */

/** How big the house can be drawn: fits the width and the fixed height, never above 1.55×. */
const fit = (w: number, hw: number, rows: number) => Math.min(1.55, (w - 8) / (hw + 2 * EAVE + 20), (VH - 22) / (rows * SH + SLAB + ROOF_H));

/** One shell piece: an HTML layer whose transform follows the house's size with the same spring. */
function Piece({ t, reduce, style, children }: { t: string; reduce: boolean | null; style: CSSProperties; children?: ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  useChange(t, (prev) => glide(el.current, prev, t, SETTLE, !!reduce));
  return (
    <div ref={el} className="absolute" style={{ ...style, transform: t }}>
      {children}
    </div>
  );
}

/** The roof cut (attic, then the roof slab showing its thickness: lit left pitch, shaded right pitch), 122 wide. */
const ROOF = (id: string) => (
  <svg width={122} height={ROOF_H + 2} viewBox={`-61 ${-ROOF_H} 122 ${ROOF_H + 2}`} className="block overflow-visible" preserveAspectRatio="none">
    <path d={`M-50 0L0 ${-ROOF_H + 7}L50 0Z`} fill={`url(#${id}-attic)`} />
    <path d={`M-60 0L0 ${-ROOF_H}L60 0H51L0 ${-ROOF_H + 6.5}L-51 0Z`} fill={`url(#${id}-roof)`} />
    <path d={`M-60 0L0 ${-ROOF_H}`} stroke={P.glassLight} strokeWidth={1.2} opacity={0.6} />
    <rect x={-61} y={-1.5} width={11} height={3} rx={1} fill={P.slateDark} />
    <rect x={50} y={-1.5} width={11} height={3} rx={1} fill={P.slateDark} />
  </svg>
);

/**
 * Step 3: the family's current home as a cutaway dollhouse. One room per bedroom (a studio when there are
 * none), side by side up to four, then on two floors with stairs. Each room is a little box in perspective:
 * dark ceiling, shaded and lit side walls, a warm back wall with a window, a timber floor and a made bed.
 * More bedrooms: rooms slide in, the roof and slab stretch, and the view zooms out to fit. More people:
 * figures are lowered into the rooms. Over 2 per bedroom they squeeze together and the room tints amber,
 * and "Overcrowded" appears below with the amber rule.
 *
 * Every room, shell piece and person is a small static SVG in its own HTML layer, and all motion is Web
 * Animations on transform and opacity with a spring-shaped easing, so it runs on the compositor: a stepper
 * tap only changes props and starts a few animations (the 4x-throttle budget).
 */
export const Dollhouse = memo(function Dollhouse({ bedrooms, occupants }: { bedrooms: number; occupants: number }) {
  const { t } = useLang();
  const id = useSvgId();
  const reduce = useReducedMotion();
  const [ref, w] = useWidth<HTMLDivElement>(350);
  const [painted, setPainted] = useState(false);
  useEffect(() => setPainted(true), []);
  const still = reduce || !painted;
  const nb = Math.max(0, Math.min(8, Math.round(bedrooms)));
  const occ = Math.max(1, Math.min(16, Math.round(occupants)));
  const over = isOvercrowded(nb, occ);
  const { cols, rows, cells } = layout(nb);
  const HW = cols * PW + WT;
  const sc = fit(w, HW, rows);
  const x0 = w / 2 - (HW / 2) * sc;
  // who sleeps where: balanced like the engine's per-bedroom count, moving as few people as possible
  const rooms = Math.max(1, nb);
  const prevAssign = useRef<number[]>([]);
  const assign = useMemo(() => rebalance(prevAssign.current, rooms, occ), [rooms, occ]);
  useEffect(() => {
    prevAssign.current = assign;
  }, [assign]);
  const counts = new Array<number>(rooms).fill(0);
  assign.forEach((r) => counts[r]++);
  const cellOf = (room: number) => cells.find((c) => c.room === room) ?? cells[0];
  // a room that isn't there waits where it would enter (its cell in the layout that adds it)
  const bedCell = (i: number) => (i < nb ? cellOf(i) : layout(i + 1).cells[i]);
  const stairs = cells.find((c) => c.kind === 'stairs') ?? layout(nb < 5 ? 5 : nb + 1).cells.find((c) => c.kind === 'stairs')!;
  const slot = new Array<number>(rooms).fill(0);
  // in a crowded room the back row takes the first spots, so drawing in order puts it behind
  const placed = PEOPLE.map((p) => {
    if (p >= occ) return { p, present: false, x: 0, y: 0, s: 1, room: -1 };
    const room = assign[p];
    const cell = cellOf(room);
    const spot = spots(counts[room])[slot[room]++];
    // `place` changes when the room moves to another floor, so its people are lifted and set down, not slid
    return { p, present: true, room: room * 2 + cell.r, s: spot.s, x: cell.c * PW + WT + RIW / 2 + 4 + spot.x, y: -cell.r * SH - SLAB - 1.6 + spot.y };
  });
  const camera = `translate(${x0.toFixed(2)}px, ${GROUND}px) scale(${sc.toFixed(4)})`;
  return (
    <div ref={ref} className="pointer-events-none" data-testid="dollhouse" aria-hidden>
      <div className="relative overflow-visible" style={{ height: VH }}>
        <svg width={0} height={0} className="absolute" aria-hidden>
          <Defs id={id} />
        </svg>
        {/* the camera: the house's bottom-left corner at (x0, GROUND), zoomed to fit */}
        <Piece t={camera} reduce={still} style={{ left: 0, top: 0, width: 0, height: 0, transformOrigin: '0 0' }}>
          {/* ground: a soft shadow and a lawn plinth, stretched to the house's width */}
          <Piece t={`translateX(${HW / 2}px) scaleX(${(HW + 28) / 100})`} reduce={still} style={{ left: -50, top: 0, width: 100, height: 16, transformOrigin: '50px 0' }}>
            <svg width={100} height={16} viewBox="-50 0 100 16" className="block overflow-visible" preserveAspectRatio="none">
              <Shadow id={id} cx={6} cy={9} rx={58} ry={5} />
              <rect x={-50} y={0} width={100} height={3} fill={P.sage} />
              <rect x={-50} y={3} width={100} height={5} fill={P.soil} />
              <rect x={-50} y={0} width={100} height={1} fill={P.sageLight} />
            </svg>
          </Piece>
          <Room id={id} kind="studio" room={0} c={0} r={0} present={nb === 0} crowded={nb === 0 && occ > 2} />
          {BED_KEYS.map((i) => {
            const cell = bedCell(i);
            return <Room key={i} id={id} kind="bed" room={i} c={cell.c} r={cell.r} present={i < nb} crowded={i < nb && counts[i] > 2} />;
          })}
          <Room id={id} kind="stairs" room={-1} c={stairs.c} r={stairs.r} present={nb > 4 && nb % 2 === 1} crowded={false} />
          {/* the outer right wall (an upper storey when there is one), the top slab and the roof */}
          <Piece t={`translateX(${HW - WT}px)`} reduce={still} style={{ left: 0, top: -2 * SH, width: WT, height: 2 * SH }}>
            <div className="absolute inset-x-0 bottom-0" style={{ height: SH, background: P.wallShade }} />
            <div className="absolute inset-x-0 top-0" style={{ height: SH, background: P.wallShade, opacity: rows > 1 ? 1 : 0, transition: 'opacity 180ms ease' }} />
          </Piece>
          <Piece t={`translateY(${-rows * SH}px) scaleX(${HW / 100})`} reduce={still} style={{ left: 0, top: -SLAB, width: 100, height: SLAB, transformOrigin: '0 0', background: P.wallDeep }} />
          <Piece t={`translate(${HW / 2}px, ${-rows * SH - SLAB}px) scaleX(${(HW + 2 * EAVE) / (100 + 2 * EAVE)})`} reduce={still} style={{ left: -61, top: -ROOF_H, width: 122, height: ROOF_H + 2, transformOrigin: `61px ${ROOF_H}px` }}>
            {ROOF(id)}
          </Piece>
          {/* a round attic window (outside the stretch, so it stays round) */}
          <Piece t={`translate(${HW / 2}px, ${-rows * SH - SLAB}px)`} reduce={still} style={{ left: -5, top: -15, width: 10, height: 10 }}>
            <svg width={10} height={10} viewBox="-5 -15 10 10" className="block overflow-visible">
              <circle cx={0} cy={-10} r={4.4} fill={P.trim} />
              <circle cx={0} cy={-10} r={3.2} fill="url(#dh-glass)" />
              <path d="M-2.6 -8.2L0.6 -12.8" stroke={P.trim} strokeWidth={0.9} opacity={0.6} />
            </svg>
          </Piece>
          {/* the people, over the rooms */}
          {placed.map((o) => (
            <Occupant key={o.p} p={o.p} present={o.present} x={o.x} y={o.y} s={o.s} room={o.room} />
          ))}
        </Piece>
      </div>
      <div className="mt-2 flex h-[15px] justify-center">
        <AnimatePresence initial={false}>
          {over && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: exit }}
              transition={{ duration: 0.2, ease: ease.out }}
              className="t-helper border-l-2 border-signal-amber pl-2 font-medium text-signal-amber"
              data-testid="overcrowded"
            >
              {t('intakeArt.overcrowded')}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
