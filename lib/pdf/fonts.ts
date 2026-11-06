import path from 'path';
import { Font } from '@react-pdf/renderer';

let registered = false;
/** Public Sans for PDFs (woff from @fontsource). Falls back to Helvetica if registration fails. */
export function registerFonts(): string {
  if (registered) return 'Public Sans';
  try {
    const dir = path.join(process.cwd(), 'node_modules/@fontsource/public-sans/files');
    Font.register({
      family: 'Public Sans',
      fonts: [
        { src: path.join(dir, 'public-sans-latin-400-normal.woff'), fontWeight: 400 },
        { src: path.join(dir, 'public-sans-latin-600-normal.woff'), fontWeight: 600 },
      ],
    });
    Font.registerHyphenationCallback((w) => [w]);
    registered = true;
    return 'Public Sans';
  } catch {
    return 'Helvetica';
  }
}
