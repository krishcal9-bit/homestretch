'use client';
import { useId } from 'react';
import { IsoHouse, ISO, ISO_VB, ISO_VIEWBOX } from '@/components/illustrations/IsoHouse';
import { P, mix } from '@/lib/illustrationPalette';
import type { BuildStage } from './buildStage';

const { W, dx, dy } = ISO;
const SLAB = 5; // slab thickness, house units

/**
 * A site at any point of its build, drawn at IsoHouse's scale and on its lawn so a row of them lines up:
 * a lot with a site sign and survey stakes, the footprint cleared and strung out, a poured slab, then the
 * house framing, roofing and finished. Static (staff never moves on its own); the door is never brass.
 */
export function BuildArt({ stage, size = 64, lit = false, className = '' }: { stage: BuildStage; size?: number; lit?: boolean; className?: string }) {
  if (stage === 'framing' || stage === 'roofing' || stage === 'finished') {
    return <IsoHouse size={size} stage={stage} doorBrass={false} lit={lit && stage === 'finished'} className={className} />;
  }
  return <SiteLot stage={stage} size={size} className={className} />;
}

function SiteLot({ stage, size, className }: { stage: 'lot' | 'staked' | 'slab'; size: number; className: string }) {
  const id = useId().replace(/:/g, '');
  const corners: [number, number][] = [
    [dx, -dy],
    [W + dx, -dy],
    [0, 0],
    [W, 0],
  ];
  return (
    <svg width={size} height={(size * ISO_VB.h) / ISO_VB.w} viewBox={ISO_VIEWBOX} className={`overflow-visible ${className}`} aria-hidden>
      <defs>
        <filter id={`b${id}`} x="-50%" y="-100%" width="200%" height="300%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <linearGradient id={`t${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.paper} />
          <stop offset="1" stopColor={P.stone} />
        </linearGradient>
      </defs>

      {/* the lawn: the same patch the house stands on */}
      <path d={`M-6 4L${W + 4} 4L${W + dx + 14} ${-dy + 2}L${dx + 4} ${-dy + 2}Z`} fill={P.sage} />
      <path d={`M-6 4L${W + 4} 4L${W + 4} 7L-6 7Z`} fill={P.sageDark} />
      <path d={`M${W + 4} 4L${W + dx + 14} ${-dy + 2}L${W + dx + 14} ${-dy + 5}L${W + 4} 7Z`} fill={P.sageDark} opacity={0.8} />

      {stage === 'slab' ? (
        <Slab id={id} />
      ) : (
        <>
          {stage === 'staked' && <ClearedFootprint />}
          {corners.slice(0, 2).map(([x, y]) => (
            <Stake key={`${x}`} x={x} y={y} />
          ))}
          {stage === 'staked' && (
            // string lines between the stakes, a little above the ground
            <path d={`M0 -5H${W}L${W + dx} ${-dy - 5}H${dx}Z`} fill="none" stroke={P.trim} strokeWidth={0.7} strokeLinejoin="round" opacity={0.9} />
          )}
          {stage === 'lot' && <SiteSign id={id} />}
          {stage === 'staked' && <PermitPost id={id} />}
          {corners.slice(2).map(([x, y]) => (
            <Stake key={`${x}`} x={x} y={y} />
          ))}
        </>
      )}
    </svg>
  );
}

/** A survey stake: a timber peg with its shaded right face, a pine flag, a short shadow to the right. */
function Stake({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x + 2.6} cy={y + 0.4} rx={2.8} ry={0.9} fill={P.shadowSoft} />
      <rect x={x - 1} y={y - 10} width={2} height={10.4} fill={P.timber} />
      <rect x={x + 0.2} y={y - 10} width={0.8} height={10.4} fill={P.timberShade} />
      <path d={`M${x + 1} ${y - 9.6}h4.6l-1.3 1.4 1.3 1.4H${x + 1}Z`} fill={P.pineLight} />
    </g>
  );
}

/** The footprint scraped back to soil, with a darker cut along its front edge. */
function ClearedFootprint() {
  const dirt = mix(P.soil, P.bark, 0.35);
  return (
    <g>
      <path d={`M0 0H${W}L${W + dx} ${-dy}H${dx}Z`} fill={P.soil} />
      <path d={`M0 0H${W}v1.4H0Z`} fill={dirt} opacity={0.7} />
      <path d={`M${W} 0L${W + dx} ${-dy}v1.4L${W} 1.4Z`} fill={dirt} opacity={0.45} />
      <ellipse cx={W * 0.34 + dx * 0.4} cy={-dy * 0.4} rx={5} ry={1.4} fill={dirt} opacity={0.35} />
      <ellipse cx={W * 0.7 + dx * 0.6} cy={-dy * 0.62} rx={3.6} ry={1.1} fill={dirt} opacity={0.3} />
    </g>
  );
}

/** An oblique box (front-left-bottom corner at x,y; depth as a fraction of the house's depth): lit top, front, shaded right side. */
function Box({ x, y, l, d, h, top, front, side }: { x: number; y: number; l: number; d: number; h: number; top: string; front: string; side: string }) {
  const ox = dx * d;
  const oy = -dy * d;
  return (
    <g>
      <path d={`M${x + l} ${y}l${ox} ${oy}v${-h}l${-ox} ${-oy}Z`} fill={side} />
      <rect x={x} y={y - h} width={l} height={h} fill={front} />
      <path d={`M${x} ${y - h}h${l}l${ox} ${oy}h${-l}Z`} fill={top} />
    </g>
  );
}

/** A poured slab: lit top, shaded front and darker side, anchor bolts, plumbing stubs and the lumber for the frame. */
function Slab({ id }: { id: string }) {
  const t = SLAB;
  const side = mix(P.stoneShade, P.slateLight, 0.22);
  const bolts = [0.62, 0.88];
  const end = mix(P.timberShade, P.bark, 0.35);
  return (
    <g>
      <ellipse cx={W / 2 + dx * 0.8} cy={-dy / 2 + 2} rx={W * 0.6} ry={dy * 0.42} fill={P.shadowSoft} filter={`url(#b${id})`} />
      <path d={`M${W} 0L${W + dx} ${-dy}V${-dy - t}L${W} ${-t}Z`} fill={side} />
      <path d={`M0 0V${-t}H${W}V0Z`} fill={P.stoneShade} />
      <path d={`M0 ${-t}H${W}L${W + dx} ${-dy - t}H${dx}Z`} fill={`url(#t${id})`} />
      {/* a bright arris where the top meets the front */}
      <path d={`M0 ${-t}H${W}`} stroke={P.trim} strokeWidth={0.6} opacity={0.9} />
      {/* anchor bolts along the back edge and the open front */}
      {[0.12, 0.38, 0.62, 0.88].map((f) => (
        <rect key={f} x={dx * 0.92 + W * f - 0.5} y={-t - dy * 0.92 - 2.6} width={1} height={2.2} fill={P.slateDark} opacity={0.8} />
      ))}
      {bolts.map((f) => (
        <rect key={f} x={W * f - 0.5} y={-t - 3.2} width={1} height={2.4} fill={P.slateDark} />
      ))}
      {/* plumbing stubs */}
      {[
        [W * 0.42 + dx * 0.6, -t - dy * 0.6],
        [W * 0.74 + dx * 0.45, -t - dy * 0.45],
      ].map(([x, y]) => (
        <g key={x}>
          <rect x={x - 1.3} y={y - 6} width={2.6} height={6} fill={P.trim} />
          <rect x={x + 0.2} y={y - 6} width={1.1} height={6} fill={P.trimShade} />
          <ellipse cx={x} cy={y - 6} rx={1.3} ry={0.5} fill={P.slateLight} />
        </g>
      ))}
      {/* the lumber for the frame, stacked on the slab: three courses, the top one shorter */}
      <ellipse cx={26} cy={-t - 2.5} rx={17} ry={2} fill={P.shadowSoft} filter={`url(#b${id})`} />
      <Box x={4} y={-t - 1.8} l={30} d={0.32} h={2.8} top={P.timber} front={end} side={P.timberShade} />
      <Box x={4} y={-t - 4.6} l={30} d={0.32} h={2.8} top={P.timber} front={end} side={P.timberShade} />
      <Box x={6} y={-t - 7.4} l={24} d={0.32} h={2.8} top={mix(P.timber, P.trim, 0.25)} front={end} side={P.timberShade} />
      {[0.25, 0.5, 0.75].map((f) => (
        <path key={f} d={`M${4 + 30 * f} ${-t - 1.8}v-5.6`} stroke={P.bark} strokeWidth={0.4} opacity={0.35} />
      ))}
    </g>
  );
}

/** The site sign at the front of a lot: a board on two posts carrying the house mark. */
function SiteSign({ id }: { id: string }) {
  const x0 = 14;
  const x1 = 50;
  const top = -44;
  const bot = -22;
  const th = 2.6; // board thickness, receding to the right
  return (
    <g>
      <ellipse cx={(x0 + x1) / 2 + 9} cy={-3.2} rx={17} ry={2.4} fill={P.shadow} filter={`url(#b${id})`} />
      {/* posts */}
      {[x0 + 6, x1 - 8].map((x) => (
        <g key={x}>
          <rect x={x} y={bot} width={2.6} height={-bot - 3} fill={P.timber} />
          <rect x={x + 1.4} y={bot} width={1.2} height={-bot - 3} fill={P.timberShade} />
        </g>
      ))}
      {/* board: top edge, shaded side, lit face */}
      <path d={`M${x0} ${top}l${th} ${-th * 0.6}H${x1 + th}L${x1} ${top}Z`} fill={P.trim} />
      <path d={`M${x1} ${top}l${th} ${-th * 0.6}V${bot - th * 0.6}L${x1} ${bot}Z`} fill={P.paperShade} />
      <rect x={x0} y={top} width={x1 - x0} height={bot - top} fill={P.paper} />
      <rect x={x0} y={bot - 1.2} width={x1 - x0} height={1.2} fill={P.paperShade} />
      {/* the house mark and two lines of lettering */}
      <path d={`M${x0 + 5} ${bot - 5}V${top + 10}l6.5 -5.5 6.5 5.5V${bot - 5}Z`} fill={P.pine} />
      <rect x={x0 + 10} y={bot - 10} width={3} height={5} fill={P.pineSoft} />
      <rect x={x0 + 22} y={top + 7} width={11} height={2} rx={1} fill={P.ink2} opacity={0.55} />
      <rect x={x0 + 22} y={top + 12} width={8} height={2} rx={1} fill={P.ink2} opacity={0.35} />
    </g>
  );
}

/** The permit, posted on site: a sheet in a frame on one post, the stamp in pine. */
function PermitPost({ id }: { id: string }) {
  const x = 10;
  const top = -38;
  const bot = -20;
  const w = 14;
  return (
    <g>
      <ellipse cx={x + w / 2 + 6} cy={-2.6} rx={8} ry={1.8} fill={P.shadow} filter={`url(#b${id})`} />
      <rect x={x + w / 2 - 1.2} y={bot} width={2.4} height={-bot - 2.5} fill={P.timber} />
      <rect x={x + w / 2 + 0.1} y={bot} width={1.1} height={-bot - 2.5} fill={P.timberShade} />
      <path d={`M${x + w} ${top}l2 -1.2V${bot - 1.2}L${x + w} ${bot}Z`} fill={P.slate} />
      <rect x={x - 1} y={top - 1} width={w + 1} height={bot - top + 1} fill={P.slateLight} />
      <rect x={x} y={top} width={w - 1} height={bot - top - 1} fill={P.paper} />
      {[3, 6, 9].map((o, i) => (
        <rect key={o} x={x + 2} y={top + o} width={i === 2 ? 5 : 9} height={1.3} rx={0.6} fill={P.ink2} opacity={0.45} />
      ))}
      <circle cx={x + w - 4} cy={bot - 4} r={2} fill={P.pine} opacity={0.85} />
    </g>
  );
}
