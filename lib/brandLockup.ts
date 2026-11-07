// The Keystone lockup as plain shapes (hex colours, no CSS, no masks) for places that can't run the React
// component: the PDFs (react-pdf <Svg>) and the share card (an SVG image in satori). Same geometry as
// components/brand/Wordmark.tsx: the shaded arch with its brass keystone and keyhole, "Keystone" as Fraunces
// outlines with the brass notch in the K. The tagline is set separately as real text by each caller.
import { CX, R2, STONES, KEYHOLE } from '@/components/brand/arch';
import { WORDMARK as G } from '@/components/brand/wordmarkGlyphs';

const ARCH_W = CX + R2;
const TEXT_X = ARCH_W + 20;
/** viewBox of the lockup (arch units; baseline y = 0) */
export const LOCKUP_VB = { x: -4, y: -84, w: TEXT_X + G.width + 6, h: 108 };
/** where the wordmark starts, as a share of the lockup's width (to align a tagline under it) */
export const LOCKUP_TEXT_SHARE = (TEXT_X - LOCKUP_VB.x) / LOCKUP_VB.w;
/** the wordmark's em as a share of the lockup's height (tagline size = 22% of it) */
export const LOCKUP_EM_SHARE = 100 / LOCKUP_VB.h;

const hex = (c: string) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
const toHex = (v: number[]) => `#${v.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;
const blend = (c: string, to: string, t: number) => toHex(hex(c).map((x, k) => x + (hex(to)[k] - x) * t));

export type LockupShape = { d: string; fill: string; dx?: number };
/** Every shape of the lockup, back to front. `paper` fills the keyhole (the page colour behind it). */
export function lockupShapes({ ink = '#182420', pine = '#1E5C47', brass = '#B8862B', paper = '#FFFFFF' } = {}): LockupShape[] {
  const out: LockupShape[] = STONES.map((s) => ({ d: s.d, fill: s.key ? blend(brass, '#ffffff', 0.08) : blend(pine, s.tone > 0.5 ? '#ffffff' : '#000000', s.tone > 0.5 ? (s.tone - 0.5) * 0.5 : (0.5 - s.tone) * 0.4) }));
  out.push({ d: KEYHOLE, fill: paper });
  for (const g of G.letters) out.push({ d: g.d, fill: ink, dx: TEXT_X });
  out.push({ d: G.notch, fill: brass, dx: TEXT_X });
  return out;
}

/** A standalone SVG string of the lockup at a given height (px). */
export function lockupSvg(height: number, colors?: Parameters<typeof lockupShapes>[0]) {
  const w = (height * LOCKUP_VB.w) / LOCKUP_VB.h;
  const body = lockupShapes(colors)
    .map((s) => `<path d="${s.d}" fill="${s.fill}"${s.dx ? ` transform="translate(${s.dx} 0)"` : ''}/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(1)}" height="${height}" viewBox="${LOCKUP_VB.x} ${LOCKUP_VB.y} ${LOCKUP_VB.w} ${LOCKUP_VB.h}">${body}</svg>`;
}
