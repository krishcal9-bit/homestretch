'use client';
// The family's KEEP data, on their device only (localStorage 'hs.keep'): their home profile, which fields came from
// a document, the Shock Shield moves they've done, reliefs claimed, check-ins and the savings goal. Shared by every
// /keep screen. Nothing here is sent to Habitat unless the family sends a message themselves.
import { useCallback, useSyncExternalStore } from 'react';
import { EMPTY_KEEP, type KeepProfile } from './keep';
import { demoFamily } from './seedHomeowners';

export type FieldSource = 'document' | 'typed';
export type Checkin = { date: string; newBills: boolean; incomeChange: number; breaking: string | null; note?: string };
export type KeepState = {
  profile: KeepProfile;
  /** which profile fields were read from a document (shown with a "From your document" tag) */
  sources: Partial<Record<keyof KeepProfile, FieldSource>>;
  /** Shock Shield move keys the family marked done */
  movesDone: string[];
  /** Relief Finder item ids marked done */
  reliefDone: string[];
  /** created from "Set aside early" */
  savingsGoal: { monthly: number; created: string } | null;
  checkins: Checkin[];
  /** set up from the sample Ramirez family */
  demo: boolean;
  /** finished the 2-minute setup */
  ready: boolean;
};

const KEY = 'hs.keep';
export const EMPTY_STATE: KeepState = { profile: EMPTY_KEEP, sources: {}, movesDone: [], reliefDone: [], savingsGoal: null, checkins: [], demo: false, ready: false };

let cache: KeepState | null = null;
const subs = new Set<() => void>();
function read(): KeepState {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...EMPTY_STATE, ...JSON.parse(raw), profile: { ...EMPTY_KEEP, ...JSON.parse(raw).profile } } : EMPTY_STATE;
  } catch {
    cache = EMPTY_STATE;
  }
  return cache!;
}
function write(next: KeepState) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  subs.forEach((f) => f());
}
function subscribe(f: () => void) {
  subs.add(f);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      f();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    subs.delete(f);
    window.removeEventListener('storage', onStorage);
  };
}

/** The family's Keep state (EMPTY_STATE on the server and before setup). */
export function useKeep(): [KeepState, (u: Partial<KeepState> | ((s: KeepState) => KeepState)) => void] {
  const state = useSyncExternalStore(subscribe, read, () => EMPTY_STATE);
  const update = useCallback((u: Partial<KeepState> | ((s: KeepState) => KeepState)) => {
    const cur = read();
    write(typeof u === 'function' ? u(cur) : { ...cur, ...u });
  }, []);
  return [state, update];
}

/** Update profile fields, marking where they came from. */
export function patchProfile(s: KeepState, patch: Partial<KeepProfile>, source: FieldSource = 'typed'): KeepState {
  const sources = { ...s.sources };
  for (const k of Object.keys(patch) as (keyof KeepProfile)[]) sources[k] = source;
  return { ...s, profile: { ...s.profile, ...patch }, sources };
}

/** Start from the sample Ramirez family (Santa Ana, FAIR Plan, renewal in March). */
export function demoState(now = new Date()): KeepState {
  const d = demoFamily(now);
  return { ...EMPTY_STATE, profile: d.profile, demo: true, ready: true };
}

export function resetKeep() {
  write(EMPTY_STATE);
}
