'use client';
// KEEP · Home health (/keep/home): the family's major systems, when each will likely need replacing in the next
// five years, and ONE monthly set-aside that covers them all (lib/forecast maintenanceSetAside). A photo of a data
// plate (or typed facts) fills a system's age; "Something leaking?" gives safe first steps.
import { AnimatePresence, motion } from 'motion/react';
import { Camera, Droplets, Fan, House, Image as ImageIcon, Refrigerator, Trash2, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { money } from '@/lib/format';
import { dur, ease, exit as exitT, reveal, spring, stagger } from '@/lib/motion';
import { patchProfile, type KeepState } from '@/lib/keepStore';
import { SYSTEM_DEFAULTS, type HomeSystem, type KeepProfile, type SystemKind } from '@/lib/keep';
import { fallbackHelp, HORIZON_YEARS, makeSystem, repairSummary, SYSTEM_KINDS, upsertSystem, type Help, type HomeHealthResult } from '@/lib/homeHealth';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Stepper } from '@/components/ui/Stepper';
import { KeepGate, KeepHead } from './KeepFrame';

type Update = (u: Partial<KeepState> | ((s: KeepState) => KeepState)) => void;

export const KIND_ICON: Record<SystemKind, typeof Droplets> = { water_heater: Droplets, roof: House, hvac: Fan, appliances: Refrigerator, other: Wrench };

export function HomeHealth() {
  const { t } = useLang();
  return (
    <KeepGate>
      {(state, update) => (
        <>
          <KeepHead title={t('keepHome.title')} sub={t('keepHome.sub')} />
          <HomeHealthBody profile={state.profile} update={update} />
        </>
      )}
    </KeepGate>
  );
}

function HomeHealthBody({ profile, update }: { profile: KeepProfile; update: Update }) {
  const setSystems = (systems: HomeSystem[]) => update((s) => patchProfile(s, { systems }));
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
      {/* on phones the set-aside and the leak help come first; on wide screens they sit in the right column */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1 lg:self-start">
        <SetAside profile={profile} />
        <LeakHelp profile={profile} />
      </aside>
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        <RepairTimeline profile={profile} />
        <SystemsList systems={profile.systems} onChange={setSystems} />
        <AddSystem systems={profile.systems} onSave={(s) => setSystems(upsertSystem(profile.systems, s))} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The one number                                                       */
/* ------------------------------------------------------------------ */

function SetAside({ profile }: { profile: KeepProfile }) {
  const { t, lang } = useLang();
  const sum = useMemo(() => repairSummary(profile), [profile]);
  const $ = (n: number) => money(n, lang);
  return (
    <section className="panel !p-5" aria-labelledby="setaside-title" data-testid="set-aside">
      <h2 id="setaside-title" className="text-[15px] font-medium text-ink-2">
        {t('keepHome.setAsideTitle')}
      </h2>
      <p className="mt-1 flex items-baseline gap-1.5 text-ink">
        <AnimatedNumber value={sum.monthly} format={(n) => $(n)} className="text-[40px] font-semibold leading-[44px] tracking-[-0.01em]" />
        <span className="text-[16px] text-ink-2">{t('keepHome.perMonth')}</span>
      </p>
      <p className="mt-2 text-[15px] leading-[22px] text-ink-2">
        {profile.systems.length ? t('keepHome.setAsideCovers', { n: profile.systems.length }) : t('keepHome.setAsideNoSystems')}
      </p>
      <dl className="mt-4 divide-y divide-line border-t border-line text-[15px]">
        <div className="flex items-baseline justify-between gap-4 py-3">
          <dt className="text-ink-2">{t('keepHome.savingsNow')}</dt>
          <dd className="tnum font-medium text-ink" data-testid="repair-savings">
            {$(sum.savings)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-3">
          <dt className="text-ink-2">{t('keepHome.dueFiveYears')}</dt>
          <dd className="tnum font-medium text-ink">{sum.due.length ? `${$(sum.low)}–${$(sum.high)}` : $(0)}</dd>
        </div>
      </dl>
      {sum.nextDue && (
        <p className={`mt-1 border-l-2 pl-3 text-[15px] leading-[22px] ${sum.nextGap > 0 ? 'border-signal-amber text-ink' : 'border-pine text-ink'}`}>
          {sum.nextGap > 0 && sum.nextDue.inYears === 0
            ? t('keepHome.gapNow', { system: t(`keepHome.kindIn.${sum.nextDue.system.kind}`), gap: $(sum.nextGap) })
            : sum.nextGap > 0
            ? t('keepHome.gap', { system: t(`keepHome.kindIn.${sum.nextDue.system.kind}`), year: sum.nextDue.dueYear, gap: $(sum.nextGap) })
            : t('keepHome.covered', { system: t(`keepHome.kindIn.${sum.nextDue.system.kind}`) })}
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The next five years                                                  */
/* ------------------------------------------------------------------ */

function RepairTimeline({ profile }: { profile: KeepProfile }) {
  const { t, lang } = useLang();
  const sum = useMemo(() => repairSummary(profile), [profile]);
  const year = new Date().getFullYear();
  const years = Array.from({ length: HORIZON_YEARS + 1 }, (_, i) => year + i);
  const $ = (n: number) => money(n, lang);
  return (
    <section aria-labelledby="timeline-title">
      <h2 id="timeline-title" className="t-section text-ink">
        {t('keepHome.timelineTitle')}
      </h2>
      <p className="mt-1 text-[15px] text-ink-2">{t('keepHome.timelineSub')}</p>
      {sum.items.length === 0 ? (
        <p className="mt-4 border-l-2 border-line pl-3 text-[15px] text-ink-2">{t('keepHome.timelineEmpty')}</p>
      ) : (
        <div className="mt-5" data-testid="repair-timeline">
          {/* year scale (decorative; each row says its year in words) */}
          <div className="ml-0 grid grid-cols-[minmax(0,1fr)] sm:ml-[148px]" aria-hidden>
            <div className="relative h-5">
              {years.map((y, i) => (
                <span key={y} className="tnum absolute top-0 text-[13px] text-ink-2" style={{ left: `${(i / HORIZON_YEARS) * 100}%`, translate: i === 0 ? '0' : i === HORIZON_YEARS ? '-100%' : '-50%' }}>
                  {i === 0 ? (
                    t('keepHome.now')
                  ) : (
                    <>
                      <span className="sm:hidden">{`’${String(y).slice(2)}`}</span>
                      <span className="max-sm:hidden">{y}</span>
                    </>
                  )}
                </span>
              ))}
            </div>
          </div>
          <ol className="mt-2 divide-y divide-line border-y border-line">
            {sum.items.map((it, i) => {
              const Icon = KIND_ICON[it.system.kind];
              const pos = Math.min(1, it.inYears / HORIZON_YEARS);
              const urgent = it.inYears <= 1;
              const label = it.system.label || t(`keepHome.kind.${it.system.kind}`);
              const when = it.inYears === 0 ? t('keepHome.dueNow') : it.soon ? t('keepHome.dueIn', { year: it.dueYear }) : t('keepHome.dueLater', { year: it.dueYear });
              return (
                <li key={it.system.id} className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-[148px_minmax(0,1fr)] sm:items-center sm:gap-0" data-testid="timeline-row">
                  <div className="flex items-center gap-2 pr-3">
                    <Icon size={18} strokeWidth={1.75} className="shrink-0 text-ink-2" aria-hidden />
                    <span className="truncate text-[15px] font-medium text-ink">{label}</span>
                  </div>
                  <div>
                    <div className="relative h-6" aria-hidden>
                      <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
                      {years.map((y, k) => (
                        <span key={y} className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-line-strong" style={{ left: `${(k / HORIZON_YEARS) * 100}%` }} />
                      ))}
                      {it.soon && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ ...spring.snappy, delay: Math.min(i, 5) * stagger }}
                          className={`absolute top-1/2 -mt-[7px] h-[14px] w-[14px] rounded-full border-2 ${urgent ? 'border-signal-amber bg-surface' : 'border-pine bg-pine'}`}
                          style={{ left: `clamp(0px, calc(${pos * 100}% - 7px), calc(100% - 14px))` }}
                        />
                      )}
                    </div>
                    <p className="tnum mt-1 flex flex-wrap justify-between gap-x-4 text-[13px] leading-[18px]">
                      <span className={urgent ? 'font-medium text-signal-amber' : 'text-ink-2'}>{when}</span>
                      <span className="text-ink-2">{t('keepHome.costRange', { low: $(it.system.costLow), high: $(it.system.costHigh) })}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* What's in the home                                                   */
/* ------------------------------------------------------------------ */

function SourceTag({ s }: { s: HomeSystem }) {
  const { t } = useLang();
  const from = s.source === 'photo' ? t('keepHome.fromPhoto') : s.source === 'default' ? t('keepHome.fromTypical') : t('keepHome.fromYou');
  const conf = s.confidence ? t(`keepHome.confidence.${s.confidence}`) : '';
  return (
    <span className="t-helper block text-ink-2">
      <span className="whitespace-nowrap">{from}</span>
      {conf ? <span className="whitespace-nowrap">{` · ${conf}`}</span> : null}
    </span>
  );
}

function SystemsList({ systems, onChange }: { systems: HomeSystem[]; onChange: (s: HomeSystem[]) => void }) {
  const { t } = useLang();
  if (!systems.length) return null;
  return (
    <section className="mt-12" aria-labelledby="systems-title">
      <h2 id="systems-title" className="t-section text-ink">
        {t('keepHome.systemsTitle')}
      </h2>
      <p className="mt-1 text-[15px] text-ink-2">{t('keepHome.systemsSub')}</p>
      <ul className="panel mt-4 divide-y divide-line !p-0" data-testid="systems">
        <AnimatePresence initial={false}>
          {systems.map((s) => {
            const Icon = KIND_ICON[s.kind];
            const label = s.label || t(`keepHome.kind.${s.kind}`);
            return (
              <motion.li key={s.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: exitT }} transition={{ duration: dur.short, ease: ease.out }} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4" data-testid={`system-${s.kind}`}>
                <div className="flex min-w-[180px] flex-1 items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-pine-soft text-pine">
                    <Icon size={18} strokeWidth={1.75} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[16px] font-medium text-ink">{label}</p>
                    <p className="tnum text-[13px] leading-[18px] text-ink-2">{t('keepHome.lasts', { n: s.lifeYears })}</p>
                    <SourceTag s={s} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor={`age-${s.id}`} className="text-[13px] text-ink-2">
                    {t('keepHome.ageLabel')}
                  </label>
                  <Stepper
                    id={`age-${s.id}`}
                    value={Math.round(s.ageYears)}
                    min={0}
                    max={80}
                    decLabel={t('keepHome.ageLess', { system: label })}
                    incLabel={t('keepHome.ageMore', { system: label })}
                    onChange={(n) => onChange(systems.map((x) => (x.id === s.id ? { ...x, ageYears: n, source: 'typed', confidence: 'high' } : x)))}
                  />
                  <button
                    type="button"
                    onClick={() => onChange(systems.filter((x) => x.id !== s.id))}
                    aria-label={t('keepHome.remove', { system: label })}
                    className="press flex h-11 w-11 items-center justify-center rounded-[8px] text-ink-2 hover:bg-paper hover:text-signal-red"
                  >
                    <Trash2 size={18} strokeWidth={1.75} aria-hidden />
                  </button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Add or check a system: photo of the data plate, or typed             */
/* ------------------------------------------------------------------ */

type Read = HomeHealthResult & { source?: string };

function KindPicker({ value, onChange, label }: { value: SystemKind; onChange: (k: SystemKind) => void; label: string }) {
  const { t } = useLang();
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {SYSTEM_KINDS.map((k) => {
        const on = k === value;
        const Icon = KIND_ICON[k];
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(k)}
            className={`press relative inline-flex min-h-[44px] items-center gap-2 rounded-[8px] border px-3 text-[15px] font-medium transition-colors duration-[120ms] ${on ? 'border-pine text-pine' : 'border-line bg-surface text-ink-2 hover:text-ink'}`}
          >
            {on && <motion.span layoutId={`kind-${id}`} transition={spring.snappy} className="absolute inset-0 rounded-[7px] bg-pine-soft" aria-hidden />}
            <Icon size={16} strokeWidth={1.75} className="relative" aria-hidden />
            <span className="relative">{t(`keepHome.kind.${k}`)}</span>
          </button>
        );
      })}
    </div>
  );
}

function AddSystem({ systems, onSave }: { systems: HomeSystem[]; onSave: (s: HomeSystem) => void }) {
  const { t, lang } = useLang();
  const [kind, setKind] = useState<SystemKind>('water_heater');
  const [typedAge, setTypedAge] = useState<string>('');
  const [busy, setBusy] = useState<'photo' | 'typed' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [read, setRead] = useState<Read | null>(null);
  const [age, setAge] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const exists = kind !== 'other' && systems.some((s) => s.kind === (read?.system ?? kind));
  const show = (r: Read) => {
    setRead(r);
    setAge(r.estimatedAgeYears);
    setSaved(null);
  };

  const sendPhoto = async (f: File) => {
    setBusy('photo');
    setError(null);
    setRead(null);
    setPreview(URL.createObjectURL(f));
    const fd = new FormData();
    fd.append('file', f);
    fd.append('kind', kind);
    fd.append('lang', lang);
    try {
      const res = await fetch('/api/home-health', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || t('keepHome.readError'));
      show(data as Read);
    } catch (e) {
      setError((e as Error).message || t('keepHome.readError'));
    } finally {
      setBusy(null);
    }
  };

  const useSample = async () => {
    const res = await fetch('/samples/water-heater-plate.png');
    const blob = await res.blob();
    setKind('water_heater');
    await sendPhoto(new File([blob], 'water-heater-plate.png', { type: 'image/png' }));
  };

  const sendTyped = async () => {
    const n = typedAge.trim() === '' ? null : Number(typedAge);
    setBusy('typed');
    setError(null);
    setPreview(null);
    try {
      const res = await fetch('/api/home-health', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, ageYears: n !== null && Number.isFinite(n) ? Math.max(0, Math.min(150, n)) : null, lang }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message);
      show(data as Read);
    } catch {
      // the rules work offline too
      const d = SYSTEM_DEFAULTS[kind];
      show({ system: kind, estimatedAgeYears: n ?? Math.round(d.lifeYears / 2), confidence: n === null ? 'low' : 'high', typicalLifeYears: d.lifeYears, replacementCostRange: [d.costLow, d.costHigh], manufactureYear: null, details: null, from: n === null ? 'default' : 'typed' });
    } finally {
      setBusy(null);
    }
  };

  const save = () => {
    if (!read) return;
    const s = makeSystem(read.system, age, {
      source: read.from === 'photo' && age === read.estimatedAgeYears ? 'photo' : read.from === 'default' && age === read.estimatedAgeYears ? 'default' : 'typed',
      confidence: age === read.estimatedAgeYears ? read.confidence : 'high',
    });
    onSave(s);
    setSaved(t(exists ? 'keepHome.updated' : 'keepHome.added', { system: t(`keepHome.kind.${read.system}`) }));
    setRead(null);
    setTypedAge('');
    setPreview(null);
  };

  const $ = (n: number) => money(n, lang);
  return (
    <section className="mt-12" aria-labelledby="add-title">
      <h2 id="add-title" className="t-section text-ink">
        {t('keepHome.addTitle')}
      </h2>
      <p className="mt-1 text-[15px] text-ink-2">{t('keepHome.addSub')}</p>
      <div className="panel mt-4 !p-5" data-testid="add-system">
        <p className="mb-3 text-[15px] font-medium text-ink">{t('keepHome.whichSystem')}</p>
        <KindPicker value={kind} onChange={(k) => { setKind(k); setRead(null); setSaved(null); }} label={t('keepHome.whichSystem')} />

        <div className="mt-6 grid gap-6 sm:grid-cols-2 sm:gap-5">
          <div>
            <p className="text-[15px] font-medium text-ink">{t('keepHome.photoTitle')}</p>
            <p className="mt-1 text-[13px] leading-[18px] text-ink-2">{t('keepHome.photoHelp')}</p>
            <input ref={file} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label={t('keepHome.takePhoto')} onChange={(e) => { const f = e.target.files?.[0]; if (f) sendPhoto(f); e.target.value = ''; }} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => file.current?.click()} disabled={!!busy} data-testid="take-photo">
                {busy === 'photo' ? <Spinner /> : <Camera size={18} strokeWidth={1.75} aria-hidden />}
                {busy === 'photo' ? t('keepHome.reading') : t('keepHome.takePhoto')}
              </Button>
              <Button variant="quiet" onClick={useSample} disabled={!!busy} data-testid="use-sample-photo">
                <ImageIcon size={18} strokeWidth={1.75} aria-hidden />
                {t('keepHome.useSamplePhoto')}
              </Button>
            </div>
            <p className="mt-2 text-[13px] leading-[18px] text-ink-2">{t('keepHome.photoPrivacy')}</p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendTyped();
            }}
          >
            <label htmlFor="typed-age" className="text-[15px] font-medium text-ink">
              {t('keepHome.typedTitle')}
            </label>
            <p className="mt-1 text-[13px] leading-[18px] text-ink-2">{t('keepHome.typedHelp')}</p>
            <div className="mt-3 flex gap-2">
              <input id="typed-age" inputMode="numeric" className="field tnum !w-[120px]" placeholder={t('keepHome.yearsPlaceholder')} value={typedAge} onChange={(e) => setTypedAge(e.target.value.replace(/[^\d.]/g, '').slice(0, 3))} />
              <Button type="submit" variant="secondary" loading={busy === 'typed'} disabled={!!busy}>
                {t('keepHome.check')}
              </Button>
            </div>
          </form>
        </div>

        <div aria-live="polite">
          <AnimatePresence initial={false} mode="popLayout">
            {error && (
              <motion.p key="err" {...reveal} role="alert" className="mt-5 border-l-2 border-signal-red pl-3 text-[15px] text-signal-red">
                {error}
              </motion.p>
            )}
            {saved && !read && (
              <motion.p key="saved" {...reveal} className="mt-5 border-l-2 border-pine pl-3 text-[15px] text-ink" data-testid="system-saved">
                {saved}
              </motion.p>
            )}
            {read && (
              <motion.div key={`read-${read.system}-${read.estimatedAgeYears}`} {...reveal} className="mt-6 border-t border-line pt-5" data-testid="read-result">
                <div className="flex gap-4">
                  {preview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt={t('keepHome.yourPhoto')} className="img-edge h-[72px] w-[96px] shrink-0 rounded-[8px] object-cover" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[16px] font-medium text-ink">
                      {read.manufactureYear && read.from === 'photo'
                        ? t('keepHome.readMade', { system: t(`keepHome.kind.${read.system}`), year: read.manufactureYear })
                        : t('keepHome.readAbout', { system: t(`keepHome.kind.${read.system}`) })}
                    </p>
                    {read.details && <p className="mt-0.5 text-[13px] leading-[18px] text-ink-2">{read.details}</p>}
                    <p className={`mt-2 inline-flex items-center rounded-[6px] px-2 py-0.5 text-[13px] font-medium ${read.confidence === 'low' ? 'bg-paper text-signal-amber' : 'bg-pine-soft text-pine'}`} data-testid="read-confidence">
                      {t(`keepHome.confidence.${read.confidence}`)}
                    </p>
                    <p className="mt-1 text-[13px] leading-[18px] text-ink-2">{t(`keepHome.confidenceWhy.${read.from}`)}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-4">
                  <div>
                    <label htmlFor="read-age" className="mb-2 block text-[15px] font-medium text-ink">
                      {t('keepHome.ageQuestion')}
                    </label>
                    <Stepper id="read-age" value={age} min={0} max={80} onChange={setAge} decLabel={t('keepHome.ageLess', { system: t(`keepHome.kind.${read.system}`) })} incLabel={t('keepHome.ageMore', { system: t(`keepHome.kind.${read.system}`) })} />
                  </div>
                  <p className="tnum pb-3 text-[15px] text-ink-2">
                    {t('keepHome.readLife', { n: read.typicalLifeYears, low: $(read.replacementCostRange[0]), high: $(read.replacementCostRange[1]) })}
                  </p>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button onClick={save} data-testid="save-system">
                    {exists ? t('keepHome.update', { system: t(`keepHome.kindIn.${read.system}`) }) : t('keepHome.add')}
                  </Button>
                  <Button variant="quiet" onClick={() => { setRead(null); setPreview(null); }}>
                    {t('keepHome.discard')}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Something is leaking or broken                                       */
/* ------------------------------------------------------------------ */

function LeakHelp({ profile }: { profile: KeepProfile }) {
  const { t, lang } = useLang();
  const [kind, setKind] = useState<SystemKind | null>(null);
  const [help, setHelp] = useState<Help | null>(null);
  const [tailoring, setTailoring] = useState(false);
  const req = useRef(0);

  const ask = async (k: SystemKind) => {
    const id = ++req.current;
    setKind(k);
    // the safe checklist shows at once; the tailored one replaces it when it arrives
    setHelp(fallbackHelp(k, lang));
    setTailoring(true);
    try {
      const sys = profile.systems.find((s) => s.kind === k);
      const res = await fetch('/api/home-help', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: k, ageYears: sys?.ageYears ?? null, lang }) });
      const data = await res.json();
      if (id === req.current && res.ok && data.steps) setHelp({ urgency: data.urgency, headline: data.headline, steps: data.steps, callWho: data.callWho });
    } catch {
      /* keep the safe checklist */
    } finally {
      if (id === req.current) setTailoring(false);
    }
  };
  // a new language: ask again in it
  const langRef = useRef(lang);
  useEffect(() => {
    if (langRef.current === lang) return;
    langRef.current = lang;
    if (kind) ask(kind);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const sys = kind ? profile.systems.find((s) => s.kind === kind) : null;
  const cost = kind ? SYSTEM_DEFAULTS[kind] : null;
  const $ = (n: number) => money(n, lang);
  const tone = help?.urgency === 'now' ? 'border-signal-red text-signal-red' : help?.urgency === 'soon' ? 'border-signal-amber text-signal-amber' : 'border-pine text-pine';
  return (
    <section className="panel !p-5" aria-labelledby="leak-title" data-testid="leak-help">
      <h2 id="leak-title" className="text-[16px] font-semibold text-ink">
        {t('keepHome.leakTitle')}
      </h2>
      <p className="mt-1 text-[15px] leading-[22px] text-ink-2">{t('keepHome.leakSub')}</p>
      <div className="mt-4 flex flex-col gap-2">
        <Button variant={kind === 'water_heater' ? 'primary' : 'secondary'} full onClick={() => ask('water_heater')} data-testid="leak-water-heater">
          <Droplets size={18} strokeWidth={1.75} aria-hidden />
          {t('keepHome.leakWaterHeater')}
        </Button>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('keepHome.leakOther')}>
          {(['roof', 'hvac', 'appliances', 'other'] as SystemKind[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => ask(k)}
              className={`press min-h-[44px] rounded-[8px] border px-3 text-[14px] font-medium transition-colors duration-[120ms] ${kind === k ? 'border-pine bg-pine-soft text-pine' : 'border-line bg-surface text-ink-2 hover:text-ink'}`}
            >
              {t(`keepHome.broken.${k}`)}
            </button>
          ))}
        </div>
      </div>
      <AnimatePresence initial={false} mode="wait">
        {help && kind && (
          <motion.div key={`${kind}-${help.headline}`} {...reveal} className="mt-5" data-testid="leak-steps" aria-live="polite">
            <p className={`border-l-2 pl-3 text-[15px] font-medium leading-[22px] ${tone}`} data-testid="leak-urgency">
              {t(`keepHome.urgency.${help.urgency}`)}
            </p>
            <p className="mt-2 text-[15px] leading-[22px] text-ink">{help.headline}</p>
            <ol className="mt-3 flex flex-col gap-2.5">
              {help.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-[22px] text-ink">
                  <span className="tnum mt-[1px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-pine-soft text-[13px] font-semibold text-pine" aria-hidden>
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[15px] leading-[22px] text-ink-2">{help.callWho}</p>
            {tailoring && (
              <p className="t-helper mt-3 flex items-center gap-2 text-ink-2">
                <Spinner size={14} /> {t('keepHome.tailoring')}
              </p>
            )}
            <div className="mt-4 border-t border-line pt-4 text-[15px] leading-[22px]">
              <p className="tnum text-ink">{t('keepHome.leakSavings', { amount: $(profile.savings) })}</p>
              {cost && (
                <p className="tnum mt-1 text-ink-2">
                  {t('keepHome.leakCost', { system: t(`keepHome.kindIn.${kind}`), low: $(cost.costLow), high: $(cost.costHigh) })}
                  {sys ? ` ${t('keepHome.leakAge', { n: Math.round(sys.ageYears) })}` : ''}
                </p>
              )}
              <Link href="/keep/relief" className="mt-2 inline-flex min-h-[44px] items-center text-[15px] font-medium text-pine underline-offset-4 hover:underline">
                {t('keepHome.leakRelief')}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
