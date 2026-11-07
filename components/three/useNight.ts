'use client';
import { useSyncExternalStore } from 'react';

/**
 * 1 while the page is in the dark theme (night scenes), else 0 — read from <html data-theme>, which the
 * theme's pre-paint script sets before first paint and the toggle changes. The 3D house tweens its light to it.
 */
function subscribe(f: () => void) {
  const mo = new MutationObserver(f);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => mo.disconnect();
}
const get = () => (document.documentElement.dataset.theme === 'dark' ? 1 : 0);
export function useNight(): number {
  return useSyncExternalStore(subscribe, get, () => 0);
}
