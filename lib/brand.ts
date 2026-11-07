'use client';
import { useSyncExternalStore } from 'react';

/**
 * Where the HomeStretch wordmark lives right now. During the landing intro's title card it is on stage
 * ('title') and the header holds an invisible placeholder; when the card ends it moves to the header
 * ('header'). `fly` makes the header wordmark take the shared-element flight (Motion layoutId) from the
 * title card; a skip sets the header directly with no flight.
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
export const BRAND_LAYOUT_ID = 'brand-wordmark';
