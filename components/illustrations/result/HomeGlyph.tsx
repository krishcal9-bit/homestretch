/**
 * A tiny line drawing of an upcoming Habitat home, shaped by its size: a cottage for two bedrooms, a wider
 * house for three, two storeys for four or more. Stroke 1.5px pine; the door fills brass once it's chosen.
 */
const SHAPES = {
  cottage: { body: 'M7 24V13L16 5L25 13V24', door: [14, 17, 4, 7], windows: [[9.5, 15.5, 3, 3]] },
  wide: { body: 'M3 24V13L16 4L29 13V24', door: [14, 17, 4, 7], windows: [[6.5, 15.5, 4, 3.5], [21.5, 15.5, 4, 3.5]] },
  tall: { body: 'M6 24V10L16 2L26 10V24', door: [14, 18, 4, 6], windows: [[14, 10.5, 4, 3.5], [8.5, 18.5, 3.5, 3], [20, 18.5, 3.5, 3]] },
} as const;

export function HomeGlyph({ bedrooms, size = 28, brass = false, className = '' }: { bedrooms: number; size?: number; brass?: boolean; className?: string }) {
  const s = SHAPES[bedrooms <= 2 ? 'cottage' : bedrooms === 3 ? 'wide' : 'tall'];
  const [dx, dy, dw, dh] = s.door;
  const line = { fill: 'none', stroke: 'var(--pine)', strokeWidth: 1.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const, vectorEffect: 'non-scaling-stroke' as const };
  return (
    <svg width={size} height={(size * 26) / 32} viewBox="0 0 32 26" aria-hidden className={`block shrink-0 overflow-visible ${className}`}>
      <path d="M1 24H31" stroke="var(--line)" strokeWidth={1.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={s.body} {...line} fill="var(--surface)" />
      {s.windows.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} {...line} />
      ))}
      <rect x={dx} y={dy} width={dw} height={dh} {...line} fill={brass ? 'var(--brass)' : 'var(--surface)'} stroke={brass ? 'var(--brass)' : 'var(--pine)'} />
    </svg>
  );
}
