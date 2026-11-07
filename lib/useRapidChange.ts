'use client';
import { useEffect, useRef } from 'react';

/**
 * True on the render where `value` changed again within `ms` of its previous change (a slider being
 * dragged through months). Swap animations use it to change instantly instead of stacking copies that
 * are still fading out.
 */
export function useRapidChange<T>(value: T, ms = 180): boolean {
  const last = useRef<{ value: T; at: number }>({ value, at: -Infinity });
  const rapid = value !== last.current.value && performance.now() - last.current.at < ms;
  useEffect(() => {
    last.current = { value, at: performance.now() };
  }, [value]);
  return rapid;
}
