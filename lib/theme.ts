'use client';
// Light and dark mode. The theme lives on <html data-theme> (set before first paint by THEME_SCRIPT in the
// root layout); every token in app/globals.css and every illustration colour (lib/illustrationPalette.ts)
// keys on it, so a switch is one attribute change and no React re-render.
//   useTheme()  — the current theme, from the attribute (useSyncExternalStore)
//   setTheme(t) — remember an explicit choice (localStorage 'hs.theme') and switch
// With no stored choice the page follows prefers-color-scheme, live. Another tab's choice syncs too.
// A switch crossfades the whole page in a View Transition (600ms, see the r6:theme block in globals.css);
// reduced motion or no View Transitions: instant. Canvases listen for the 'hs:theme' window event
// (detail: { theme, instant }) to tween their own lights.
import { useSyncExternalStore } from 'react';
import { THEME_COLOR, THEME_KEY, type Theme } from './themeScript';
import { vtSupported, withViewTransition } from './vt';

export type { Theme };
export const THEME_EVENT = 'hs:theme';
export type ThemeEventDetail = { theme: Theme; instant: boolean };

/** The theme on <html> right now (for canvases and other non-React readers). */
export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function stored(): Theme | null {
  try {
    const s = localStorage.getItem(THEME_KEY);
    return s === 'dark' || s === 'light' ? s : null;
  } catch {
    return null;
  }
}

function system(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function paint(theme: Theme) {
  const html = document.documentElement;
  html.dataset.theme = theme;
  html.style.colorScheme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', THEME_COLOR[theme]));
}

/** Switches to `theme` (animated unless reduced motion / no View Transitions) and tells the canvases. */
function apply(theme: Theme) {
  if (getTheme() === theme) return;
  const instant = !vtSupported();
  withViewTransition('theme', () => {
    paint(theme);
    window.dispatchEvent(new CustomEvent<ThemeEventDetail>(THEME_EVENT, { detail: { theme, instant } }));
  });
}

/** Remembers an explicit choice and switches to it. */
export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  apply(theme);
}

/** Forgets the explicit choice: the page follows the system setting again. */
export function clearTheme() {
  try {
    localStorage.removeItem(THEME_KEY);
  } catch {}
  apply(system());
}

// One set of global listeners, attached with the first subscriber: the system setting (when no choice is
// stored) and other tabs' choices.
let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!stored()) apply(system());
  });
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_KEY) apply(stored() ?? system());
  });
  // the theme-color meta tags may have been parsed after the pre-paint script
  paint(getTheme());
}

function subscribe(cb: () => void) {
  wire();
  window.addEventListener(THEME_EVENT, cb);
  return () => window.removeEventListener(THEME_EVENT, cb);
}

/** The current theme. 'light' while rendering on the server (the attribute is the truth once hydrated). */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => 'light');
}
