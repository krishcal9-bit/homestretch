import type { Metadata, Viewport } from 'next';
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/500.css';
import '@fontsource/public-sans/600.css';
import { cookies } from 'next/headers';
import './globals.css';
import { Providers } from './providers';
import type { Lang } from '@/lib/types';


export const metadata: Metadata = {
  title: 'Homestretch · Habitat OC',
  description: 'How far is your family from keys, and exactly what closes the gap.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#F6F7F5' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const c = await cookies();
  const lang: Lang = c.get('hs_lang')?.value === 'es' ? 'es' : 'en';
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        {/* First visit in a session on /: veil the page in --paper before first paint so the opening starts blank.
            Never with reduced motion or without JS; the opening removes the veil as soon as it mounts. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(location.pathname==='/'&&!sessionStorage.getItem('hs.opened')&&!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('hs-veil');setTimeout(function(){document.documentElement.classList.remove('hs-veil')},4000)}}catch(e){}`,
          }}
        />
      </head>
      <body>
        <Providers lang={lang}>{children}</Providers>
      </body>
    </html>
  );
}
