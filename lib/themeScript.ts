// Server-safe theme constants and the pre-paint script (no React, no 'use client': the root layout inlines it).
// The client side (useTheme, setTheme, the switch animation) lives in lib/theme.ts.

export type Theme = 'light' | 'dark';

/** localStorage key for an explicit choice. No key = follow the system setting, live. */
export const THEME_KEY = 'hs.theme';

/** The browser chrome colour per theme (= --paper). */
export const THEME_COLOR: Record<Theme, string> = { light: '#F6F7F5', dark: '#0F1513' };

/**
 * Runs in <head> before first paint: the stored choice, else the system setting, goes on <html> as
 * data-theme (which every token keys on) and color-scheme (form controls, scrollbars). Never throws.
 */
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement,s=null;try{s=localStorage.getItem('${THEME_KEY}')}catch(e){}var t=s==='dark'||s==='light'?s:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');d.setAttribute('data-theme',t);d.style.colorScheme=t}catch(e){}})()`;
