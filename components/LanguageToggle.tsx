'use client';
import { useLang } from '@/lib/i18n';
import { Segmented } from './ui/Segmented';
import type { Lang } from '@/lib/types';

export function LanguageToggle() {
  const { lang, setLang, t } = useLang();
  return (
    <div className="w-[112px]" data-testid="lang-toggle">
      <Segmented<Lang>
        size="sm"
        label={t('app.language')}
        value={lang}
        onChange={setLang}
        options={[
          { value: 'en', label: 'EN' },
          { value: 'es', label: 'ES' },
        ]}
      />
    </div>
  );
}
