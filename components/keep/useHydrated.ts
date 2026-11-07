'use client';
import { useSyncExternalStore } from 'react';

const noop = () => () => {};
/** False on the server and during hydration, true after: Keep reads the family's data from this device only. */
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
