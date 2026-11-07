'use client';
import { forwardRef, type SVGProps } from 'react';
import { CLOTH, HAIR, P, SKIN, type ClothKey } from '@/lib/illustrationPalette';

/**
 * A person, drawn warm and simple (no face): rounded body, skin tone, hair, clothing, a soft shadow at the
 * feet. Light from the top-left: each part carries a darker shade on its right side. Drawn in its own
 * coordinate space with the feet at (0,0); an adult is 100 units tall, a teen 86, a child 62, a toddler 46.
 * Parts are named groups (data-part="armL|armR|legL|legR|head|body") so callers can animate them.
 * Render inside an <svg>; position with a wrapping <g transform>.
 */
export type FigureKind = 'adult' | 'teen' | 'child' | 'toddler';
export type HairStyle = 'short' | 'long' | 'bun' | 'curly' | 'cap';
export type FigureProps = {
  kind?: FigureKind;
  skin?: number;
  hair?: number;
  hairStyle?: HairStyle;
  top?: ClothKey;
  bottom?: ClothKey;
  /** 'wave' raises the right arm */
  pose?: 'stand' | 'wave';
  /** wider build for some adults */
  build?: 'slim' | 'broad';
  shadow?: boolean;
} & Omit<SVGProps<SVGGElement>, 'ref'>;

const HEIGHT: Record<FigureKind, number> = { adult: 100, teen: 86, child: 62, toddler: 46 };
export const figureHeight = (k: FigureKind = 'adult') => HEIGHT[k];

export const Figure = forwardRef<SVGGElement, FigureProps>(function Figure(
  { kind = 'adult', skin = 1, hair = 0, hairStyle = 'short', top = 'pine', bottom = 'slate', pose = 'stand', build = 'slim', shadow = true, ...rest },
  ref,
) {
  const s = HEIGHT[kind] / 100;
  // child proportions: bigger head relative to body
  const headR = kind === 'child' || kind === 'toddler' ? 11.5 : 9.5;
  const bw = (build === 'broad' ? 30 : 25) * (kind === 'child' || kind === 'toddler' ? 1.05 : 1);
  const skinC = SKIN[skin % SKIN.length];
  const hairC = HAIR[hair % HAIR.length];
  const [topL, topD] = CLOTH[top];
  const [botL, botD] = CLOTH[bottom];
  // body frame (in adult units, then scaled)
  const legH = kind === 'child' || kind === 'toddler' ? 30 : 40;
  const torsoH = kind === 'child' || kind === 'toddler' ? 30 : 36;
  const hipY = -legH;
  const shoulderY = hipY - torsoH;
  const headCy = shoulderY - headR - 3;
  const legW = bw * 0.36;
  return (
    <g ref={ref} {...rest}>
      <g transform={`scale(${s})`}>
        {shadow && <ellipse cx={4} cy={1.5} rx={bw * 0.8} ry={4.5} fill={P.shadow} />}
        {/* legs */}
        <g data-part="legL">
          <rect x={-bw / 2 + 2} y={hipY} width={legW} height={legH} rx={legW / 2} fill={botL} />
          <ellipse cx={-bw / 2 + 2 + legW / 2} cy={-2.5} rx={legW * 0.62} ry={3.2} fill={P.slateDark} />
        </g>
        <g data-part="legR">
          <rect x={bw / 2 - 2 - legW} y={hipY} width={legW} height={legH} rx={legW / 2} fill={botD} />
          <ellipse cx={bw / 2 - 2 - legW / 2} cy={-2.5} rx={legW * 0.62} ry={3.2} fill={P.slateDark} />
        </g>
        {/* arms (behind the torso's edge) */}
        <g data-part="armL" style={{ transformBox: 'fill-box', transformOrigin: '50% 8%' }}>
          <rect x={-bw / 2 - 6.5} y={shoulderY + 2} width={8} height={torsoH * 0.92} rx={4} fill={topL} />
          <circle cx={-bw / 2 - 2.5} cy={shoulderY + 2 + torsoH * 0.92} r={4} fill={skinC} />
        </g>
        <g data-part="armR" style={{ transformBox: 'fill-box', transformOrigin: '50% 8%', rotate: pose === 'wave' ? '-150deg' : undefined }}>
          <rect x={bw / 2 - 1.5} y={shoulderY + 2} width={8} height={torsoH * 0.92} rx={4} fill={topD} />
          <circle cx={bw / 2 + 2.5} cy={shoulderY + 2 + torsoH * 0.92} r={4} fill={skinC} />
        </g>
        {/* torso with a shade on its right side */}
        <g data-part="body">
          <path d={`M${-bw / 2} ${hipY + 2}Q${-bw / 2} ${shoulderY} ${-bw / 2 + 7} ${shoulderY}H${bw / 2 - 7}Q${bw / 2} ${shoulderY} ${bw / 2} ${hipY + 2}Z`} fill={topL} />
          <path d={`M${bw * 0.12} ${shoulderY}H${bw / 2 - 7}Q${bw / 2} ${shoulderY} ${bw / 2} ${hipY + 2}H${bw * 0.18}Z`} fill={topD} opacity={0.75} />
        </g>
        {/* neck + head */}
        <g data-part="head">
          <rect x={-3} y={shoulderY - 5} width={6} height={7} fill={skinC} />
          <circle cx={0} cy={headCy} r={headR} fill={skinC} />
          <path d={`M${headR * 0.25} ${headCy - headR * 0.97}A${headR} ${headR} 0 0 1 ${headR * 0.25} ${headCy + headR * 0.97}A${headR * 1.35} ${headR * 1.35} 0 0 0 ${headR * 0.25} ${headCy - headR * 0.97}Z`} fill={P.ink} opacity={0.1} />
          <HairShape style={hairStyle} c={hairC} cy={headCy} r={headR} />
        </g>
      </g>
    </g>
  );
});

function HairShape({ style, c, cy, r }: { style: HairStyle; c: string; cy: number; r: number }) {
  switch (style) {
    case 'long':
      return <path d={`M${-r - 1} ${cy + r * 1.1}V${cy}A${r + 1} ${r + 1} 0 0 1 ${r + 1} ${cy}V${cy + r * 1.1}H${r * 0.55}V${cy - r * 0.15}Q0 ${cy - r * 0.55} ${-r * 0.55} ${cy - r * 0.15}V${cy + r * 1.1}Z`} fill={c} />;
    case 'bun':
      return (
        <>
          <circle cx={-r * 0.2} cy={cy - r * 1.05} r={r * 0.45} fill={c} />
          <path d={`M${-r - 0.5} ${cy + r * 0.1}A${r + 0.5} ${r + 0.5} 0 0 1 ${r + 0.5} ${cy + r * 0.1}Q${r * 0.2} ${cy - r * 0.5} ${-r - 0.5} ${cy + r * 0.1}Z`} fill={c} />
        </>
      );
    case 'curly':
      return (
        <g fill={c}>
          {[-0.8, -0.4, 0, 0.4, 0.8].map((f) => (
            <circle key={f} cx={f * r} cy={cy - r * 0.75 + Math.abs(f) * r * 0.45} r={r * 0.42} />
          ))}
        </g>
      );
    case 'cap':
      return (
        <>
          <path d={`M${-r - 0.5} ${cy - r * 0.05}A${r + 0.5} ${r + 0.5} 0 0 1 ${r + 0.5} ${cy - r * 0.05}Z`} fill={c} />
          <path d={`M${r * 0.2} ${cy - r * 0.08}h${r * 1.15}a${r * 0.2} ${r * 0.2} 0 0 1 0 ${r * 0.3}h${-r * 1.15}Z`} fill={c} />
        </>
      );
    default:
      return <path d={`M${-r - 0.5} ${cy + r * 0.15}A${r + 0.5} ${r + 0.5} 0 0 1 ${r + 0.5} ${cy + r * 0.15}Q${r * 0.4} ${cy - r * 0.55} ${-r * 0.2} ${cy - r * 0.4}Q${-r * 0.75} ${cy - r * 0.2} ${-r - 0.5} ${cy + r * 0.15}Z`} fill={c} />;
  }
}

/** A soft drop shadow ellipse for any illustrated object (15–20% ink, blurred). */
export function SoftShadow({ cx, cy, rx, ry, id }: { cx: number; cy: number; rx: number; ry: number; id: string }) {
  return (
    <>
      <defs>
        <filter id={id} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={Math.max(1.5, ry * 0.5)} />
        </filter>
      </defs>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={P.shadow} filter={`url(#${id})`} />
    </>
  );
}
