import Link from 'next/link';
import { cookies } from 'next/headers';
import { FamilyHeader } from '@/components/FamilyHeader';
import { translate } from '@/lib/i18n-core';
import type { Lang } from '@/lib/types';

/** Any unknown route: the family header (language and theme stay at hand) and one way back. */
export default async function NotFound() {
  const c = await cookies();
  const lang: Lang = c.get('hs_lang')?.value === 'es' ? 'es' : 'en';
  return (
    <>
      <FamilyHeader />
      <main id="main" className="mx-auto max-w-[560px] px-5 pb-16">
        <section className="pt-16" data-testid="not-found">
          <h1 className="t-title text-ink">{translate(lang, 'app.notFoundTitle')}</h1>
          <p className="mt-3 text-ink-2">{translate(lang, 'app.notFound')}</p>
          <Link href="/" className="press mt-8 inline-flex min-h-[48px] items-center rounded-[8px] bg-pine px-5 font-medium text-on-pine hover:bg-pine-hover">
            {translate(lang, 'app.notFoundCta')}
          </Link>
        </section>
      </main>
    </>
  );
}
