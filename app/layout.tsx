import type { Metadata, Viewport } from 'next';
import '@fontsource/public-sans/400.css';
import { frauncesDisplay } from '@/components/brand/fraunces';
import '@fontsource/public-sans/500.css';
import '@fontsource/public-sans/600.css';
import { cookies } from 'next/headers';
import './globals.css';
import { Providers } from './providers';
import type { Lang } from '@/lib/types';
import { THEME_COLOR, THEME_SCRIPT } from '@/lib/themeScript';
import { PALETTE_CSS } from '@/lib/illustrationPalette';


export const metadata: Metadata = {
  title: 'Keystone · Homeownership that holds.',
  description: 'Homeownership that holds. Keystone helps Habitat families get mortgage-ready, then keep their home as insurance and taxes rise.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // follows the system setting; an explicit choice rewrites both (lib/theme.ts)
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: THEME_COLOR.light },
    { media: '(prefers-color-scheme: dark)', color: THEME_COLOR.dark },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const c = await cookies();
  const lang: Lang = c.get('hs_lang')?.value === 'es' ? 'es' : 'en';
  return (
    <html lang={lang} suppressHydrationWarning className={frauncesDisplay.variable}>
      <head>
        {/* Theme before first paint: the stored choice or the system setting goes on <html data-theme>, so the
            wrong theme never flashes. suppressHydrationWarning on <html> covers the attributes it adds. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* The illustration palette's day and night colours (lib/illustrationPalette.ts), one source. */}
        <style id="il-palette" dangerouslySetInnerHTML={{ __html: PALETTE_CSS }} />
        {/* Every load of /: veil the page in --paper before first paint so the opening starts blank.
            Never with reduced motion or without JS; the opening removes the veil as soon as it mounts. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(location.pathname==='/'&&!sessionStorage.getItem('hs.nointro')&&location.search.indexOf('nointro')<0&&!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('hs-veil');setTimeout(function(){document.documentElement.classList.remove('hs-veil')},4500)}}catch(e){}`,
          }}
        />
      </head>
      <body>
        <Providers lang={lang}>{children}</Providers>
      </body>
    </html>
  );
}
