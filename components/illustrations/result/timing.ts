import { ease } from '@/lib/motion';
import type { ReadinessResult } from '@/lib/types';

/** Time (0–1) at which a cubic-bezier easing first reaches progress p. Mirrors the Road's draw curve. */
function timeFor([x1, y1, x2, y2]: [number, number, number, number], p: number): number {
  const at = (t: number, a: number, b: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  const progressAt = (time: number) => {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid, x1, x2) < time) lo = mid;
      else hi = mid;
    }
    return at((lo + hi) / 2, y1, y2);
  };
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (progressAt(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// The Road's layout constants (components/result/Road.tsx): track padding, minimum width, marker spacing.
const PAD = 28;
const MIN_W = 280;
const GAP = 22;

/**
 * Where the Road puts the Keys marker (px from its left edge) at a given width. Mirrors the Road's
 * placement: months round up to the next 6 (minimum 12), markers keep 22px apart and are pushed back from
 * the right edge, so with clustered milestones Keys often sits at the very end of the track.
 */
export function keysX(result: ReadinessResult, width: number): number {
  const keysMonth = result.milestones.find((m) => m.key === 'keys')?.month ?? 9;
  const maxMonth = Math.max(12, Math.ceil((keysMonth + 1) / 6) * 6);
  const w = Math.max(MIN_W, Math.round(width));
  const usable = w - PAD * 2;
  const sorted = [...result.milestones].sort((a, b) => a.month - b.month);
  const xs: number[] = [];
  let lastX = -Infinity;
  for (const m of sorted) {
    let x = PAD + (Math.min(m.month, maxMonth) / maxMonth) * usable;
    if (x - lastX < GAP) x = lastX + GAP;
    lastX = x;
    xs.push(x);
  }
  if (lastX > w - PAD) for (let i = xs.length - 1, edge = w - PAD; i >= 0; i--, edge -= GAP) xs[i] = Math.min(xs[i], edge);
  const k = sorted.findIndex((m) => m.key === 'keys');
  return k >= 0 ? xs[k] : w - PAD;
}

/** When the Road's drawing line reaches the Keys marker (seconds from mount), so the Keys house builds as it appears. */
export function keysReachAt(result: ReadinessResult, drawDuration: number, width: number, drawEase: 'out' | 'inOut' = 'out', entranceDelay = 0): number {
  const usable = Math.max(MIN_W, Math.round(width)) - PAD * 2;
  const p = Math.min(1, Math.max(0, (keysX(result, width) - PAD) / usable));
  return entranceDelay + drawDuration * timeFor(drawEase === 'inOut' ? ease.inOut : ease.out, p);
}

/**
 * The Road's width inside the result/plan panel before it is mounted: the 560px column (20px gutters),
 * then the panel's 1px border and 20px padding on each side.
 */
export function panelRoadWidth(): number {
  if (typeof document === 'undefined') return MIN_W;
  return Math.min(560, document.documentElement.clientWidth) - 40 - 42;
}

/** "2027-08" shifted by k months, as an ISO month. */
export function shiftMonth(iso: string, k: number): string {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + k, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Plays an entrance once per browser session for a given key (the Road's own key for the result screen,
 * so the result and its Road agree). Read before the first effect runs; written after mount.
 */
export function readPlayed(key: string): boolean {
  try {
    return !!sessionStorage.getItem(key);
  } catch {
    return false;
  }
}
export function markPlayed(key: string) {
  try {
    sessionStorage.setItem(key, '1');
  } catch {}
}
