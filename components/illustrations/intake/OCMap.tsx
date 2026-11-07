'use client';
import { motion, type Transition } from 'motion/react';
import { memo } from 'react';
import { CLOTH, P } from '@/lib/illustrationPalette';
import { ease, exit } from '@/lib/motion';
import { Shadow, ShadowDef } from './shared';

/**
 * Orange County, simplified to 20 points (projected from real coordinates): the LA County line on the
 * northwest, the Chino Hills and Santa Ana Mountains on the northeast, San Diego County at the south tip,
 * and the coastline from San Clemente past Dana Point, Laguna and Newport to Seal Beach on the southwest.
 */
const OC =
  'M2 22.6L3.6 17L8 10.7L11.7 3.9L21.7 2.8L27.8 2L37.5 8.8L42.7 17L47.9 25.7L54 36.4L58 45.1L50.3 51.9L43 57L39.5 52.8L33.4 49.9L27.8 42.7L20.1 36.9L17.3 36.4L10.1 31.1L4.4 24.8Z';
/** The Pacific: the same coast, carried on past the county lines, closed off the southwest. */
const COAST = 'M-14 13L2 22.6L4.4 24.8L10.1 31.1L17.3 36.4L20.1 36.9L27.8 42.7L33.4 49.9L39.5 52.8L43 57L50.3 51.9L62 62';
const OCEAN = `${COAST}L62 90H-30V13Z`;
/** Santa Ana, where the pin lands (county coordinates). */
const PIN = { x: 26, y: 31 };

const W = 66;
const H = 60;
const TILE = { x: 3, y: 8, w: 58, h: 40, r: 7, d: 5 };
const MAP = 'translate(13.6 10.2) scale(0.62)';
const tip = { x: 13.6 + PIN.x * 0.62, y: 10.2 + PIN.y * 0.62 };
const head = { x: tip.x, y: tip.y - 10.5, r: 5.2 };

/** A drop under gravity, then two smaller bounces (keyframe times shared by the pin, its squash and its shadow). */
const DROP: Transition = { duration: 0.72, times: [0, 0.42, 0.6, 0.76, 0.88, 1], ease: ['easeIn', 'easeOut', 'easeIn', 'easeOut', 'easeIn'] };
/** The squash happens only at contact: stretched while falling, flattened on landing, a smaller one on the second. */
const SQUASH: Transition = { duration: 0.72, times: [0, 0.4, 0.47, 0.6, 0.74, 0.79, 1], ease: 'easeOut' };

/**
 * A small illustrated map tile of Orange County: a thick tile with a lit top and a front edge, the land, the
 * Pacific along the southwest with surf at the coast, and the county itself. "Yes" raises the county in
 * sage and drops a pine pin on Santa Ana that bounces twice and settles (its shadow grows as it falls).
 * "No" lifts the pin away and lowers the county. Decorative; the question carries the answer.
 */
export const OCMap = memo(function OCMap({ value, className = '' }: { value: boolean | null; className?: string }) {
  const on = value === true;
  const id = 'oc';
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={`pointer-events-none shrink-0 overflow-visible ${className}`} aria-hidden data-testid="oc-map">
      <defs>
        <ShadowDef id={id} />
        <clipPath id="oc-tile">
          <rect x={TILE.x} y={TILE.y} width={TILE.w} height={TILE.h} rx={TILE.r} />
        </clipPath>
        <linearGradient id="oc-land" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.trim} />
          <stop offset="1" stopColor={P.wall} />
        </linearGradient>
        <linearGradient id="oc-sea" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.skyTop} />
          <stop offset="1" stopColor={CLOTH.sky[0]} />
        </linearGradient>
        <linearGradient id="oc-county" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.sageLight} />
          <stop offset="1" stopColor={P.sage} />
        </linearGradient>
        <radialGradient id="oc-pin" cx="0.32" cy="0.28" r="0.85">
          <stop offset="0" stopColor={P.pineLighter} />
          <stop offset="0.55" stopColor={P.pineLight} />
          <stop offset="1" stopColor={P.pineDark} />
        </radialGradient>
      </defs>
      <Shadow id={id} cx={36} cy={TILE.y + TILE.h + TILE.d + 1} rx={33} ry={5} />
      {/* the tile's thickness, then its top face */}
      <rect x={TILE.x} y={TILE.y + TILE.d} width={TILE.w} height={TILE.h} rx={TILE.r} fill={P.stoneShade} />
      <rect x={TILE.x + TILE.w - 16} y={TILE.y + TILE.d} width={16} height={TILE.h} rx={TILE.r} fill={P.wallDeep} opacity={0.7} />
      <g clipPath="url(#oc-tile)">
        <rect x={TILE.x} y={TILE.y} width={TILE.w} height={TILE.h} fill="url(#oc-land)" />
        <g transform={MAP}>
          {/* neighbouring county lines */}
          <path d="M11.7 3.9L8 -4M37.5 8.8L43 1M54 36.4L62 33.6M58 45.1L64 49.5" fill="none" stroke={P.wallShade} strokeWidth={1.4} strokeLinecap="round" />
          <path d={OCEAN} fill="url(#oc-sea)" />
          <path d="M-2 40q3-2.4 6 0t6 0M14 55q3-2.4 6 0t6 0M-6 58q3-2.4 6 0t6 0" fill="none" stroke={P.trim} strokeWidth={1.3} strokeLinecap="round" opacity={0.7} />
          {/* the county at rest: a quiet shape on the map */}
          <path d={OC} fill={P.wallShade} />
          {/* yes: it rises out of the map in sage (an edge below it shows the lift) */}
          <motion.g initial={false} animate={{ opacity: on ? 1 : 0 }} transition={on ? { duration: 0.2, ease: ease.out } : exit}>
            <path d={OC} fill={P.sageDark} transform="translate(0.8 2.4)" />
            <motion.path d={OC} fill="url(#oc-county)" initial={false} animate={{ y: on ? -1.4 : 1 }} transition={{ type: 'spring', duration: 0.45, bounce: 0.2 }} />
          </motion.g>
          <path d={COAST} fill="none" stroke={P.trim} strokeWidth={1.4} strokeLinejoin="round" opacity={0.85} />
        </g>
        {/* a gloss along the tile's lit top edge */}
        <rect x={TILE.x + 4} y={TILE.y + 1.2} width={TILE.w - 22} height={1.4} rx={0.7} fill={P.trim} opacity={0.8} />
      </g>
      {/* the pin's shadow on the map grows as the pin comes down */}
      <motion.ellipse
        cx={tip.x + 1.6}
        cy={tip.y + 0.4}
        rx={3.6}
        ry={1.3}
        fill={P.shadow}
        initial={false}
        animate={on ? { opacity: [0, 1, 0.75, 1, 0.9, 1], scale: [0.3, 1, 0.75, 1, 0.92, 1] } : { opacity: 0, scale: 0.5 }}
        transition={on ? DROP : exit}
      />
      {/* the pin: drops, squashes on landing, bounces twice */}
      <motion.g
        style={{ originX: 0.5, originY: 1 }}
        initial={false}
        animate={
          on
            ? { y: [-30, 0, -5, 0, -1.4, 0], opacity: 1, scaleY: [1.05, 1.05, 0.78, 1.04, 1, 0.95, 1], scaleX: [0.97, 0.97, 1.16, 0.98, 1, 1.03, 1] }
            : { y: -10, opacity: 0, scaleY: 1, scaleX: 1 }
        }
        transition={on ? { ...DROP, opacity: { duration: 0.1 }, scaleY: SQUASH, scaleX: SQUASH } : { ...exit, duration: 0.18 }}
      >
        <path d={`M${tip.x} ${tip.y}L${head.x - 4.5} ${head.y + 2.8}A${head.r} ${head.r} 0 1 1 ${head.x + 4.5} ${head.y + 2.8}Z`} fill="url(#oc-pin)" />
        <path d={`M${tip.x} ${tip.y}L${head.x + 4.5} ${head.y + 2.8}A${head.r} ${head.r} 0 0 0 ${head.x + 2} ${head.y - 4.8}Q${head.x + 3.4} ${head.y + 2} ${tip.x} ${tip.y}Z`} fill={P.pineDark} opacity={0.35} />
        <circle cx={head.x} cy={head.y} r={1.9} fill={P.paper} />
        <ellipse cx={head.x - 2.2} cy={head.y - 2.6} rx={1.4} ry={0.8} fill={P.trim} opacity={0.6} />
      </motion.g>
    </svg>
  );
});
