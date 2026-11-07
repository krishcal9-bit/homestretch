'use client';
import { useReducedMotion } from 'motion/react';
import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { P } from '@/lib/illustrationPalette';
import { IsoHouse, ISO_VB } from '@/components/illustrations/IsoHouse';
import { Figure } from '@/components/illustrations/Figure';
import { ShadowDef, Shadow, look } from './shared';
import { cancelAll, swing } from './walk';

/**
 * Step 1: the household on the front path of a house, on a small lawn plinth (the same diorama language as
 * the 3D house). The house keeps a slate door: brass is for the keys.
 *
 * One more person: they walk in from the right (legs and arms swing, the body bobs) and settle into the
 * group with a slight overshoot while the group shuffles to stay centred. One fewer: the last person turns
 * to wave, then steps out to the right. Kids are smaller; every slot has its own look, so the same household
 * always looks the same. Decorative: the stepper beside it carries the value.
 *
 * Layers: the plinth and house are one static SVG; each person is a small HTML layer on top, so a walk
 * (translate, fade, a bob on each step) runs on the compositor and never repaints the house.
 */
const W = 188;
const H = 118;
const FRONT = 104; // front edge of the lawn's top face
const DEPTH = { x: 38, y: -22 };
const LAWN = { l: 8, r: 146 };
const T = 6; // plinth thickness
const HOUSE = { x: 58, y: 96 }; // the house's front-left corner
const CX = 81; // the family centres on the end of the path
const FEET = 103;
const GAP = 13;
const S = 0.3; // people scale (an adult is 30px)
/** Small depth jitter so the group reads as people standing together, not a row of icons. */
const DY = [0, 1.2, 2.4, 0.6, 1.6, 3, 0.4, 2.2];
/** Where someone walks in from and out to (the right end of the lawn), in scene x. */
const OFFSTAGE = LAWN.r + 18;
const SLOTS = [0, 1, 2, 3, 4, 5, 6, 7];

function Backdrop() {
  const id = 'hh';
  const back = { l: LAWN.l + DEPTH.x, r: LAWN.r + DEPTH.x, y: FRONT + DEPTH.y };
  // the path runs from the door straight toward us (down-left in this projection)
  const run = (FRONT - HOUSE.y + 1) / -DEPTH.y;
  const door = { l: HOUSE.x + 23, r: HOUSE.x + 37, y: HOUSE.y + 1 };
  const pf = { l: door.l - run * DEPTH.x, r: door.r - run * DEPTH.x };
  const along = (t: number) => ({ l: door.l + (pf.l - door.l) * t, r: door.r + (pf.r - door.r) * t, y: door.y + (FRONT - door.y) * t });
  const seams = [0.36, 0.68].map(along);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 overflow-visible">
      <defs>
        <ShadowDef id={id} />
        <linearGradient id="hh-lawn" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.sageLight} />
          <stop offset="1" stopColor={P.sage} />
        </linearGradient>
        <linearGradient id="hh-soil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.soil} />
          <stop offset="1" stopColor={P.timberShade} />
        </linearGradient>
        <radialGradient id="hh-tree" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor={P.treeLight} />
          <stop offset="0.7" stopColor={P.tree} />
          <stop offset="1" stopColor={P.treeDark} />
        </radialGradient>
      </defs>
      <Shadow id={id} cx={(LAWN.l + back.r) / 2 + 8} cy={FRONT + T + 2} rx={(back.r - LAWN.l) / 2 + 6} ry={8} />
      {/* the lawn plinth: lit top, soil front and a darker right side */}
      <path d={`M${LAWN.l} ${FRONT}H${LAWN.r}L${back.r} ${back.y}H${back.l}Z`} fill="url(#hh-lawn)" />
      <path d={`M${LAWN.l} ${FRONT}H${LAWN.r}V${FRONT + T}H${LAWN.l}Z`} fill="url(#hh-soil)" />
      <path d={`M${LAWN.r} ${FRONT}L${back.r} ${back.y}V${back.y + T}L${LAWN.r} ${FRONT + T}Z`} fill={P.timberShade} />
      <path d={`M${LAWN.r} ${FRONT}L${back.r} ${back.y}V${back.y + T}L${LAWN.r} ${FRONT + T}Z`} fill={P.ink} opacity={0.12} />
      <path d={`M${LAWN.l} ${FRONT}H${LAWN.r}V${FRONT + 1.6}H${LAWN.l}Z`} fill={P.sageDark} />
      {/* a tree at the back right (the left stays clear for the label): trunk, a shaded crown, a highlight where the light lands */}
      <g transform="translate(131 -3)">
        <ellipse cx={38} cy={89} rx={12} ry={3} fill={P.sageDark} opacity={0.7} />
        <path d="M31.6 89V70h3.2v19Z" fill={P.bark} />
        <path d="M33.2 89V70h1.6v19Z" fill={P.ink} opacity={0.18} />
        <circle cx={33} cy={62} r={14} fill="url(#hh-tree)" />
        <circle cx={25} cy={70} r={8} fill={P.tree} />
        <circle cx={41} cy={69} r={8.5} fill={P.treeDark} />
        <circle cx={28} cy={56} r={4.5} fill={P.treeLight} opacity={0.8} />
        <circle cx={26.5} cy={54.8} r={1.6} fill={P.pineLighter} opacity={0.7} />
      </g>
      {/* the house, then its front path: stone slabs with a lit top and a front edge */}
      <g transform={`translate(${HOUSE.x + ISO_VB.x} ${HOUSE.y + ISO_VB.y})`}>
        <IsoHouse size={ISO_VB.w} doorBrass={false} ground={false} detail />
      </g>
      <path d={`M${door.l} ${door.y}H${door.r}L${pf.r} ${FRONT}H${pf.l}Z`} fill={P.stone} />
      <path d={`M${door.r} ${door.y}L${pf.r} ${FRONT}H${pf.r - 3}L${door.r - 2} ${door.y}Z`} fill={P.stoneShade} />
      {seams.map((s) => (
        <path key={s.y} d={`M${s.l} ${s.y}H${s.r}`} stroke={P.stoneShade} strokeWidth={1.1} />
      ))}
      <path d={`M${pf.l} ${FRONT}H${pf.r}V${FRONT + T}H${pf.l}Z`} fill={P.stoneShade} />
    </svg>
  );
}
/** Rendered once: a tap never re-renders the house. */
const BACKDROP = <Backdrop />;

/** Where an element's (possibly animating) translateX is right now. */
const currentX = (el: Element) => {
  const t = getComputedStyle(el).transform;
  return t && t !== 'none' ? new DOMMatrixReadOnly(t).m41 : 0;
};

/**
 * One person at slot `i`, always mounted (a tap only flips `present`, so it never builds DOM). Each person is
 * a small HTML layer: walking (translate) and fading run on the compositor via the Web Animations API, and
 * only the little leg and arm swings touch their own tiny SVG. `from` is where they walk in from and out to
 * (an offset from their slot, at the right end of the lawn). The inline style is always the final state;
 * the animations started before paint carry them there.
 */
const Person = memo(function Person({ i, present, from }: { i: number; present: boolean; from: number }) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const bob = useRef<HTMLDivElement>(null);
  const fig = useRef<SVGGElement>(null);
  const was = useRef(present);
  const L = look(i);
  // the drawing never re-renders
  const figure = useMemo(
    () => (
      <svg width={28} height={44} viewBox="-14 -40 28 44" className="block overflow-visible">
        <g transform={`scale(${S})`}>
          <Figure ref={fig} kind={L.kind} skin={L.skin} hair={L.hair} hairStyle={L.hairStyle} top={L.top} bottom={L.bottom} build={L.build} />
        </g>
      </svg>
    ),
    [L],
  );

  useLayoutEffect(() => {
    if (was.current === present) return;
    was.current = present;
    const el = box.current;
    const f = fig.current;
    if (reduce || !el || !f || typeof el.animate !== 'function') return;
    // start from where they stand, or wherever an interrupted walk left them (reading the computed style
    // forces a style recalc, so only then)
    const moving = el.getAnimations().length > 0;
    const x0 = moving ? currentX(el) : present ? from : 0;
    const o0 = moving ? Number(getComputedStyle(el).opacity) : present ? 0 : 1;
    if (moving) cancelAll(el);
    if (present) {
      // walk in: steps sized to the distance, a little overshoot as they stop beside the others
      const dist = Math.abs(x0);
      const dur = Math.min(0.9, 0.32 + dist / 90);
      el.animate([{ transform: `translateX(${x0}px)` }, { transform: 'translateX(0px)' }], { duration: dur * 1000, easing: 'cubic-bezier(0.3, 0.05, 0.3, 1.12)' });
      el.animate([{ opacity: o0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
      if (dist > 2) swing(f, { steps: Math.max(2, Math.round(dist / 8)), dur, bob: bob.current });
      return;
    }
    // wave, then step out to the right, fading as they go
    part(f, 'armR')?.animate(
      [
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(-165deg)', offset: 0.22 },
        { transform: 'rotate(-130deg)', offset: 0.42 },
        { transform: 'rotate(-165deg)', offset: 0.62 },
        { transform: 'rotate(-135deg)', offset: 0.8 },
        { transform: 'rotate(0deg)' },
      ],
      { duration: 820, easing: 'ease-in-out' },
    );
    const total = 920;
    const at = 420 / total;
    el.animate(
      [
        { transform: `translateX(${x0}px)`, offset: 0 },
        { transform: `translateX(${x0}px)`, offset: at, easing: 'cubic-bezier(0.45, 0, 0.7, 1)' },
        { transform: `translateX(${from}px)`, offset: 1 },
      ],
      { duration: total },
    );
    el.animate([{ opacity: o0 }, { opacity: o0, offset: 0.7 }, { opacity: 0 }], { duration: total });
    swing(f, { steps: 4, dur: 0.5, arms: false, delay: 420, bob: bob.current });
  }, [present, reduce, from]);

  return (
    <div ref={box} className="absolute" style={{ left: i * GAP - 14, top: DY[i % DY.length] - 40, width: 28, height: 44, opacity: present ? 1 : 0, transform: `translateX(${present ? 0 : from}px)` }}>
      <div ref={bob}>{figure}</div>
    </div>
  );
});
const part = (fig: SVGGElement, name: string) => fig.querySelector<SVGGElement>(`[data-part="${name}"]`);

export const HouseholdArt = memo(function HouseholdArt({ count, className = '' }: { count: number; className?: string }) {
  const reduce = useReducedMotion();
  const n = Math.max(1, Math.min(8, Math.round(count)));
  const rowX = CX - ((n - 1) * GAP) / 2;
  // the group shuffles to stay centred (compositor; a slight overshoot as everyone settles)
  const row = useRef<HTMLDivElement>(null);
  const prevRow = useRef(rowX);
  useLayoutEffect(() => {
    const el = row.current;
    const from = prevRow.current;
    prevRow.current = rowX;
    if (!el || from === rowX || reduce || typeof el.animate !== 'function') return;
    const running = el.getAnimations().length > 0;
    const cur = running ? currentX(el) : from;
    el.getAnimations().forEach((a) => a.cancel());
    el.animate([{ transform: `translateX(${cur}px)` }, { transform: `translateX(${rowX}px)` }], { duration: 520, easing: 'cubic-bezier(0.3, 1.2, 0.5, 1)' });
  }, [rowX, reduce]);
  return (
    <div className={`pointer-events-none relative ${className}`} style={{ width: W, height: H }} aria-hidden>
      {BACKDROP}
      <div ref={row} className="absolute left-0" style={{ top: FEET, transform: `translateX(${rowX}px)` }}>
        {SLOTS.map((i) => (
          // from: the slot's offset to the right end of the lawn, measured from where the group stands when they join
          <Person key={i} i={i} present={i < n} from={OFFSTAGE - (CX - (i * GAP) / 2) - i * GAP} />
        ))}
      </div>
    </div>
  );
});
