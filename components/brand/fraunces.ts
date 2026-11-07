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
