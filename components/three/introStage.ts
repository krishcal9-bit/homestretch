'use client';
import { useSyncExternalStore } from 'react';

/**
 * The hand-off between the landing intro and the hero's house: ONE canvas serves both. During the film the
 * hero's house canvas lives on the intro's stage (full screen, under the title card, blurred with it); at the
 * end it moves into its slot on the hero's Road (same pixels, same size, same house), and stays there.
 *
 * mode: what the intro is playing — 'pending' (waiting for the 3D first frame), '3d', 'still' (no WebGL or
 * too slow: the intro flies a still image instead), 'none' (no intro / finished / skipped).
 */
export type IntroStageMode = 'none' | 'pending' | '3d' | 'still';
type State = { stage: HTMLElement | null; mode: IntroStageMode; firstFrame: boolean };
let state: State = { stage: null, mode: 'none', firstFrame: false };
const SERVER: State = state;
const subs = new Set<() => void>();
let docker: (() => void) | null = null;
export type ArchRect = { left: number; top: number; width: number; height: number };
const archSubs = new Set<(r: ArchRect) => void>();

export const introStage = {
  get: () => state,
  set(patch: Partial<State>) {
    state = { ...state, ...patch };
    subs.forEach((f) => f());
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => {
      subs.delete(f);
    };
  },
  /** The hero house registers how it docks (move the canvas into its slot, resize, render — one task). */
  setDocker(f: (() => void) | null) {
    docker = f;
  },
  /** The film's arch has left the frame (the camera is in its opening): its projected rect, for the 2D arch. */
  archOut(r: ArchRect) {
    archSubs.forEach((f) => f(r));
  },
  onArchOut(f: (r: ArchRect) => void) {
    archSubs.add(f);
    return () => {
      archSubs.delete(f);
    };
  },
  /** Called by the intro at the end of the film, synchronously, before the overlay goes away. */
  dock() {
    docker?.();
    performance.mark?.('hs-dock');
  },
};

export function useIntroStage(): State {
  return useSyncExternalStore(introStage.subscribe, introStage.get, () => SERVER);
}
