/**
 * A small line-drawn house for the Homes list. It gets wider with each bedroom and shows one window per
 * bedroom, so a column of them reads at a glance. Static: drawn once, never animated.
 */
const H = 26;
const STROKE = 1.5;

export function HouseGlyph({ bedrooms }: { bedrooms: number }) {
  const b = Math.max(1, Math.min(6, Math.round(bedrooms)));
  const w = 18 + b * 7; // 2 bd = 32px, 5 bd = 53px
  const mid = w / 2;
  const left = 5;
  const right = w - 5;
  const floor = H - 1.75;
  // Windows: one per bedroom, evenly spaced along the wall above the door.
  const win = 3.5;
  const gap = (right - left - b * win) / (b + 1);
  const windows = Array.from({ length: b }, (_, i) => left + gap * (i + 1) + win * i);
  return (
    <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} fill="none" stroke="var(--pine)" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <path d={`M1.75 12 L${mid} 2.25 L${w - 1.75} 12`} />
      <path d={`M${left} 9.75 V${floor} H${right} V9.75`} />
      <path d={`M${mid - 2.75} ${floor} V18.25 H${mid + 2.75} V${floor}`} />
      {windows.map((x, i) => (
        <rect key={i} x={x} y={12.75} width={win} height={win} rx={0.5} />
      ))}
    </svg>
  );
}
