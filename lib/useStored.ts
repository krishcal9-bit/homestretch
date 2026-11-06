'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** useState persisted to localStorage. Restores after mount to stay hydration-safe. */
export function useStored<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        setValue(initial && typeof initial === 'object' && !Array.isArray(initial) ? ({ ...initial, ...parsed } as T) : (parsed as T));
      }
    } catch {}
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value, ready]);
  const set = useCallback((v: T | ((p: T) => T)) => setValue(v), []);
  return [value, set, ready];
}
