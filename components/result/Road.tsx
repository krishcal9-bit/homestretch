'use client';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { dur, ease, spring } from '@/lib/motion';
import { useLang } from '@/lib/i18n';
import { addMonths } from '@/lib/engine';
import { monthName, money } from '@/lib/format';
import { P, mix } from '@/lib/illustrationPalette';
import type { Milestone, MilestoneKey, ReadinessResult } from '@/lib/types';
import { IsoHouse, isoPx, type IsoBuild } from '@/components/illustrations/IsoHouse';

const PAD = 28;
const MIN_W = 280; // below this the road scrolls horizontally
const MERGE_GAP = 72; // markers closer than this share one label
const MIN_MARKER_GAP = 22; // markers stay at least this far apart so each stays tappable

type Size = 'md' | 'lg';
/**
 * trackY: the road's centre line. surf/edge: the road's top surface and the front face under it.
 * sign*: the milestone signposts (plate width/height, post height above the road's far edge).
 */
const GEOM: Record<Size, { trackY: number; h: number; r: number; keysR: number; font: number; above: number; below: number; charW: number; surf: number; edge: number; signW: number; signH: number; post: number }> = {
  md: { trackY: 40, h: 78, r: 5, keysR: 9, font: 13, above: 25, below: 27, charW: 6.9, surf: 8, edge: 3, signW: 15, signH: 10, post: 6 },
  lg: { trackY: 46, h: 92, r: 7, keysR: 12, font: 15, above: 30, below: 33, charW: 8, surf: 10, edge: 4, signW: 18, signH: 12, post: 7 },
};

/**
 * A slot at the end of the Road for a caller's object (the 3D house on the result and plan pages, the chosen
 * home in "Aim for a specific home"). ax/ay: the point of the slot that sits on the road at the Keys marker
 * (the 3D house: where its stepping-stone path meets the lawn's front edge). The Road reserves room on the
 * right so the object always fits, and the road surface ends under it.
 */
export type SlotKind = 'house' | 'home' | 'stage' | 'street';
/**
 * house: the 3D house on the result and plan pages; stage: the same house as the landing hero's centerpiece
 * (larger: ~64% of the road); home: a chosen home's 2D house.
 * ax/ay for the 3D house come from its camera framing (components/three/HouseScene.tsx SLOT_POSE): the point
 * where the stepping-stone path meets the lawn's front edge.
 */
const SLOT: Record<SlotKind, { frac: number; min: number; max: number; aspect: number; ax: number; ay: number; labelGap: number }> = {
  house: { frac: 0.46, min: 136, max: 236, aspect: 0.8, ax: 0.38, ay: 0.785, labelGap: 6 },
  stage: { frac: 0.64, min: 220, max: 420, aspect: 0.8, ax: 0.38, ay: 0.785, labelGap: 6 },
  // the landing street (STREET_FRAME: no plinth, nearly front-on): the path's end at the sidewalk
  street: { frac: 0.3, min: 200, max: 440, aspect: 0.8, ax: 0.427, ay: 0.935, labelGap: 6 },
  home: { frac: 0.22, min: 72, max: 96, aspect: 94 / 92, ax: 0.03, ay: 0.99, labelGap: -6 },
};
export function slotBox(kind: SlotKind, roadWidth: number, width?: number) {
  const s = SLOT[kind];
  const w = Math.max(MIN_W, Math.round(roadWidth));
  const sw = width !== undefined ? Math.round(width) : Math.round(Math.min(s.max, Math.max(s.min, w * s.frac)));
  const sh = Math.round(sw * s.aspect);
  const ax = Math.round(s.ax * sw);
  const ay = Math.round(s.ay * sh);
  return { sw, sh, ax, ay, labelGap: s.labelGap, reserve: Math.max(0, sw - ax - PAD + 4) };
}

/** cubic-bezier(x1,y1,x2,y2) as a function of time → progress, and its inverse (progress → time). */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  const progressAt = (time: number) => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid, x1, x2) < time) lo = mid;
      else hi = mid;
    }
    return at((lo + hi) / 2, y1, y2);
  };
  /** time (0–1) at which progress first reaches p */
  const timeFor = (p: number) => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (progressAt(mid) < p) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  return { progressAt, timeFor };
}
const CURVES = { out: bezier(...ease.out), inOut: bezier(...ease.inOut) };

type Placed = Milestone & { x: number };
type Cluster = { id: string; keys: MilestoneKey[]; x: number; text: string; side: 'above' | 'below'; left: number; width: number };
type Span = [number, number] | null;

function placeMarkers<T extends { month: number }>(ms: T[], maxMonth: number, w: number, reserve = 0): (T & { x: number })[] {
  const usable = w - PAD * 2 - reserve;
  const sorted = [...ms].sort((a, b) => a.month - b.month);
  const placed: (T & { x: number })[] = [];
  let lastX = -Infinity;
  for (const m of sorted) {
    let x = PAD + (Math.min(m.month, maxMonth) / maxMonth) * usable;
    if (x - lastX < MIN_MARKER_GAP) x = lastX + MIN_MARKER_GAP;
    lastX = x;
    placed.push({ ...m, x });
  }
  const end = w - PAD - reserve;
  if (lastX > end) for (let i = placed.length - 1, edge = end; i >= 0; i--, edge -= MIN_MARKER_GAP) placed[i].x = Math.min(placed[i].x, edge);
  return placed;
}

const maxMonthFor = (keysMonth: number) => Math.max(12, Math.ceil((keysMonth + 1) / 6) * 6);
export const ROAD_MIN_W = MIN_W;

/** Where the Road puts the Keys marker (px from its left edge) at a given width (and with an end slot). */
export function keysXAt(result: ReadinessResult, width: number, slot?: SlotKind): number {
  const w = Math.max(MIN_W, Math.round(width));
  const keysMonth = result.milestones.find((m) => m.key === 'keys')?.month ?? 9;
  const reserve = slot ? slotBox(slot, w).reserve : 0;
  return placeMarkers(result.milestones, maxMonthFor(keysMonth), w, reserve).find((m) => m.key === 'keys')?.x ?? w - PAD - reserve;
}

/**
 * When the Road's drawing line reaches the Keys marker (seconds from mount) at a given width, from the
 * Road's own placement. Lets a screen time other things (its date, the Keys house build) to the Road.
 * With an end slot the road ends at Keys, so it arrives there as the draw finishes.
 */
export function keysReachAt(result: ReadinessResult, drawDuration: number, width: number, drawEase: 'out' | 'inOut' = 'out', entranceDelay = 0, slot?: SlotKind): number {
  if (slot) return entranceDelay + drawDuration;
  const w = Math.max(MIN_W, Math.round(width));
  const x = keysXAt(result, width);
  return entranceDelay + drawDuration * CURVES[drawEase].timeFor(Math.min(1, Math.max(0, (x - PAD) / (w - PAD * 2))));
}

/**
 * Label layout that never overlaps: markers closer than 72px share one label; labels alternate above and
 * below the track; if a label would still collide with its same-side neighbour (or with "Today", or with
 * the space a house at Keys occupies), it flips side or merges with its neighbour, until nothing overlaps.
 */
function layoutLabels(placed: Placed[], w: number, charW: number, todayW: number, joinText: (labels: string[]) => string, pinned: MilestoneKey[] = [], blocks: { above: Span; below: Span } = { above: null, below: null }, plate?: { width: (text: string) => number; todayRight: number }): Cluster[] {
  const blocked = (c: { left: number; width: number; keys: MilestoneKey[] }, side: 'above' | 'below', left = c.left) => {
    const b = blocks[side];
    return !!b && !c.keys.includes('keys') && left < b[1] && left + c.width > b[0];
  };
  /** A label that runs into the house may slide left of it instead (still past its neighbour). */
  const placeOn = (c: Cluster, side: 'above' | 'below', after: number): number | null => {
    if (c.left >= after + 8 && !blocked(c, side)) return c.left;
    // a plate may also slide right of its neighbour (its notch still points at its markers)
    if (plate && Number.isFinite(after) && !blocked(c, side, after + 8) && after + 8 + c.width <= w - 2) return after + 8;
    const b = blocks[side];
    if (!b || !blocked(c, side)) return null;
    const left = b[0] - 4 - c.width;
    return left >= Math.max(2, after + 8) ? left : null;
  };
  const isPinned = (g: Placed[]) => g.some((m) => pinned.includes(m.key));
  // 1. initial clusters by distance
  let groups: Placed[][] = [];
  for (const m of placed) {
    const g = groups[groups.length - 1];
    // A highlighted milestone always keeps a label of its own.
    if (g && m.x - g[g.length - 1].x < MERGE_GAP && !pinned.includes(m.key) && !isPinned(g)) g.push(m);
    else groups.push([m]);
  }
  const build = (gs: Placed[][]): Cluster[] =>
    gs.map((g, i) => {
      const text = joinText(g.map((m) => m.label));
      const width = plate ? plate.width(text) : text.length * charW + 4;
      const x = (g[0].x + g[g.length - 1].x) / 2;
      const left = Math.min(Math.max(x - width / 2, 2), w - 2 - width);
      return { id: g.map((m) => m.key).join('+'), keys: g.map((m) => m.key), x, text, side: i % 2 === 0 ? 'below' : 'above', left, width };
    });
  for (let guard = 0; guard < 12; guard++) {
    const cs = build(groups);
    // "Today" sits above the road (or, as a plate, in the plates' row below it)
    const lastRight: Record<'above' | 'below', number> = plate ? { above: -Infinity, below: plate.todayRight } : { above: PAD + todayW + 8, below: -Infinity };
    let conflict = -1;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i];
      const here = placeOn(c, c.side, lastRight[c.side]);
      if (here !== null) {
        c.left = here;
        lastRight[c.side] = c.left + c.width;
        continue;
      }
      const other = c.side === 'above' ? 'below' : 'above';
      const there = placeOn(c, other, lastRight[other]);
      if (there !== null) {
        c.side = other;
        c.left = there;
        lastRight[other] = c.left + c.width;
        continue;
      }
      conflict = i;
      break;
    }
    if (conflict < 0) return cs;
    // Merge the conflicting cluster into a neighbour that isn't highlighted and try again.
    const i = conflict;
    const left = i - 1 >= 0 && !isPinned(groups[i - 1]) && !isPinned(groups[i]) ? i - 1 : -1;
    const right = i + 1 < groups.length && !isPinned(groups[i + 1]) && !isPinned(groups[i]) ? i + 1 : -1;
    if (left >= 0) groups = [...groups.slice(0, left), [...groups[left], ...groups[i]], ...groups.slice(i + 1)];
    else if (right >= 0) groups = [...groups.slice(0, i), [...groups[i], ...groups[right]], ...groups.slice(right + 1)];
    else {
      // Last resort: drop the label of the non-highlighted cluster next to a highlighted one.
      const victim = isPinned(groups[i]) ? i - 1 : i;
      if (victim < 0) return cs;
      const kept = build(groups).filter((_, k) => k !== victim);
      return kept;
    }
  }
  return build(groups);
}

function KeyGlyph({ s = 1 }: { s?: number }) {
  return (
    <g stroke={P.trim} strokeWidth={1.5} fill="none" strokeLinecap="round" transform={`scale(${s})`}>
      <circle cx="-2.5" cy="0" r="2.4" />
      <path d="M0 0h4.5M3 0v2" />
    </g>
  );
}

/** A brass disc set into the road (the Keys medallion, the "you are here" puck): rim, lit face, soft shadow. */
function BrassDisc({ r, uid, glyph = false }: { r: number; uid: string; glyph?: boolean }) {
  return (
    <g>
      <ellipse cx={r * 0.35} cy={r * 0.75} rx={r * 1.05} ry={r * 0.42} fill={P.shadow} />
      <circle cy={r * 0.16} r={r} fill={P.brassDark} />
      <circle r={r} fill={`url(#${uid}-brass)`} />
      <path d={`M${-r * 0.62} ${-r * 0.42}A${r * 0.75} ${r * 0.75} 0 0 1 ${r * 0.1} ${-r * 0.74}`} stroke={P.glow} strokeWidth={Math.max(1, r * 0.16)} strokeLinecap="round" fill="none" opacity={0.75} />
      {glyph && <KeyGlyph s={r / 9} />}
    </g>
  );
}

/** A milestone signpost: a slate post at the road's far edge, a pine arrow plate pointing toward Keys. */
function Signpost({ g, uid, play, delay }: { g: (typeof GEOM)[Size]; uid: string; play: boolean; delay: number }) {
  const { signW: sw, signH: sh, post, surf } = g;
  const base = -surf / 2 + 0.5;
  const pb = base - post; // plate bottom
  const pt = pb - sh; // plate top
  const L = -sw / 2;
  const R = sw / 2;
  const tip = sh * 0.36;
  const plate = `M${L + 2} ${pt}H${R - tip}L${R} ${pt + sh / 2}L${R - tip} ${pb}H${L + 2}Q${L} ${pb} ${L} ${pb - 2}V${pt + 2}Q${L} ${pt} ${L + 2} ${pt}Z`;
  return (
    <g>
      {/* contact shadow falls to the right (light from the top-left) */}
      <ellipse cx={2.4} cy={base + 0.8} rx={3.8} ry={1.3} fill={P.shadow} />
      <rect x={-1.15} y={pb - 1} width={2.3} height={base - pb + 1} rx={0.6} fill={P.slateLight} />
      <rect x={0.1} y={pb - 1} width={1.05} height={base - pb + 1} fill={P.slate} />
      {/* the plate settles with a small wobble after the post springs up (follow-through) */}
      <motion.g
        style={{ originX: 0.5, originY: 1 }}
        initial={play ? { rotate: -9 } : false}
        animate={{ rotate: 0 }}
        transition={{ type: 'spring', duration: 0.55, bounce: 0.45, delay: delay + 0.12 }}
      >
        <path d={plate} fill={P.pineDark} transform="translate(0.7 1.1)" />
        <path d={plate} fill={`url(#${uid}-sign)`} />
        <path d={`M${L + 2.4} ${pt + 0.9}H${R - tip - 0.4}`} stroke={P.pineLighter} strokeWidth={1} opacity={0.75} />
        <rect x={L + 3.2} y={pt + sh / 2 - 0.75} width={sw * 0.42} height={1.5} rx={0.75} fill={P.trim} opacity={0.92} />
      </motion.g>
    </g>
  );
}

function Marker({ m, g, uid, delay, play, active, highlighted, keysGlow = 0, keysKind, keysBuild = 'none', keysBuildDelay, slot, onActive, onHover }: { m: Placed; g: (typeof GEOM)[Size]; uid: string; delay: number; play: boolean; active: boolean; highlighted: boolean; keysGlow?: number; keysKind: 'dot' | 'house' | 'slot'; keysBuild?: IsoBuild; keysBuildDelay?: number; slot: ReturnType<typeof slotBox> | null; onActive: (k: string | null) => void; onHover: (k: string | null) => void }) {
  // The house's window lights for a beat when the date gets earlier.
  const [lit, setLit] = useState(false);
  useEffect(() => {
    if (!keysGlow) return;
    setLit(true);
    const id = setTimeout(() => setLit(false), 1400);
    return () => clearTimeout(id);
  }, [keysGlow]);
  // A tiny 1.1× pulse when this milestone becomes reachable earlier — animated in place, so the marker
  // (and the Keys house inside it) is never remounted while a slider is dragged.
  const reduce = useReducedMotion();
  const prevMonth = useRef(m.month);
  const pulse = useMotionValue(1);
  useEffect(() => {
    if (m.month < prevMonth.current && !reduce) animate(pulse, [1, 1.1, 1], { duration: 0.28, ease: ease.out });
    prevMonth.current = m.month;
  }, [m.month, pulse, reduce]);
  const x = useSpring(m.x, spring.gentle);
  useEffect(() => {
    if (reduce) x.jump(m.x);
    else x.set(m.x);
  }, [m.x, x, reduce]);
  const isKeys = m.key === 'keys';
  const houseW = g.keysR * 3.8;
  // the focus ring and hit area follow what's drawn: the sign plate, the Keys disc, or the house over Keys
  const plateCy = -g.surf / 2 - g.post - g.signH / 2;
  const hit = isKeys && keysKind === 'slot' && slot ? { x: -slot.ax, y: -slot.ay, w: slot.sw, h: slot.sh } : null;
  const handlers = {
    tabIndex: 0,
    role: 'button',
    'aria-label': m.label,
    'data-milestone': m.key,
    className: 'cursor-pointer outline-none',
    onPointerEnter: (e: React.PointerEvent) => (e.pointerType === 'mouse' ? onHover(m.key) : undefined),
    onPointerLeave: (e: React.PointerEvent) => (e.pointerType === 'mouse' ? onHover(null) : undefined),
    onFocus: () => onActive(m.key),
    onBlur: () => onActive(null),
    onClick: () => onActive(active ? null : m.key),
  };
  const sign = !isKeys;
  return (
    <motion.g style={{ x, y: g.trackY }}>
      {hit ? <rect x={hit.x} y={hit.y} width={hit.w} height={hit.h} fill="transparent" {...handlers} className="peer cursor-pointer outline-none" /> : <circle r="22" cy={sign ? plateCy * 0.6 : 0} fill="transparent" {...handlers} />}
      {/* the house's ring shows for keyboard focus only (hovering a whole house shouldn't frame it) */}
      {hit && <rect x={hit.x - 3} y={hit.y - 3} width={hit.w + 6} height={hit.h + 6} rx={14} fill="none" stroke="var(--pine)" strokeWidth="2" pointerEvents="none" className="opacity-0 peer-focus-visible:opacity-100" />}
      {active &&
        !hit &&
        (sign ? (
          <rect x={-g.signW / 2 - 4} y={plateCy - g.signH / 2 - 4} width={g.signW + 8} height={g.signH + 8} rx={5} fill="none" stroke="var(--pine)" strokeWidth="2" pointerEvents="none" />
        ) : (
          <circle r={g.keysR + 5} fill="none" stroke="var(--pine)" strokeWidth="2" pointerEvents="none" />
        ))}
      <motion.g style={{ scale: pulse, originX: 0.5, originY: sign ? 1 : 0.5 }} pointerEvents="none">
        <motion.g
          style={{ originX: 0.5, originY: sign ? 1 : 0.5 }}
          initial={play ? (sign ? { scaleY: 0.1, opacity: 0 } : { scale: 0.9, opacity: 0 }) : false}
          animate={sign ? { scaleY: 1, opacity: 1 } : { scale: 1, opacity: 1 }}
          transition={{
            // a signpost springs up out of the road with a little overshoot; the medallion pops
            scaleY: { type: 'spring', duration: 0.5, bounce: 0.3, delay },
            scale: { duration: 0.2, ease: ease.out, delay },
            opacity: { duration: 0.12, ease: ease.out, delay: play ? delay : 0 },
          }}
        >
          <motion.g style={{ originX: 0.5, originY: sign ? 1 : 0.5 }} initial={false} animate={{ scale: highlighted ? 1.15 : 1 }} transition={spring.snappy}>
            {isKeys && keysKind === 'house' ? (
              // the small isometric house from the intro, standing on the road
              <g transform={`translate(${-houseW / 2} ${-isoPx(houseW, 0, 0).y})`} data-testid="keys-house">
                <IsoHouse size={houseW} build={keysBuild} delay={keysBuildDelay ?? delay} lit={lit} />
              </g>
            ) : isKeys && keysKind === 'slot' ? null : isKeys ? (
              <BrassDisc r={g.keysR} uid={uid} glyph />
            ) : (
              <Signpost g={g} uid={uid} play={play} delay={delay} />
            )}
          </motion.g>
        </motion.g>
      </motion.g>
      {isKeys && keysKind !== 'slot' && keysGlow > 0 && (
        <motion.circle key={keysGlow} r={g.keysR + 2} fill="none" stroke="var(--brass)" strokeWidth="2" initial={{ opacity: 0.9, scale: 1 }} animate={{ opacity: 0, scale: 1.8 }} transition={{ duration: 0.6, ease: ease.out }} pointerEvents="none" />
      )}
    </motion.g>
  );
}

type RoadProps = {
  result: ReadinessResult;
  today?: Date;
  elapsed?: number;
  onEntranceDone?: () => void;
  /** 'always' replays the draw-in (landing page) without using up the result screen's once-per-visit play. */
  entrance?: 'session' | 'always' | 'none';
  entranceDelay?: number;
  drawDuration?: number;
  drawEase?: 'out' | 'inOut';
  size?: Size;
  /** Milestones to emphasise (landing scroll story). */
  highlight?: MilestoneKey[];
  /** CSS view-transition-name for shared-element transitions. */
  vtName?: string;
  className?: string;
  /** Pine paving from Today to this month; glides with a spring (the landing demo, the result). */
  progressTo?: number;
  /** Bump to flash the Keys marker (the date got earlier). */
  keysGlow?: number;
  /** The track is already on screen (the landing opening's line became it): don't redraw it; markers still pop as reached. */
  trackDrawn?: boolean;
  /** Override when the Keys marker appears (seconds): the landing opening's house becomes it on landing. */
  keysAt?: number;
  /**
   * The Keys marker: 'dot' a brass medallion in the road; 'house' the small isometric house (landing hero);
   * 'slot' the caller's `keysSlot` (the 3D house, a chosen home) standing at the end of the road.
   */
  keysVariant?: 'dot' | 'house' | 'slot';
  /** With keysVariant 'house': build the house (walls up, roof drops, door goes brass) — 'quick' ≈ 600ms, 'short' ≈ 400ms. */
  keysBuild?: IsoBuild;
  keysBuildDelay?: number;
  /** With keysVariant 'slot': what stands at the end of the road, and the slot's size class. */
  keysSlot?: ReactNode;
  slotKind?: SlotKind;
  /** With keysVariant 'slot': the label over the slot (defaults to "Keys"). */
  keysLabel?: string;
  /** Keys always sits at the end of the road (the domain is exactly Today → Keys): what stands there never moves. */
  pinKeys?: boolean;
  /** Lay everything out (the slot included) but hold the drawing and its entrance until this turns false. */
  hold?: boolean;
  /** With keysVariant 'slot': the slot's width in px (instead of a share of the road). */
  slotWidth?: number;
  /** Labels only above the road (below it is a dark street), each with a halo of this colour for legibility. */
  labelsAbove?: boolean;
  labelHalo?: string;
  /** With keysVariant 'slot': draw no label over the slot (the object speaks for itself). */
  noSlotLabel?: boolean;
  /** Hero only: labels as plates in a row below the road (see LabelPlates; the landing street also sets it by context). */
  labelPlates?: LabelPlates;
};

/**
 * Hero only (the landing street): every label is a plate (surface, 8px radius, ink, 13px, tabular numbers)
 * in one row below the road, its centre `y` px below the track, a small notch pointing up at its marker.
 * The street sets this through RoadStreetContext (components/landing/scenes/HeroScene.tsx) or the
 * `labelPlates` prop; without either, the Road draws exactly as on the result and plan pages.
 */
export type LabelPlates = { y: number; /** px the plates may run past the Road's right edge (the street goes on) */ room?: number };
export const RoadStreetContext = createContext<LabelPlates | null>(null);
const PLATE = { h: 24, r: 8, padX: 10, font: 13, notch: 5 };

/** A label's width at 13px (measured once the font is in; an estimate until then). */
let measureCtx: CanvasRenderingContext2D | null | undefined;
function plateTextWidth(text: string, weight: number) {
  if (measureCtx === undefined) measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  if (!measureCtx) return text.length * 6.9;
  measureCtx.font = `${weight} ${PLATE.font}px 'Public Sans', ui-sans-serif, system-ui, sans-serif`;
  // tabular numbers are a touch wider than proportional ones: round up
  return Math.ceil(measureCtx.measureText(text).width + 1);
}

/** A plate: a rounded rectangle with a notch on its top edge at `nx` (both from the plate's left). */
function platePath(w: number, h: number, nx: number) {
  const { r, notch: n } = PLATE;
  const x = Math.min(Math.max(nx, r + n), w - r - n);
  return `M${r} 0H${x - n}L${x} ${-n}L${x + n} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
}

function Plate({ w, top, notchX, text, weight }: { w: number; top: number; notchX: number; text: string; weight: number }) {
  return (
    <g transform={`translate(0 ${top})`}>
      <path d={platePath(w, PLATE.h, notchX)} fill="var(--surface)" stroke="var(--line-strong)" strokeWidth={1} />
      <text x={w / 2} y={PLATE.h / 2 + 4.5} textAnchor="middle" style={{ fontSize: PLATE.font, fontWeight: weight, fill: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
        {text}
      </text>
    </g>
  );
}

/** Where the track runs inside the Road's box (px from its top), for placing a Road on a drawn street. */
export function roadTrackY(size: 'md' | 'lg', kind: SlotKind, roadWidth: number, slotWidth?: number) {
  const g0 = GEOM[size];
  const slot = slotBox(kind, roadWidth, slotWidth);
  return Math.max(g0.trackY, Math.ceil(slot.ay + 2 + g0.font * 0.75 - slot.labelGap));
}

/**
 * The Road: Today → Keys with milestone signposts placed proportionally by month. An illustrated path: a
 * stone slab with a lit top surface, a darker front face and a soft shadow; the stretch to the ready date is
 * paved pine; each milestone is a signpost that springs up as the drawing road reaches it; Keys is a brass
 * medallion, the small house, or a slot for the caller's object (the 3D house) where the road ends.
 * Markers follow lever changes with spring.gentle; nothing in it moves on its own.
 */
export function Road({ result, today = new Date(), elapsed = 0, onEntranceDone, entrance = 'session', entranceDelay = 0, drawDuration = dur.long, drawEase = 'out', size = 'md', highlight = [], vtName, className = '', progressTo, keysGlow = 0, trackDrawn = false, keysAt, keysVariant = 'dot', keysBuild = 'none', keysBuildDelay, keysSlot, slotKind = 'house', keysLabel, pinKeys = false, hold = false, slotWidth, labelsAbove = false, labelHalo, noSlotLabel = false, labelPlates }: RoadProps) {
  const { t, lang } = useLang();
  const plates = useContext(RoadStreetContext) ?? labelPlates ?? null;
  // plates are sized from the real font: measure again once it has loaded
  const [fontsIn, setFontsIn] = useState(0);
  useEffect(() => {
    if (!plates || typeof document === 'undefined' || !document.fonts) return;
    let live = true;
    document.fonts.ready.then(() => live && setFontsIn((n) => n + 1));
    return () => {
      live = false;
    };
  }, [!!plates]); // eslint-disable-line react-hooks/exhaustive-deps
  const uid = `rd${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const reduce = useReducedMotion();
  const g0 = GEOM[size];
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(MIN_W);
  const [overflows, setOverflows] = useState(false);
  // Nothing is drawn until the real width is known, so markers never slide from a fallback layout.
  const [measured, setMeasured] = useState(false);
  const slot = keysVariant === 'slot' ? slotBox(slotKind, w, slotWidth) : null;
  // A house marker is taller than a dot: add room above the track for the house and its label.
  const houseExtra = keysVariant === 'house' ? Math.max(0, Math.ceil(g0.keysR * 3.8 * 0.98 + 8 + g0.font - g0.trackY)) : 0;
  const slotTrackY = slot ? Math.max(g0.trackY, Math.ceil(slot.ay + 2 + g0.font * 0.75 - slot.labelGap)) : 0;
  const g = houseExtra
    ? { ...g0, trackY: g0.trackY + houseExtra, h: g0.h + houseExtra }
    : slot
      ? { ...g0, trackY: slotTrackY, h: Math.max(slotTrackY + g0.h - g0.trackY, slotTrackY + slot.sh - slot.ay + 4) }
      : g0;
  // Entrance delays apply only during the first draw; later changes (sliders, family switch) respond at once.
  const [entranceOver, setEntranceOver] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  // Tooltip etiquette: first hover waits 400ms; once one is open, neighbours open instantly.
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHover = (k: string | null) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (k === null) {
      hoverTimer.current = setTimeout(() => setActive(null), 80);
      return;
    }
    if (active) setActive(k);
    else hoverTimer.current = setTimeout(() => setActive(k), 400);
  };
  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    },
    [],
  );
  const [play] = useState(() => {
    if (entrance === 'always') return true;
    if (entrance === 'none') return false;
    try {
      if (sessionStorage.getItem('hs.roadPlayed')) return false;
      sessionStorage.setItem('hs.roadPlayed', '1');
      return true;
    } catch {
      return true;
    }
  });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setW(Math.max(MIN_W, Math.round(e.contentRect.width)));
      setOverflows(e.contentRect.width < MIN_W);
      setMeasured(true);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (hold) return;
    if (!play) {
      setEntranceOver(true);
      onEntranceDone?.();
    } else {
      const id = setTimeout(() => {
        setEntranceOver(true);
        onEntranceDone?.();
      }, (entranceDelay + drawDuration + 0.2) * 1000);
      return () => clearTimeout(id);
    }
  }, [play, onEntranceDone, entranceDelay, drawDuration, hold]);

  const keysMonth = result.milestones.find((m) => m.key === 'keys')?.month ?? 9;
  // Domain rounds up to 6 months so markers glide rather than rescale wildly.
  const maxMonth = pinKeys ? Math.max(1, keysMonth) : maxMonthFor(keysMonth);
  const reserve = slot?.reserve ?? 0;
  const usable = w - PAD * 2 - reserve;
  const span = w - PAD * 2; // the road path's full length
  const collectionAmount = result.blockers.find((b) => b.key === 'collections')?.text.match(/\$[\d,]+/)?.[0] ?? '';
  const ms: Milestone[] = result.milestones.map((m) => ({
    ...m,
    label: t(`road.labels.${m.key}`),
    action: m.key === 'credit' && m.month === 0 ? t('road.actions.creditGood') : t(`road.actions.${m.key}`, { amount: m.key === 'savings' ? money(result.downPaymentTarget, lang) : collectionAmount }),
  }));
  const placed = useMemo(() => placeMarkers(ms, maxMonth, w, reserve), [ms, maxMonth, w, reserve]);
  const joinText = (labels: string[]) =>
    labels.length === 1 ? labels[0] : labels.length === 2 ? `${labels[0]} + ${labels[1].charAt(0).toLowerCase()}${labels[1].slice(1)}` : `${labels[0]} + ${t('road.more', { n: labels.length - 1 })}`;
  const todayLabel = t('result.today');
  // Keys always keeps its own label: it's the brass marker the levers move.
  const keysX = placed.find((p) => p.key === 'keys')?.x ?? w;
  const houseHalf = keysVariant === 'house' ? (g.keysR * 3.8) / 2 + 6 : 0;
  const ownKeysLabel = keysVariant === 'house' || keysVariant === 'slot';
  const blocks = useMemo<{ above: Span; below: Span }>(() => {
    // plates: one row below the road, clear of the house (it stands above the road)
    if (plates) return { above: [-1e6, 1e6], below: null };
    if (houseHalf) return { above: [keysX - houseHalf, keysX + houseHalf], below: null };
    // the slot covers the space above the road; the 3D house's plinth also dips below it right of Keys
    const all: Span = labelsAbove ? [-1e6, 1e6] : null;
    if (slot) return { above: [keysX - slot.ax - 4, keysX - slot.ax + slot.sw], below: all ?? (slotKind !== 'home' ? [keysX - 4, keysX - slot.ax + slot.sw] : null) };
    return { above: null, below: all };
  }, [houseHalf, slot?.ax, slot?.sw, slotKind, keysX, labelsAbove, !!plates]); // eslint-disable-line react-hooks/exhaustive-deps
  // labels drawn on an illustration get a halo of the ground they sit on
  const halo = labelHalo ? { stroke: labelHalo, strokeWidth: 4, paintOrder: 'stroke' as const, strokeLinejoin: 'round' as const } : null;
  // plates: each label's plate width, and Today's plate (its notch on the "you are here" puck)
  const plateW = (text: string, weight = 500) => plateTextWidth(text, weight) + PLATE.padX * 2;
  const todayPlate = plates ? { left: Math.max(2, PAD - 14), w: plateW(todayLabel) } : null;
  const clusters = useMemo(
    // With a house at Keys, Keys is labelled above it, so it leaves the label lanes entirely.
    () =>
      layoutLabels(
        ownKeysLabel ? placed.filter((p) => p.key !== 'keys') : placed,
        w + (plates?.room ?? 0),
        g.charW,
        todayLabel.length * g.charW,
        joinText,
        [...highlight, 'keys'],
        blocks,
        todayPlate ? { width: (text) => plateW(text), todayRight: todayPlate.left + todayPlate.w } : undefined,
      ),
    [placed, w, g.charW, todayLabel, lang, highlight.join(), ownKeysLabel, blocks, fontsIn, !!plates, plates?.room], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const xAt = (month: number) => PAD + (Math.min(Math.max(month, 0), maxMonth) / maxMonth) * usable;
  const curX = xAt(elapsed);
  const activeM = placed.find((p) => p.key === active);
  const curve = CURVES[drawEase];
  // The road ends at Keys when something stands there; otherwise it runs the full width.
  const endX = slot ? keysX : w - PAD;
  // A marker pops in when the drawing road reaches it.
  const reachDelay = (x: number) => entranceDelay + drawDuration * curve.timeFor(Math.min(1, Math.max(0, (x - PAD) / Math.max(1, endX - PAD))));
  const drawT = { duration: drawDuration, ease: drawEase === 'inOut' ? ease.inOut : ease.out, delay: entranceDelay };

  // ---- road geometry as motion values: the draw-in, where the road ends, how far the pine paving reaches ----
  const drawIn = play && !trackDrawn && !reduce;
  const draw = useMotionValue(drawIn ? 0 : 1);
  useEffect(() => {
    if (!measured || !drawIn || hold) return;
    const c = animate(draw, 1, drawT);
    return () => c.stop();
  }, [measured, hold]); // eslint-disable-line react-hooks/exhaustive-deps
  const endFrac = Math.min(1, Math.max(0, (endX - PAD) / span));
  // a new width (first measure, resize) places things at once; a new month glides
  const lastW = useRef(0);
  const resized = lastW.current !== w;
  useEffect(() => {
    lastW.current = w;
  });
  const end = useSpring(endFrac, spring.gentle);
  useEffect(() => {
    if (reduce || !entranceOver || resized) end.jump(endFrac);
    else end.set(endFrac);
  }, [endFrac, end, reduce, entranceOver]); // eslint-disable-line react-hooks/exhaustive-deps
  const roadLen = useTransform(() => draw.get() * end.get());
  const progFrac = progressTo === undefined ? 0 : (xAt(progressTo) - PAD) / span;
  const prog = useMotionValue(play && !reduce ? 0 : progFrac);
  const progStarted = useRef(false);
  useEffect(() => {
    if (!measured || progressTo === undefined || hold) return;
    // the first fill draws with the road; later changes glide with spring.gentle (keeping their velocity);
    // a new width places it at once
    const first = play && !progStarted.current;
    progStarted.current = true;
    if (reduce || (!first && resized)) {
      prog.jump(progFrac);
      return;
    }
    const c = animate(prog, progFrac, first && !entranceOver ? drawT : spring.gentle);
    return () => c.stop();
  }, [progFrac, measured, hold]); // eslint-disable-line react-hooks/exhaustive-deps
  const slotX = useSpring(keysX - (slot?.ax ?? 0), spring.gentle);
  useEffect(() => {
    const to = keysX - (slot?.ax ?? 0);
    if (reduce || !measured || resized) slotX.jump(to);
    else slotX.set(to);
  }, [keysX, slot?.ax, slotX, reduce, measured]); // eslint-disable-line react-hooks/exhaustive-deps
  const slotLabel = keysLabel ?? t('road.labels.keys');
  const slotLabelW = slotLabel.length * g.charW;
  const slotLabelX = useTransform(slotX, (sx) => Math.min(Math.max(sx + (slot?.sw ?? 0) / 2 - slotLabelW / 2, 2), w - 2 - slotLabelW));

  const ty = g.trackY;
  const d = (y: number) => `M${PAD} ${y}H${w - PAD}`;
  const surfTop = ty - g.surf / 2;
  const roadLayer = (y: number, stroke: string, width: number, len: typeof roadLen, extra: Record<string, unknown> = {}) => (
    <motion.path d={d(y)} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" style={{ pathLength: len }} {...extra} />
  );
  // the highlight along the far edge stays inside the rounded ends
  const edgeLight = (stroke: string, len: typeof roadLen, opacity: number) => (
    <motion.path d={`M${PAD + g.surf / 2} ${surfTop + 1.2}H${w - PAD - g.surf / 2}`} fill="none" stroke={stroke} strokeWidth={1} style={{ pathLength: len }} opacity={opacity} />
  );

  return (
    <div className={`relative ${className}`} style={vtName ? { viewTransitionName: vtName } : undefined}>
      {/* scrolls sideways only when narrower than the Road's minimum; otherwise the tooltip may hang below it */}
      <div ref={wrapRef} className={`relative -mx-5 px-5 [scrollbar-width:none] sm:mx-0 sm:px-0 ${overflows ? 'overflow-x-auto' : ''}`} tabIndex={-1}>
        <div className="relative" style={{ width: w, height: g.h }}>
          {/* the object at the end of the road sits under the drawing, so the road's end and the signposts read in front of it */}
          {measured && slot && (
            <motion.div className="pointer-events-none absolute left-0" style={{ top: ty - slot.ay, width: slot.sw, height: slot.sh, x: slotX }} data-testid="keys-house">
              {keysSlot}
            </motion.div>
          )}
          {/* held: the slot and the box are laid out, the drawing (and its entrance clock) waits */}
          {!hold && (
          <svg width={w} height={g.h} viewBox={`0 0 ${w} ${g.h}`} role="group" aria-label={t('result.roadTitle')} className="relative block select-none overflow-visible">
            <defs>
              <linearGradient id={`${uid}-surf`} gradientUnits="userSpaceOnUse" x1="0" y1={surfTop} x2="0" y2={surfTop + g.surf}>
                <stop offset="0" stopColor={mix(P.stone, P.trim, 0.55)} />
                <stop offset="1" stopColor={P.stone} />
              </linearGradient>
              <linearGradient id={`${uid}-pave`} gradientUnits="userSpaceOnUse" x1="0" y1={surfTop} x2="0" y2={surfTop + g.surf}>
                <stop offset="0" stopColor={P.pineLight} />
                <stop offset="1" stopColor={P.pine} />
              </linearGradient>
              <linearGradient id={`${uid}-shadow`} gradientUnits="userSpaceOnUse" x1="0" y1={ty + g.surf / 2 + g.edge - 2} x2="0" y2={ty + g.surf / 2 + g.edge + 5}>
                <stop offset="0" stopColor={P.shadow} />
                <stop offset="1" stopColor={P.shadow} stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`${uid}-sign`} x1="0" y1="0" x2="0.4" y2="1">
                <stop offset="0" stopColor={P.pineLight} />
                <stop offset="1" stopColor={P.pine} />
              </linearGradient>
              <linearGradient id={`${uid}-brass`} x1="0.2" y1="0" x2="0.8" y2="1">
                <stop offset="0" stopColor={P.honey} />
                <stop offset="1" stopColor={P.brass} />
              </linearGradient>
            </defs>
            {measured && (<>
            {/* the track's centre line (the landing opening's ground line lands on it) */}
            <line x1={PAD} x2={w - PAD} y1={ty} y2={ty} stroke="none" />
            {/* the road: soft shadow, front face, lit top surface, a highlight along its far edge */}
            {roadLayer(ty + g.surf / 2 + g.edge + 1, `url(#${uid}-shadow)`, 7, roadLen, { transform: 'translate(2 0)' })}
            {roadLayer(ty + g.edge, P.stoneShade, g.surf, roadLen)}
            {roadLayer(ty, `url(#${uid}-surf)`, g.surf, roadLen)}
            {edgeLight(P.trim, roadLen, 0.7)}
            {/* months already behind the family (plan page) */}
            {elapsed > 0 && (
              <g>
                <path d={`M${PAD} ${ty + g.edge}H${curX}`} stroke={P.pineDark} strokeWidth={g.surf} strokeLinecap="round" />
                <path d={`M${PAD} ${ty}H${curX}`} stroke={`url(#${uid}-pave)`} strokeWidth={g.surf} strokeLinecap="round" />
              </g>
            )}
            {progressTo !== undefined && (
              // the pine paving is the full road with its drawn length animated (pathLength), never its width
              <motion.g initial={play ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: play && !entranceOver ? entranceDelay : 0 }}>
                {roadLayer(ty + g.edge, P.pineDark, g.surf, prog)}
                {roadLayer(ty, `url(#${uid}-pave)`, g.surf, prog, { 'data-testid': 'road-progress' })}
                {edgeLight(P.pineLighter, prog, 0.55)}
              </motion.g>
            )}
            {todayPlate && plates ? (
              <motion.g
                transform={`translate(${todayPlate.left} 0)`}
                initial={play ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: play ? entranceDelay : 0 }}
                data-label="today"
              >
                <Plate w={todayPlate.w} top={ty + plates.y - PLATE.h / 2} notchX={PAD - todayPlate.left} text={todayLabel} weight={500} />
              </motion.g>
            ) : (
              <motion.text
                x={PAD}
                y={ty - g.above}
                textAnchor="start"
                style={{ fill: 'var(--ink-2)', fontSize: g.font, ...halo }}
                initial={play ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: play ? entranceDelay : 0 }}
              >
                {todayLabel}
              </motion.text>
            )}
            {/* "you are here": a brass puck set into the road */}
            <motion.g style={{ x: curX, y: ty }} initial={play ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: dur.short, delay: play ? entranceDelay : 0 }}>
              <BrassDisc r={g.r} uid={uid} />
            </motion.g>
            {placed.map((m) => (
              <Marker key={m.key} m={m} g={g} uid={uid} onHover={onHover} delay={play && !entranceOver ? (m.key === 'keys' && keysAt !== undefined ? keysAt : reachDelay(m.x)) : 0} play={play} highlighted={highlight.includes(m.key)} keysGlow={keysGlow} keysKind={keysVariant} keysBuild={keysBuild} keysBuildDelay={keysBuildDelay} slot={slot} active={active === m.key} onActive={setActive} />
            ))}
            <AnimatePresence initial={play}>
              {clusters.map((c) => {
                const strong = c.keys.includes('keys') || c.keys.some((k) => highlight.includes(k));
                if (plates) {
                  return (
                    <motion.g
                      key={c.id}
                      initial={{ opacity: 0, x: c.left }}
                      animate={{ opacity: 1, x: c.left }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      transition={{ x: spring.gentle, opacity: { duration: 0.2, ease: ease.out, delay: play && !entranceOver ? reachDelay(c.x) + 0.05 : 0 } }}
                      pointerEvents="none"
                      data-label={c.id}
                    >
                      <Plate w={c.width} top={ty + plates.y - PLATE.h / 2} notchX={c.x - c.left} text={c.text} weight={strong ? 600 : 500} />
                    </motion.g>
                  );
                }
                return (
                  <motion.text
                    key={c.id}
                    y={c.side === 'above' ? ty - g.above : ty + g.below}
                    textAnchor="start"
                    style={{ fontSize: g.font, fontWeight: c.keys.includes('keys') ? 600 : 400, fill: strong ? 'var(--ink)' : 'var(--ink-2)', ...halo }}
                    initial={{ opacity: 0, x: c.left }}
                    animate={{ opacity: 1, x: c.left }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    transition={{ x: spring.gentle, opacity: { duration: 0.2, ease: ease.out, delay: play && !entranceOver ? (c.keys.includes('keys') && keysAt !== undefined ? keysAt + 0.05 : reachDelay(c.x) + 0.05) : 0 } }}
                    pointerEvents="none"
                    data-label={c.id}
                  >
                    {c.text}
                  </motion.text>
                );
              })}
            </AnimatePresence>
            {houseHalf > 0 && (
              <motion.text
                y={ty - g.keysR * 3.8 * 0.98 - 6}
                textAnchor="middle"
                style={{ fontSize: g.font, fontWeight: 600, fill: 'var(--ink)' }}
                initial={play ? { opacity: 0, x: keysX } : { opacity: 1, x: keysX }}
                animate={{ opacity: 1, x: keysX }}
                transition={{ x: spring.gentle, opacity: { duration: 0.2, ease: ease.out, delay: play && !entranceOver ? (keysAt ?? reachDelay(keysX)) + 0.1 : 0 } }}
                pointerEvents="none"
                data-label="keys"
              >
                {t('road.labels.keys')}
              </motion.text>
            )}
            {slot && !noSlotLabel && (
              <motion.text
                y={ty - slot.ay + slot.labelGap}
                textAnchor="start"
                style={{ x: slotLabelX, fontSize: g.font, fontWeight: 600, fill: 'var(--ink)', ...halo }}
                initial={play ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, ease: ease.out, delay: play && !entranceOver ? (keysAt ?? reachDelay(keysX)) + 0.1 : 0 }}
                pointerEvents="none"
                data-label="keys"
              >
                {slotLabel}
              </motion.text>
            )}
            </>)}
          </svg>
          )}
          <AnimatePresence>
            {activeM && (
              <motion.div
                key="tip"
                role="tooltip"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
                transition={{ duration: 0.16, ease: ease.out }}
                className="pointer-events-none absolute z-10 w-[240px] rounded-[8px] bg-tip px-3 py-2 text-[13px] leading-[18px] text-on-tip"
                style={{
                  top: ty + g.keysR + 8,
                  left: Math.min(Math.max(activeM.x - 120, 8), w - 248),
                  transformOrigin: `${activeM.x - Math.min(Math.max(activeM.x - 120, 8), w - 248)}px -8px`,
                }}
              >
                <span className="tnum block font-medium">
                  {activeM.label} · {monthName(addMonths(today, activeM.month), lang, true)}
                </span>
                <span className="mt-1 block text-on-tip/85">{activeM.action}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {overflows && <div className="pointer-events-none absolute inset-y-0 -right-5 w-10 bg-gradient-to-l from-[var(--surface)] to-transparent" aria-hidden />}
    </div>
  );
}
