'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useState persisted to localStorage. Restores after mount (hydration-safe) and writes only when the
 * value actually changes afterwards, so restoring never clobbers what another tab or script just wrote.
 */
export function useStored<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const lastWritten = useRef<string | null>(null);
  useEffect(() => {
    let restored = initial;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        restored = initial && typeof initial === 'object' && !Array.isArray(initial) ? ({ ...initial, ...parsed } as T) : (parsed as T);
        setValue(restored);
      }
    } catch {}
    lastWritten.current = JSON.stringify(restored);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    const json = JSON.stringify(value);
    if (json === lastWritten.current) return;
    lastWritten.current = json;
    try {
      localStorage.setItem(key, json);
    } catch {}
  }, [key, value, ready]);
  const set = useCallback((v: T | ((p: T) => T)) => setValue(v), []);
  return [value, set, ready];
}
