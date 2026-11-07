import { Document, Page, Text, View, StyleSheet, Svg, Rect, Line, renderToBuffer } from '@react-pdf/renderer';
import { registerFonts } from './fonts';
import { PdfLockup } from './lockup';
import { translate } from '../i18n-core';
import { money, monthName } from '../format';
import { forecast } from '../forecast';
import { repairTimeline } from '../homeHealth';
import { fallbackRelief } from '../relief';
import type { KeepProfile } from '../keep';
import type { Lang } from '../types';

const C = { ink: '#182420', ink2: '#4A5753', line: '#DDE3DF', pine: '#1E5C47', pineSoft: '#E4EFEA', amber: '#8A5F0E' };

const humanize = (k: string) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** One-page "My home plan" for KEEP: the 24-month forecast, the next shock, set-asides, moves, systems, reliefs. */
export async function renderHomePlanPdf(o: { profile: KeepProfile; movesDone: string[]; reliefDone: string[]; lang: Lang; now?: Date }): Promise<Buffer> {
  const family = registerFonts();
  const lang = o.lang;
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, `keepPdf.${k}`, v);
  const $ = (n: number) => money(n, lang);
  const now = o.now ?? new Date();
  const p = o.profile;
  const f = forecast(p);
  const months = f.months;
  const peak = months.reduce((m, x) => (x.total > m.total ? x : m), months[0]);
  const today = months[0]?.total ?? 0;
  const next = f.first;
  const systems = repairTimeline(p.systems ?? [], now);
  const done = new Set(o.reliefDone);
  if (p.homeownersExemption) done.add('exemption');
  if (p.careFera) done.add('careFera');
  const reliefs = fallbackRelief(p, lang, now);

  const s = StyleSheet.create({
    page: { padding: 44, fontFamily: family, fontSize: 10, color: C.ink, lineHeight: 1.4 },
    small: { fontSize: 8.5, color: C.ink2 },
    h2: { fontSize: 11.5, fontWeight: 600, marginTop: 16, marginBottom: 6 },
    stat: { flex: 1, paddingRight: 10 },
    statLabel: { fontSize: 8.5, color: C.ink2 },
    statValue: { fontSize: 17, fontWeight: 600, marginTop: 2, lineHeight: 1.25 },
    row: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.75, borderBottomColor: C.line },
  });

  // 24 bars, scaled from 80% of the lowest month so the rises are visible
  const W = 524;
  const H = 70;
  const lo = Math.min(...months.map((m) => m.total)) * 0.8;
  const hi = Math.max(...months.map((m) => m.total), lo + 1);
  const bw = W / Math.max(1, months.length);
  const shockSet = new Set(f.shocks.map((x) => x.i));

  return renderToBuffer(
    <Document title={t('title')} language={lang}>
      <Page size="LETTER" style={s.page}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <PdfLockup height={26} family={family} tagline={translate(lang, 'brand.tagline')} />
          <Text style={[s.small, { marginTop: 6 }]}>Habitat for Humanity of Orange County</Text>
        </View>
        <Text style={{ fontSize: 22, fontWeight: 600, marginTop: 14, lineHeight: 1.25 }}>{t('title')}</Text>
        <Text style={[s.small, { marginTop: 2 }]}>{t('made', { date: new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', { dateStyle: 'long' }).format(now) })}</Text>

        <View style={{ flexDirection: 'row', marginTop: 16, paddingTop: 10, borderTopWidth: 0.75, borderTopColor: C.line }}>
          <View style={s.stat}>
            <Text style={s.statLabel}>{t('today')}</Text>
            <Text style={s.statValue}>{$(today)}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>{t('peak')}</Text>
            <Text style={s.statValue}>{$(peak?.total ?? 0)}</Text>
            {peak && <Text style={s.small}>{monthName(peak.month, lang)}</Text>}
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>{t('setAside')}</Text>
            <Text style={s.statValue}>{$(Math.max(p.setAside || 0, 0))}</Text>
            <Text style={s.small}>{t('recommended', { amount: $(f.recommendedSetAside) })}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statLabel}>{t('repairs')}</Text>
            <Text style={s.statValue}>{$(f.maintenance)}</Text>
            <Text style={s.small}>{t('repairsHelp')}</Text>
          </View>
        </View>

        <Text style={s.h2}>{t('forecastTitle')}</Text>
        <Text>
          {next
            ? t('nextShock', { month: monthName(next.month, lang), amount: $(next.delta), cause: t(`cause.${next.cause}`) })
            : t('noShock')}
        </Text>
        <Svg width={W} height={H + 4} style={{ marginTop: 8 }}>
          <Line x1={0} y1={H} x2={W} y2={H} stroke={C.line} strokeWidth={0.75} />
          {months.map((m, i) => {
            const h = Math.max(2, ((m.total - lo) / (hi - lo)) * H);
            return <Rect key={m.month} x={i * bw + 1.5} y={H - h} width={bw - 3} height={h} fill={shockSet.has(i) ? C.amber : C.pine} rx={1.5} />;
          })}
        </Svg>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
          <Text style={s.small}>{months[0] ? monthName(months[0].month, lang, true) : ''}</Text>
          <Text style={s.small}>{t('barsHelp')}</Text>
          <Text style={s.small}>{months.length ? monthName(months[months.length - 1].month, lang, true) : ''}</Text>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 4 }}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={s.h2}>{t('systemsTitle')}</Text>
            {systems.length === 0 && <Text style={s.small}>{t('noSystems')}</Text>}
            {systems.slice(0, 8).map((it) => (
              <View key={it.system.id} style={s.row} wrap={false}>
                <Text style={{ flex: 1.3 }}>{it.system.label || translate(lang, `keepHome.kind.${it.system.kind}`)}</Text>
                <Text style={{ flex: 1, color: it.inYears <= 1 ? C.amber : C.ink }}>{it.inYears === 0 ? t('dueNow') : String(it.dueYear)}</Text>
                <Text style={{ flex: 1.3, textAlign: 'right', color: C.ink2 }}>{`${$(it.system.costLow)}–${$(it.system.costHigh)}`}</Text>
              </View>
            ))}
            <Text style={s.h2}>{t('movesTitle')}</Text>
            {o.movesDone.length === 0 && <Text style={s.small}>{t('noMoves')}</Text>}
            {o.movesDone.slice(0, 8).map((k) => {
              const label = translate(lang, `keepPdf.moves.${k}`);
              return (
                <View key={k} style={s.row} wrap={false}>
                  <View style={{ width: 9, height: 9, marginTop: 2, marginRight: 7, borderRadius: 2, backgroundColor: C.pine }} />
                  <Text style={{ flex: 1 }}>{label === `keepPdf.moves.${k}` ? humanize(k) : label}</Text>
                </View>
              );
            })}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.h2}>{t('reliefTitle')}</Text>
            {reliefs.map((r) => (
              <View key={r.id} style={[s.row, { flexDirection: 'column' }]} wrap={false}>
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ width: 9, height: 9, marginTop: 2, marginRight: 7, borderWidth: 1, borderRadius: 2, borderColor: done.has(r.id) ? C.pine : C.ink2, backgroundColor: done.has(r.id) ? C.pine : undefined }} />
                  <Text style={{ flex: 1, fontWeight: 600 }}>{r.name}</Text>
                </View>
                <Text style={[s.small, { marginLeft: 16 }]}>
                  {done.has(r.id) ? t('claimed') : r.valuePerYear ? t('worth', { amount: $(r.valuePerYear) }) : r.nextStep}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={[s.small, { position: 'absolute', bottom: 30, left: 44, right: 44 }]}>{t('footer')}</Text>
      </Page>
    </Document>,
  );
}
