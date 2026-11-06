'use client';
// View Transitions for page and step changes. Every transition has a kind that picks its CSS:
//   forward / back: intake step slides (24px + crossfade, 280ms --ease-out); back reverses
//   start:  landing → intake ("Find my date" morphs into the progress bar), 250ms crossfade elsewhere
//   result: last intake step → result (the Road is the shared element)
//   fade:   anything → staff, a crisp 200ms fade
// Unsupported browsers or reduced motion: the update runs immediately and Motion handles the fallback.
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export type VTKind = 'forward' | 'back' | 'start' | 'result' | 'fade';

type VT = { finished: Promise<void>; ready: Promise<void>; updateCallbackDone: Promise<void> };
type DocVT = Document & { startViewTransition?: (cb: () => Promise<void> | void) => VT };

export function vtSupported(): boolean {
  if (typeof document === 'undefined') return false;
  if (!(document as DocVT).startViewTransition) return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Runs `update` inside a view transition of the given kind. Returns true if a transition ran. */
export function withViewTransition(kind: VTKind, update: () => void | Promise<void>): boolean {
  if (!vtSupported()) {
    void update();
    return false;
  }
  const html = document.documentElement;
  html.dataset.vt = kind;
  const t = (document as DocVT).startViewTransition!(async () => {
    await update();
  });
  // An aborted transition (e.g. a second click mid-animation) still applies the update; don't surface it as an error.
  t.ready.catch(() => {});
  t.updateCallbackDone.catch(() => {});
  t.finished
    .catch(() => {})
    .finally(() => {
      if (html.dataset.vt === kind) delete html.dataset.vt;
    });
  return true;
}

// Route changes: the transition waits until the new pathname has rendered.
let pendingRoute: (() => void) | null = null;
function waitForRoute(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      if (pendingRoute === done) pendingRoute = null;
      resolve();
    };
    pendingRoute = done;
    setTimeout(done, 1500); // never hold the page hostage
  });
}

export function useVTRouter() {
  const router = useRouter();
  return {
    push: (href: string, kind: VTKind = 'forward') => {
      if (!vtSupported()) return router.push(href);
      withViewTransition(kind, () => {
        const wait = waitForRoute();
        router.push(href);
        return wait;
      });
    },
  };
}

/** Mounted once in the root layout: resolves route transitions and reverses direction on browser back. */
export function RouteTransitions() {
  const pathname = usePathname();
  useEffect(() => {
    pendingRoute?.();
  }, [pathname]);
  useEffect(() => {
    const onPop = () => {
      if (!vtSupported()) return;
      withViewTransition('back', () => waitForRoute());
    };
    window.addEventListener('popstate', onPop, { capture: true });
    return () => window.removeEventListener('popstate', onPop, { capture: true });
  }, []);
  return null;
}
