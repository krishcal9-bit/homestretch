
import { ROAD_MIN_W as MIN_W } from '@/components/result/Road';

/**
 * keysReachAt: when the Road's drawing line reaches the Keys marker (so a screen can time its date and the
 * Keys house build to it). keysX: where the Road puts Keys. Both come from the Road's own marker placement.
 */
export { keysReachAt, keysXAt as keysX } from '@/components/result/Road';

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
