import localFont from 'next/font/local';

/**
 * Fraunces, for the Keystone wordmark only (every other piece of text is Public Sans): the variable font
 * subset to the eight letters of "Keystone" (8 KB, all four axes: opsz, wght, SOFT, WONK), so the title card
 * can animate the weight axis live. Static places draw the same shapes as outlines (wordmarkGlyphs.ts).
 */
export const fraunces = localFont({
  src: './fonts/fraunces-keystone.woff2',
  weight: '100 900',
  display: 'block',
  preload: true,
  fallback: ['Georgia', 'serif'],
  adjustFontFallback: false,
});
export const WORDMARK_FVS = '"opsz" 144, "SOFT" 30, "WONK" 0';

/**
 * Display headlines (the landing): the same Fraunces instance as the wordmark (opsz 144, SOFT 30, WONK 0) with
 * a live weight axis 400–700, Latin only (30 KB). Exposed as the --font-display variable → `font-display`.
 */
export const frauncesDisplay = localFont({
  src: './fonts/fraunces-display.woff2',
  weight: '400 700',
  display: 'swap',
  preload: true,
  variable: '--font-fraunces',
  fallback: ['Georgia', 'serif'],
});
