'use client';
import { useMemo, useRef, useState } from 'react';
import { useAnimate } from 'motion/react';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { PaperSheet, PAD_BOTTOM, PAD_TOP } from '@/components/illustrations/result/PaperSheet';
import { useLang } from '@/lib/i18n';
import { ease } from '@/lib/motion';
import { buildReferral, ORG_NAME, type ReferralOrg } from '@/lib/referral';
import type { Lang, Profile } from '@/lib/types';

/** The one-page summary the counselor receives, written onto paper line by line (every line on the 24px rule). */
function PacketSheet({ profile, org, lang, code, onWritten }: { profile: Profile; org: ReferralOrg; lang: Lang; code?: string; onWritten: () => void }) {
  const { t } = useLang();
  const p = useMemo(() => buildReferral({ profile, org, lang, code }), [profile, org, lang, code]);
  const rows = p.household.filter((_, i) => [0, 1, 2, 4, 5].includes(i));
  const row = 'flex items-baseline justify-between gap-4 text-[13px] leading-[24px]';
  return (
    <PaperSheet minLines={6} onWritten={onWritten} testId="packet-sheet">
      <div className="px-5" style={{ paddingTop: PAD_TOP, paddingBottom: PAD_BOTTOM }}>
        <p className="text-[15px] font-semibold leading-[24px] text-ink">{p.title}</p>
        <p className="tnum text-[13px] leading-[24px] text-ink-2">{code ? `${t('plan.planFor', { code })} · ${p.generated}` : p.generated}</p>
        <p className="mt-[24px] text-[13px] leading-[24px] text-ink-2">{p.readyLabel}</p>
        <p className="tnum text-[20px] font-semibold leading-[24px] text-brass">{p.readyDate}</p>
        <p className="mt-[24px] text-[13px] font-semibold leading-[24px] text-ink">{p.labels.household}</p>
        {rows.map((r) => (
          <p key={r.label} className={row}>
            <span className="text-ink-2">{r.label}</span>
            <span className="tnum whitespace-nowrap text-ink">{r.value}</span>
          </p>
        ))}
        <p className="mt-[24px] text-[13px] font-semibold leading-[24px] text-ink">{p.labels.blockers}</p>
        {p.blockers.slice(0, 2).map((b) => (
          <p key={b} className="tnum flex gap-2 text-[13px] leading-[24px] text-ink">
            <span aria-hidden className="text-ink-2">–</span>
            <span>{b}</span>
          </p>
        ))}
        <p className="mt-[24px] text-[13px] font-semibold leading-[24px] text-ink">{p.labels.timeline}</p>
        {p.timeline.map((m) => (
          <p key={m.label} className={row}>
            <span className="text-ink-2">{m.label}</span>
            <span className="tnum whitespace-nowrap text-ink">{m.date}</span>
          </p>
        ))}
      </div>
    </PaperSheet>
  );
}

/** D5: "Send my plan to a counselor" panel for the family result screen. */
export function CounselorHandoff({ profile, code, lang }: { profile: Profile; code?: string; lang: Lang }) {
  const { t } = useLang();
  const toast = useToast();
  const [org, setOrg] = useState<ReferralOrg>('sparkpoint');
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The packet sheet appears on the first send and is written once; the toast waits for both.
  const [sheet, setSheet] = useState(0);
  const pending = useRef<{ sent: boolean; written: boolean; name: string } | null>(null);
  const [pulseScope, pulse] = useAnimate<HTMLSpanElement>();
  const name = ORG_NAME[org];

  const finish = () => {
    const p = pending.current;
    if (!p || !p.sent || !p.written) return;
    pending.current = null;
    toast(t('handoff.sent', { org: p.name }));
    if (pulseScope.current) pulse(pulseScope.current, { scale: [1, 1.04, 1] }, { duration: 0.4, ease: ease.out });
  };

  async function send() {
    setSending(true);
    setError(null);
    pending.current = { sent: false, written: sheet > 0, name };
    if (sheet === 0) setSheet(1);
    try {
      const res = await fetch('/api/referral/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ org, lang, code, profile }) });
      if (!res.ok) throw new Error();
      if (pending.current) pending.current.sent = true;
      finish();
    } catch {
      pending.current = null;
      setError(t('handoff.error'));
    }
    setSending(false);
  }

  async function downloadUnsaved() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch('/api/referral', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile, org, lang }) });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `referral-${org}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError(t('handoff.error'));
    }
    setDownloading(false);
  }

  return (
    <section className="panel mt-10" aria-labelledby="handoff-title" data-testid="counselor-handoff">
      <h2 id="handoff-title" className="t-section">
        {t('handoff.title')}
      </h2>
      <p className="mt-1 text-[15px] text-ink-2">{t('handoff.sub')}</p>
      <div className="mt-4">
        <Segmented<ReferralOrg>
          label={t('handoff.choose')}
          value={org}
          onChange={setOrg}
          options={[
            { value: 'sparkpoint', label: ORG_NAME.sparkpoint },
            { value: 'hope', label: ORG_NAME.hope },
          ]}
        />
        <p className="mt-2 text-[13px] leading-[18px] text-ink-2">{t(org === 'sparkpoint' ? 'handoff.sparkpoint' : 'handoff.hope')}</p>
      </div>
      {sheet > 0 && (
        <div className="mt-4">
          <PacketSheet
            profile={profile}
            org={org}
            lang={lang}
            code={code}
            onWritten={() => {
              if (pending.current) pending.current.written = true;
              finish();
            }}
          />
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={send} loading={sending}>
          {t('handoff.send', { org: name })}
        </Button>
        <span ref={pulseScope} className="inline-block">
          {code ? (
            <a
              href={`/api/referral/${encodeURIComponent(code)}?org=${org}&lang=${lang}`}
              className="press inline-flex min-h-[44px] items-center rounded-[8px] px-3 text-[15px] font-medium text-pine hover:bg-pine-soft"
              target="_blank"
              rel="noopener"
            >
              {t('handoff.download')}
            </a>
          ) : (
            <Button variant="quiet" onClick={downloadUnsaved} loading={downloading}>
              {t('handoff.download')}
            </Button>
          )}
        </span>
      </div>
      <p role="alert" className="mt-2 min-h-[18px] text-[13px] leading-[18px] text-signal-red">
        {error}
      </p>
    </section>
  );
}
