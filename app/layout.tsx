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
    <html lang={lang}>
      <body>
        <Providers lang={lang}>{children}</Providers>
      </body>
    </html>
  );
}
