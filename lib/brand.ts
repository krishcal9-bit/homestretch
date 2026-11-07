'use client';
import { useSyncExternalStore } from 'react';

/**
 * Where the Keystone wordmark lives right now. During the landing intro's title card it is on stage
 * ('title') and the header holds an invisible slot ([data-brand-slot]) of the exact final size; the title
 * flies onto that slot and then the header's own wordmark appears there ('header'). `fly` keeps the header
 * above the intro overlay while that happens; a skip sets 'header' directly with no flight.
 */
type Brand = { stage: 'title' | 'header'; fly: boolean };
let state: Brand = { stage: 'header', fly: false };
const subs = new Set<() => void>();
const SERVER: Brand = { stage: 'header', fly: false };
export const brand = {
  get: () => state,
  set(next: Brand) {
    state = next;
    subs.forEach((f) => f());
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
};
export function useBrand(): Brand {
  return useSyncExternalStore(brand.subscribe, brand.get, () => SERVER);
}
