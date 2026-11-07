'use client';
import { motion, type MotionValue } from 'motion/react';
import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Figure } from '@/components/illustrations/Figure';
import { IsoHouse, isoPx, type HouseStage } from '@/components/illustrations/IsoHouse';
import { P, mix, type ClothKey } from '@/lib/illustrationPalette';
import { alpha, KitDefs, Shade, Tree, useOnScreen, useStaged } from './kit';
import { Tree as KitTree, type TreeSpecies } from '@/components/illustrations/kit';

/**
 * Scene 3: a neighborhood block drawn in the same oblique projection as the house (fronts face us, sides
 * recede up and to the right, light from the top-left). A street runs back through it with three lots on each
 * side; the homes stand at different build stages (framing, roofing, finished) and a tower crane works at the
 * back. Played once on activation: a count badge pops above every home and rolls up from 0; a worker carries a
 * beam to a frame; the scaffolding comes down on the home that's finishing and its windows light; families walk
 * up the street to the finished homes they're ready for, and each porch light comes on as they arrive.
 * Counts come from the real seed data (passed in). Ambient loop: the crane slowly slews back and forth.
 */
export type LotStatus = 'stable' | 'watch' | 'act';
/**
 * A lot on the block. `ready` drives the count badge; `status` switches it to an early-warning marker (text
 * with a coloured rule: Stable / Watch / Act now) that starts Stable and turns to its status at `turnsAt` s.
 */
export type Lot = { id: string; label: string; ready: number; stage?: HouseStage; finishing?: boolean; status?: LotStatus; turnsAt?: number };

const VB = { w: 600, h: 350 };
/** Ground (u across, w back) → screen. A step back moves up and to the right, like the house's side wall. */
const G = { x: 24, y: 318, kx: 0.857, ky: 0.5 };
const at = (u: number, w: number) => ({ x: G.x + u + w * G.kx, y: G.y - w * G.ky });
const S = 118; // house size (px of viewBox)
const HF = S / 92; // house units → viewBox
const HOUSE_W = 60 * HF; // front width (u)
const HOUSE_D = 24 * HF / G.kx; // depth (w)
const SLAB = { u: 316, w: 282, t: 16 };
const STREET = { u0: 130, u1: 184 };
const ROWS = [34, 130, 226];
/** Lot slots, nearest first on each side: [corner u, corner w]. Lot i of the data goes to slot i. */
const SLOTS: { u: number; w: number; side: 'L' | 'R' }[] = [
  { u: 22, w: ROWS[0], side: 'L' },
  { u: 22, w: ROWS[1], side: 'L' },
  { u: 22, w: ROWS[2], side: 'L' },
  { u: 214, w: ROWS[0], side: 'R' },
  { u: 214, w: ROWS[1], side: 'R' },
  { u: 214, w: ROWS[2], side: 'R' },
];
const pct = (v: number, of: number) => `${(v / of) * 100}%`;
/** The block's geometry, for scenery drawn around it in the same projection (components/landing/scenes). */
export const NB = { VB, G, at, S, SLOTS, STREET, SLAB, ROWS, HOUSE_W, HOUSE_D };
const z = (w: number) => Math.round(1000 - w * 2);
const T = { slab: 0, houses: 0.2, crane: 0.5, badges: 0.95, walk: 0.95, worker: 0.85, unscaffold: 1.45, finished: 1.85 };
const WALK_SPEED = 125; // ground units per second
const FAMILIES: { kinds: ('adult' | 'teen' | 'child' | 'toddler')[]; skin: number[]; hair: number[]; tops: ClothKey[] }[] = [
  { kinds: ['adult', 'child', 'adult'], skin: [2, 2, 1], hair: [0, 1, 0], tops: ['honey', 'sky', 'pine'] },
  { kinds: ['adult', 'teen'], skin: [3, 3], hair: [0, 0], tops: ['pine', 'sage'] },
  { kinds: ['adult', 'toddler', 'adult'], skin: [0, 0, 1], hair: [3, 2, 1], tops: ['sky', 'honey', 'slate'] },
  { kinds: ['adult', 'child'], skin: [4, 4], hair: [4, 0], tops: ['sage', 'pine'] },
  { kinds: ['adult', 'child', 'child'], skin: [1, 2, 1], hair: [1, 2, 1], tops: ['pine', 'honey', 'sky'] },
  { kinds: ['adult', 'adult'], skin: [2, 0], hair: [0, 3], tops: ['slate', 'honey'] },
];

/**
 * An early-warning marker: the status as text with a 2px coloured rule (pine Stable, amber Watch, red Act
 * now), on a thin paper backing so it reads over the block. Starts Stable; turns to `status` at `turnsAt` s,
 * the new word swapping in vertically.
 */
function StatusMarker({ status, turnsAt }: { status: LotStatus; turnsAt: number }) {
  const { t } = useLang();
  const [now, setNow] = useState<LotStatus>(turnsAt > 0 ? 'stable' : status);
  useEffect(() => {
    if (turnsAt <= 0) return setNow(status);
    const id = setTimeout(() => setNow(status), turnsAt * 1000);
    return () => clearTimeout(id);
  }, [status, turnsAt]);
  const tone = now === 'act' ? 'border-signal-red text-signal-red' : now === 'watch' ? 'border-signal-amber text-signal-amber' : 'border-pine text-pine';
  const key = now === 'act' ? 'landing.statusAct' : now === 'watch' ? 'landing.statusWatch' : 'landing.statusStable';
  return (
    <span className={`relative block overflow-hidden whitespace-nowrap border-l-2 py-[1px] pl-[7px] pr-[8px] text-[13px] font-semibold leading-[19px] transition-colors duration-300 ${tone}`} style={{ background: alpha(P.paper, 0.86) }} data-status={now}>
      <motion.span key={now} className="block" initial={turnsAt > 0 && now !== 'stable' ? { y: 8, opacity: 0 } : false} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}>
        {t(key)}
      </motion.span>
    </span>
  );
}

/** Starts at 0 and rolls up to `to` at `at` seconds. */
function RollUp({ to, at: when, format }: { to: number; at: number; format: (n: number) => string }) {
  const [v, setV] = useState(when === 0 ? to : 0);
  useEffect(() => {
    if (when === 0) return setV(to);
    const id = setTimeout(() => setV(to), when * 1000);
    return () => clearTimeout(id);
  }, [to, when]);
  return <AnimatedNumber value={v} format={format} />;
}

/**
 * `plain`: the block sits flush on a ground plane drawn by the page (no plinth, no lawn or street of its own,
 * no rise). `badgeY`: extra travel for the count badges, so they float above the block when the page moves.
 * `settled`: the markers stand at their final status with no entrance (a scene's resting state); change
 * `badgeKey` to replay their entrance (they rise, then turn) without touching the homes.
 */
export function NeighborhoodMap({ lots, reduce, plain = false, badgeY, night = false, site = true, built = false, badges = true, settled = false, badgeKey = 0 }: { lots: Lot[]; reduce: boolean; plain?: boolean; badgeY?: MotionValue<number>; settled?: boolean; badgeKey?: number; /** night: the finished homes' windows and porch lights are on */ night?: boolean; /** the tower crane (a block still being built) */ site?: boolean; /** the homes stand already (no build-in) */ built?: boolean; /** show the badges / markers */ badges?: boolean }) {
  const { t } = useLang();
  const id = `nb${useId().replace(/:/g, '')}`;
  const box = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(box);
  // the block first, then the homes, then trees, crane and worker, then badges and families (one per frame)
  const st = useStaged(4);
  const six = useMemo(() => lots.slice(0, 6), [lots]);
  const finishedLot = (l: Lot) => (l.stage ?? 'finished') === 'finished';
  // a family walks to each finished home with families ready for it (to the one finishing once it's done)
  const walks = useMemo(() => {
    let start = T.walk;
    return six.flatMap((lot, i) => {
      if (lot.ready <= 0 || !finishedLot(lot)) return [];
      const slot = SLOTS[i];
      const mid = (STREET.u0 + STREET.u1) / 2;
      const doorU = slot.u + HOUSE_W * 0.5;
      const frontW = slot.w - 9;
      const pts = [
        { u: mid, w: 2 },
        { u: mid, w: frontW },
        { u: doorU + (slot.side === 'L' ? 9 : -9), w: frontW },
      ];
      const len = Math.abs(pts[1].w - pts[0].w) + Math.abs(pts[2].u - pts[1].u);
      const dur = len / WALK_SPEED;
      // a family headed for the finishing home arrives just after its scaffolding comes down
      const delay = lot.finishing ? Math.max(start, T.finished + 0.25 - dur) : start;
      const walk = { lot: i, pts, dur, delay, family: FAMILIES[i % FAMILIES.length] };
      start += 0.14;
      return [walk];
    });
  }, [six]);
  const [done, setDone] = useState(reduce);
  useEffect(() => {
    if (reduce) return;
    const id = setTimeout(() => setDone(true), T.finished * 1000);
    return () => clearTimeout(id);
  }, [reduce]);
  const workerLot = six.findIndex((l) => l.stage === 'framing');
  const [home, setHome] = useState<boolean[]>(() => six.map((l) => reduce && l.ready > 0));
  useEffect(() => {
    if (reduce) return;
    const timers = walks.map((wk) => setTimeout(() => setHome((h) => h.map((v, i) => (i === wk.lot ? true : v))), (wk.delay + wk.dur + 0.15) * 1000));
    return () => timers.forEach(clearTimeout);
  }, [walks, reduce]);

  const corner = (i: number) => at(SLOTS[i].u, SLOTS[i].w);
  const hp = isoPx(S, 0, 0);

  return (
    <div ref={box} className={plain ? 'relative w-full' : 'relative mx-auto w-full max-w-[620px]'} style={{ aspectRatio: `${VB.w} / ${VB.h}` }} aria-hidden data-testid="neighborhood-map">
      <motion.div
        className="absolute inset-0"
        initial={reduce || plain ? false : { opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.75, bounce: 0.14, delay: T.slab, opacity: { duration: 0.3 } }}
      >
        {!plain && <Ground id={id} />}
        {/* homes (nearest drawn last) */}
        {st >= 2 && six.map((lot, i) => {
          const c = corner(i);
          const delay = T.houses + (SLOTS[i].w / 92) * 0.09 + (SLOTS[i].side === 'R' ? 0.05 : 0);
          return (
            <div key={lot.id} className={`absolute ${reduce || built ? '' : 'la-show'}`} style={{ left: pct(c.x - hp.x, VB.w), top: pct(c.y - hp.y, VB.h), width: pct(S, VB.w), zIndex: z(SLOTS[i].w), animationDelay: `${delay + 0.09}s` }}>
              <IsoHouse size={S} stage={lot.stage ?? 'finished'} build={reduce || built ? 'none' : 'quick'} delay={delay} porch={(home[i] || night) && finishedLot(lot)} lit={finishedLot(lot) && (night || (lot.finishing ? done : home[i]))} ground={false} className="h-auto w-full" />
            </div>
          );
        })}
        {/* scaffolding on the home that's finishing: it comes down, then the windows light */}
        {st >= 2 && six.map((lot, i) => (lot.finishing && !reduce ? <Scaffold key={lot.id} slot={i} /> : null))}
        {/* a worker carries a beam to a frame */}
        {st >= 3 && workerLot >= 0 && !reduce && <Worker slot={workerLot} />}
        {/* yard trees, each in its own depth slot */}
        {st >= 3 && YARD_TREES.map((tr, i) => {
          const p = at(tr.u, tr.w);
          return (
            <div key={i} className="absolute" style={{ left: pct(p.x - 40, VB.w), top: pct(p.y - 80, VB.h), width: pct(80, VB.w), zIndex: z(tr.w) }}>
              <svg viewBox="-40 -80 80 84" className="block h-auto w-full overflow-visible">
                <defs>
                  <KitDefs id={`${id}t${i}`} />
                </defs>
                {built ? (
                  <KitTree species={KIT_SPECIES[tr.kind]} x={0} base={0} size={(tr.kind === 'tall' ? 64 : 50) * tr.s} />
                ) : (
                  <PopTree id={`${id}t${i}`} s={tr.s} kind={tr.kind} delay={0.45 + i * 0.06} reduce={reduce} />
                )}
              </svg>
            </div>
          );
        })}
        {st >= 3 && site && <Crane id={id} reduce={reduce} onScreen={onScreen} />}
        {/* families walking up the street */}
        {st >= 4 && walks.map((wk) => (
          <Family key={wk.lot} walk={wk} reduce={reduce} />
        ))}
        {/* count badges pop above each home and roll up from 0 */}
        {st >= 4 && badges && (
        <motion.div key={badgeKey} className="absolute inset-0" style={{ zIndex: 2000, y: badgeY }}>
        {six.map((lot, i) => {
          const c = corner(i);
          const ready = lot.ready > 0;
          return (
            <div key={lot.id} className="absolute" style={{ left: pct(c.x + 44 * HF, VB.w), top: pct(c.y - 84 * HF, VB.h), zIndex: 2000 }}>
              <motion.div
                className="absolute bottom-0 left-0 flex -translate-x-1/2 flex-col items-center"
                style={{ transformOrigin: '50% 100%' }}
                initial={reduce || settled ? false : { opacity: 0, y: 8, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', duration: 0.4, bounce: 0.25, delay: reduce ? 0 : T.badges + i * 0.06, opacity: { duration: 0.15, delay: reduce ? 0 : T.badges + i * 0.06 } }}
              >
                <span className="mb-[3px] hidden whitespace-nowrap rounded-full px-[6px] text-[11px] font-medium leading-[16px] text-ink-2 sm:block" style={{ background: alpha(P.paper, 0.85) }}>
                  {lot.label}
                </span>
                {lot.status ? (
                  <StatusMarker status={lot.status} turnsAt={reduce || settled ? 0 : (lot.turnsAt ?? 0)} />
                ) : (
                  <>
                    <span className={`tnum whitespace-nowrap rounded-full border px-[9px] text-[12px] font-semibold leading-[20px] ${ready ? 'text-white' : 'text-ink-2'}`} style={{ background: ready ? P.pine : 'var(--surface)', borderColor: ready ? P.pine : 'var(--line)' }}>
                      <RollUp to={lot.ready} at={reduce ? 0 : T.badges + i * 0.06 + 0.05} format={(n) => t('landing.mapReady', { n: Math.round(n) })} />
                    </span>
                    {/* the pin's pointer */}
                    <svg width="10" height="5" viewBox="0 0 10 5" className="-mt-px block">
                      <path d="M0 0H10L5 5Z" fill={ready ? P.pine : 'var(--surface)'} />
                    </svg>
                  </>
                )}
              </motion.div>
            </div>
          );
        })}
        </motion.div>
        )}
      </motion.div>
    </div>
  );
}

const KIT_SPECIES: Record<'round' | 'tall' | 'cluster', TreeSpecies> = { round: 'oak', tall: 'cypress', cluster: 'jacaranda' };
const YARD_TREES: { u: number; w: number; s: number; kind: 'round' | 'tall' | 'cluster' }[] = [
  { u: 8, w: 14, s: 1, kind: 'round' },
  { u: 112, w: 100, s: 0.85, kind: 'tall' },
  { u: 10, w: 196, s: 0.95, kind: 'cluster' },
  { u: 304, w: 18, s: 0.9, kind: 'tall' },
  { u: 304, w: 114, s: 1.05, kind: 'round' },
  { u: 112, w: 268, s: 0.8, kind: 'round' },
];

/** The block: a plinth with soil sides, lawns, the street with curbs and lane dashes, front walks. */
const Ground = memo(function Ground({ id }: { id: string }) {
  const quad = (u0: number, w0: number, u1: number, w1: number) => {
    const a = at(u0, w0);
    const b = at(u1, w0);
    const c = at(u1, w1);
    const d = at(u0, w1);
    return `M${a.x} ${a.y}L${b.x} ${b.y}L${c.x} ${c.y}L${d.x} ${d.y}Z`;
  };
  const fl = at(0, 0);
  const fr = at(SLAB.u, 0);
  const br = at(SLAB.u, SLAB.w);
  const t = SLAB.t;
  const dashes = Array.from({ length: 9 }, (_, i) => quad(152, 8 + i * 30, 154, 22 + i * 30)).join('');
  const walks = SLOTS.map((s) => quad(s.u + HOUSE_W * 0.4, s.w - 22, s.u + HOUSE_W * 0.6, s.w)).join('');
  const drives = SLOTS.map((s) => (s.side === 'L' ? quad(s.u + HOUSE_W * 0.5, s.w - 22, STREET.u0 - 12, s.w - 12) : quad(STREET.u1 + 12, s.w - 22, s.u + HOUSE_W * 0.5, s.w - 12))).join('');
  return (
    <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="absolute inset-0 h-full w-full overflow-visible">
      <defs>
        <KitDefs id={id} />
        <linearGradient id={`${id}-lawn`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={P.sageLight} />
          <stop offset="1" stopColor={P.sage} />
        </linearGradient>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.soil} />
          <stop offset="1" stopColor={mix(P.soil, P.ink, 0.12)} />
        </linearGradient>
        <linearGradient id={`${id}-street`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={P.asphalt} />
          <stop offset="1" stopColor={P.asphaltLight} />
        </linearGradient>
      </defs>
      {/* soft shadow under the whole block, falling right */}
      <ellipse cx={(fl.x + br.x) / 2 + 30} cy={(fl.y + br.y) / 2 + 26} rx={300} ry={96} fill={`url(#${id}-shadow)`} opacity={0.8} />
      {/* plinth: front face (lit), right face (shade), sage lip */}
      <path d={`M${fl.x} ${fl.y}L${fr.x} ${fr.y}L${fr.x} ${fr.y + t}L${fl.x} ${fl.y + t}Z`} fill={`url(#${id}-front)`} />
      <path d={`M${fr.x} ${fr.y}L${br.x} ${br.y}L${br.x} ${br.y + t}L${fr.x} ${fr.y + t}Z`} fill={mix(P.soil, P.ink, 0.25)} />
      <path d={`M${fl.x} ${fl.y}L${fr.x} ${fr.y}L${fr.x} ${fr.y + 3}L${fl.x} ${fl.y + 3}Z`} fill={P.sageDark} />
      <path d={`M${fr.x} ${fr.y}L${br.x} ${br.y}L${br.x} ${br.y + 3}L${fr.x} ${fr.y + 3}Z`} fill={mix(P.sageDark, P.ink, 0.15)} />
      {/* lawn */}
      <path d={quad(0, 0, SLAB.u, SLAB.w)} fill={`url(#${id}-lawn)`} />
      {/* lot lines: slightly darker mown strips */}
      {[ROWS[0] + 74, ROWS[1] + 74].map((w) => (
        <g key={w}>
          <path d={quad(4, w, STREET.u0 - 14, w + 3)} fill={P.sageDark} opacity={0.35} />
          <path d={quad(STREET.u1 + 14, w, SLAB.u - 4, w + 3)} fill={P.sageDark} opacity={0.35} />
        </g>
      ))}
      {/* street: sidewalks, curbs, asphalt, lane dashes */}
      <path d={quad(STREET.u0 - 14, 0, STREET.u1 + 14, SLAB.w)} fill={P.stone} />
      <path d={quad(STREET.u0 - 2, 0, STREET.u1 + 2, SLAB.w)} fill={P.stoneShade} />
      <path d={quad(STREET.u0, 0, STREET.u1, SLAB.w)} fill={`url(#${id}-street)`} />
      <path d={dashes} fill={P.trim} opacity={0.8} />
      <path d={`M${fl.x + STREET.u0} ${fl.y}L${fl.x + STREET.u1} ${fl.y}L${fl.x + STREET.u1} ${fl.y + t}L${fl.x + STREET.u0} ${fl.y + t}Z`} fill={mix(P.asphalt, P.ink, 0.2)} />
      {/* driveways and front walks */}
      <path d={drives} fill={P.stone} />
      <path d={walks} fill={P.stone} />
      {/* contact shadows the homes cast on their lots (falling right) */}
      {SLOTS.map((s, i) => {
        const c = at(s.u + HOUSE_W * 0.7, s.w + HOUSE_D * 0.5);
        return <Shade key={i} id={id} cx={c.x + 10} cy={c.y + 4} rx={58} ry={16} />;
      })}
    </svg>
  );
});

/** A tree that pops up (slight overshoot) and sways once after it lands (CSS). Origin at the trunk base (0,0). */
function PopTree({ id, s, kind, delay, reduce }: { id: string; s: number; kind: 'round' | 'tall' | 'cluster'; delay: number; reduce: boolean }) {
  return (
    <g className={reduce ? undefined : 'la-tree'} style={reduce ? undefined : { animationDelay: `${delay}s` }}>
      <Tree id={id} x={0} y={0} s={s} kind={kind} />
    </g>
  );
}

/**
 * A tower crane at the back of the block: lattice mast and jib in grey steel (lit left chords, shaded right),
 * operator cab, counterweight, trolley and a hanging bundle of timber. Its head slowly slews back and forth (the
 * jib swings toward us and away, foreshortening): the scene's one ambient loop (CSS, compositor only), paused
 * while the scene is off screen.
 */
const CRANE = { u: 312, w: 278 };
const Crane = memo(function Crane({ id, reduce, onScreen }: { id: string; reduce: boolean; onScreen: boolean }) {
  const base = at(CRANE.u, CRANE.w);
  // the crane's own box (viewBox units); the mast's foot sits on the block's back corner
  const box = { w: 244, h: 178, fx: 212, fy: 172 };
  const left = base.x - box.fx;
  const top = base.y - box.fy;
  const lit = P.slateLight;
  const shade = P.slate;
  const brace = mix(P.slate, P.slateLight, 0.4);
  const mastTop = 30;
  const jibY = 26;
  const trolleyX = 40;
  /** zig-zag bracing between two rails, as filled bars */
  const zig = (x0: number, y0: number, x1: number, y1: number, n: number, horiz: boolean, t = 1.5) => {
    let d = '';
    for (let i = 0; i < n; i++) {
      if (horiz) {
        const a = x0 + ((x1 - x0) * i) / n;
        const b = x0 + ((x1 - x0) * (i + 1)) / n;
        d += `M${a} ${y1}L${b - t} ${y0}L${b} ${y0}L${a + t} ${y1}Z`;
      } else {
        const a = y0 + ((y1 - y0) * i) / n;
        const b = y0 + ((y1 - y0) * (i + 1)) / n;
        d += `M${x0} ${b}L${x1} ${a + t}L${x1} ${a}L${x0} ${b - t}Z`;
      }
    }
    return d;
  };
  return (
    <div className="absolute" style={{ left: pct(left, VB.w), top: pct(top, VB.h), width: pct(box.w, VB.w), zIndex: z(CRANE.w) }}>
      <motion.div
        style={{ transformOrigin: `${(box.fx / box.w) * 100}% 100%` }}
        initial={reduce ? false : { opacity: 0, y: 36 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.7, bounce: 0.15, delay: T.crane, opacity: { duration: 0.2, delay: T.crane } }}
      >
        <svg viewBox={`0 0 ${box.w} ${box.h}`} className="block h-auto w-full overflow-visible">
          <defs>
            <KitDefs id={`${id}cr`} />
          </defs>
          <Shade id={`${id}cr`} cx={box.fx + 16} cy={box.fy} rx={30} ry={7} />
          {/* footing block */}
          <path d={`M${box.fx - 11} ${box.fy - 4}h22l6 -3.5h-22Z`} fill={P.stone} />
          <rect x={box.fx - 11} y={box.fy - 4} width={22} height={6} fill={P.stoneShade} />
          <path d={`M${box.fx + 11} ${box.fy - 4}l6 -3.5v6l-6 3.5Z`} fill={mix(P.stoneShade, P.ink, 0.15)} />
          {/* mast: lit left chord, shaded right chord, bracing */}
          <rect x={box.fx - 7} y={mastTop} width={4} height={box.fy - 4 - mastTop} fill={lit} />
          <rect x={box.fx + 3} y={mastTop} width={4} height={box.fy - 4 - mastTop} fill={shade} />
          <path d={zig(box.fx - 3, mastTop + 2, box.fx + 3, box.fy - 4, 11, false)} fill={brace} />
          {/* slewing ring */}
          <rect x={box.fx - 9} y={mastTop - 2} width={18} height={4} rx={1} fill={P.slateDark} />
        </svg>
        {/* the slewing head: jib, counter-jib, cab, trolley and load turn about the mast */}
        <div className="absolute inset-0" style={{ transformOrigin: `${(box.fx / box.w) * 100}% 0%` }}>
          <div className={`absolute inset-0 ${reduce ? '' : 'la-slew'} ${onScreen ? '' : 'la-paused'}`} style={{ transformOrigin: `${(box.fx / box.w) * 100}% 0%` }}>
            <svg viewBox={`0 0 ${box.w} ${box.h}`} className="absolute inset-0 block h-auto w-full overflow-visible">
              {/* jib to the left, counter-jib to the right */}
              <rect x={4} y={jibY} width={box.fx + 30 - 4} height={3.4} rx={1} fill={lit} />
              <rect x={10} y={jibY + 8} width={box.fx - 10} height={3} fill={shade} />
              <path d={zig(10, jibY + 3.4, box.fx - 7, jibY + 8, 20, true)} fill={brace} />
              {/* apex and tie bars */}
              <path d={`M${box.fx - 4} ${jibY}V6h8v${jibY - 6}Z`} fill={lit} />
              <path d={`M${box.fx} ${jibY}V6h4v${jibY - 6}Z`} fill={shade} />
              <path d={`M${box.fx - 3} 7L8 ${jibY}h3L${box.fx - 2} 9Z`} fill={brace} />
              <path d={`M${box.fx + 3} 7L${box.fx + 28} ${jibY}h-3L${box.fx + 2} 9Z`} fill={brace} />
              {/* counterweight and the operator's cab */}
              <rect x={box.fx + 14} y={jibY + 3} width={16} height={13} rx={1.5} fill={P.slateDark} />
              <rect x={box.fx + 14} y={jibY + 3} width={16} height={3.5} rx={1.5} fill={P.slate} />
              <rect x={box.fx - 18} y={jibY + 8} width={13} height={12} rx={2} fill={P.pine} />
              <rect x={box.fx - 18} y={jibY + 8} width={13} height={3} rx={1.5} fill={P.pineLight} />
              <rect x={box.fx - 16.5} y={jibY + 12} width={7} height={5} rx={1} fill={P.glassLight} />
              {/* trolley, cable, hook block and a timber bundle */}
              <rect x={trolleyX - 6} y={jibY + 10} width={12} height={5} rx={1.2} fill={P.slateDark} />
              <rect x={trolleyX - 0.6} y={jibY + 15} width={1.2} height={34} fill={P.ink2} />
              <rect x={trolleyX - 3.5} y={jibY + 47} width={7} height={6} rx={1.4} fill={P.honey} />
              <rect x={trolleyX - 3.5} y={jibY + 47} width={3.5} height={6} rx={1.4} fill={P.honeyLight} />
              <path d={`M${trolleyX - 0.8} ${jibY + 53}h1.6v3h-1.6ZM${trolleyX} ${jibY + 56}L${trolleyX - 14} ${jibY + 62}h1.8L${trolleyX} ${jibY + 57.6} ${trolleyX + 12.2} ${jibY + 62}H${trolleyX + 14}Z`} fill={P.ink2} />
              <rect x={trolleyX - 16} y={jibY + 62} width={32} height={4.5} rx={1} fill={P.timber} />
              <rect x={trolleyX - 16} y={jibY + 66.5} width={32} height={4.5} rx={1} fill={P.timberShade} />
              <rect x={trolleyX - 16} y={jibY + 62} width={32} height={1.5} rx={0.75} fill={mix(P.timber, P.trim, 0.45)} />
            </svg>
          </div>
        </div>
      </motion.div>
    </div>
  );
});

/**
 * Scaffolding around the home that's finishing: steel poles at the corners, timber planks at two levels and a
 * cross brace. It comes down once (anticipation: a small lift, then it drops and fades; the planks lead, the
 * poles follow), then the house's windows light.
 */
const Scaffold = memo(function Scaffold({ slot }: { slot: number }) {
  const sl = SLOTS[slot];
  const c = at(sl.u, sl.w);
  const hp = isoPx(S, 0, 0);
  const W = 60 * HF;
  const H = 44 * HF;
  const dx = 24 * HF;
  const dy = 14 * HF;
  const out = { transform: ['translateY(0)', 'translateY(-2%)', 'translateY(14%)'], opacity: [1, 1, 0] };
  const poles: [number, number][] = [[-3, 0], [W * 0.5, 0], [W + 2, 0], [W + dx + 1, -dy]];
  return (
    // it goes up as the walls do (CSS rise, delayed to the house's build), and comes down once the home is done
    <div className="la-in la-in-1 absolute" style={{ left: pct(c.x - hp.x, VB.w), top: pct(c.y - hp.y, VB.h), width: pct(S, VB.w), zIndex: z(sl.w) + 1, animationDelay: `${T.houses + (sl.w / 92) * 0.09 + 0.3}s` }}>
      <motion.div initial={{ opacity: 1 }} animate={out} transition={{ duration: 0.6, times: [0, 0.25, 1], ease: [0.36, 0, 0.66, -0.2], delay: T.unscaffold + 0.08 }}>
        <svg viewBox={`${-4} ${-(44 + 26 + 14 + 6)} ${92} ${94}`} className="block h-auto w-full overflow-visible">
          {poles.map(([x, y], i) => (
            <g key={i}>
              <rect x={x - 1} y={y - H - 10} width={2} height={H + 10} fill={i === 3 ? P.slate : P.slateLight} />
              <rect x={x - 2.5} y={y - 1.5} width={5} height={1.5} fill={P.slateDark} />
            </g>
          ))}
          <path d={`M-3 ${-H * 0.15}L${W * 0.5} ${-H * 0.85}`} stroke={P.slateLight} strokeWidth={1.4} />
        </svg>
      </motion.div>
      <motion.div className="absolute inset-0" initial={{ opacity: 1 }} animate={out} transition={{ duration: 0.55, times: [0, 0.25, 1], ease: [0.36, 0, 0.66, -0.2], delay: T.unscaffold }}>
        <svg viewBox={`${-4} ${-(44 + 26 + 14 + 6)} ${92} ${94}`} className="block h-auto w-full overflow-visible">
          {[0.42, 0.95].map((f) => (
            <g key={f}>
              <rect x={-5} y={-H * f - 1} width={W + 9} height={3} rx={0.6} fill={P.timber} />
              <rect x={-5} y={-H * f + 2} width={W + 9} height={1} fill={P.timberShade} />
              <path d={`M${W + 4} ${-H * f - 1}L${W + 4 + dx} ${-H * f - 1 - dy}v3L${W + 4} ${-H * f + 2}Z`} fill={P.timberShade} />
            </g>
          ))}
        </svg>
      </motion.div>
    </div>
  );
});

/**
 * A construction worker (hard hat, honey vest) carrying a beam on one shoulder from the street to a frame.
 * Walks once on activation (Web Animations, transform only) with a step bob, then sets the beam down.
 */
const WK = { w: 60, h: 40, ax: 30, ay: 37 };
const Worker = memo(function Worker({ slot }: { slot: number }) {
  const el = useRef<HTMLDivElement>(null);
  const sl = SLOTS[slot];
  const frames = useMemo(() => {
    const tf = (u: number, w: number) => {
      const p = at(u, w);
      return `translate(${(((p.x - WK.ax) / WK.w) * 100).toFixed(2)}%, ${(((p.y - WK.ay) / WK.h) * 100).toFixed(2)}%)`;
    };
    // up the street, then across the lot to stand beside the frame (where nearer homes don't hide him)
    const mid = (STREET.u0 + STREET.u1) / 2;
    const w0 = sl.w - 50;
    const w1 = sl.w - 16;
    const toU = sl.side === 'R' ? sl.u + HOUSE_W * 0.92 : sl.u + HOUSE_W * 0.08;
    return [
      { transform: tf(mid, w0), opacity: 0, offset: 0 },
      { transform: tf(mid, w0 + 6), opacity: 1, offset: 0.1 },
      { transform: tf(mid, w1), opacity: 1, offset: 0.42 },
      { transform: tf(toU, w1), opacity: 1, offset: 1 },
    ];
  }, [sl]);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const a = node.animate(frames, { duration: 1700, delay: T.worker * 1000, easing: 'cubic-bezier(0.37, 0, 0.42, 1)', fill: 'both' });
    return () => a.cancel();
  }, [frames]);
  const facing = sl.side === 'R' ? 1 : -1;
  return (
    <div ref={el} className="absolute left-0 top-0" style={{ width: pct(WK.w, VB.w), zIndex: z(sl.w - 16) + 1, opacity: 0, transform: frames[0].transform }}>
      <div className="la-walk" style={{ animationDelay: `${T.worker}s`, animationIterationCount: 10 }}>
        <svg viewBox={`0 0 ${WK.w} ${WK.h}`} className="block h-auto w-full overflow-visible">
          <g transform={`translate(${WK.ax} ${WK.ay}) scale(${facing} 1)`}>
            <Figure kind="adult" skin={3} hair={0} hairStyle="cap" top="honey" bottom="slate" transform="scale(0.28)" />
            {/* the beam over the shoulder */}
            <g transform="rotate(-8)">
              <rect x={-22} y={-24.5} width={40} height={3.4} rx={0.8} fill={P.timber} />
              <rect x={-22} y={-21.6} width={40} height={1.2} fill={P.timberShade} />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
});

/**
 * One family walking up the street to its home: a few small Figures in a line, carried along a polyline on
 * the compositor (Web Animations, transform only), with a light step bob. Fixed depth = its destination's.
 */
type Walk = { lot: number; pts: { u: number; w: number }[]; dur: number; delay: number; family: (typeof FAMILIES)[number] };
const FAM = { w: 50, h: 36, ax: 25, ay: 33 }; // box in viewBox units, feet anchor
const Family = memo(function Family({ walk, reduce }: { walk: Walk; reduce: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const frames = useMemo(() => {
    const tf = (u: number, w: number) => {
      const p = at(u, w);
      return `translate(${(((p.x - FAM.ax) / FAM.w) * 100).toFixed(2)}%, ${(((p.y - FAM.ay) / FAM.h) * 100).toFixed(2)}%)`;
    };
    const [a, b, c] = walk.pts;
    const l1 = Math.abs(b.w - a.w);
    const total = l1 + Math.abs(c.u - b.u) || 1;
    return [
      { transform: tf(a.u, a.w), offset: 0, opacity: 0 },
      { transform: tf(a.u, a.w + 4), offset: 4 / total, opacity: 1 },
      { transform: tf(b.u, b.w), offset: l1 / total, opacity: 1 },
      { transform: tf(c.u, c.w), offset: 1, opacity: 1 },
    ];
  }, [walk]);
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    if (reduce) {
      node.style.transform = frames[frames.length - 1].transform;
      return;
    }
    const anim = node.animate(frames, { duration: walk.dur * 1000, delay: walk.delay * 1000, easing: 'cubic-bezier(0.37, 0, 0.42, 1)', fill: 'both' });
    return () => anim.cancel();
  }, [frames, walk, reduce]);
  const going = walk.pts[2].u < walk.pts[1].u ? -1 : 1;
  const steps = Math.max(2, Math.round(walk.dur / 0.16));
  const f = walk.family;
  return (
    <div ref={el} className="absolute left-0 top-0" style={{ width: pct(FAM.w, VB.w), zIndex: z(walk.pts[2].w) + 1, transform: frames[0].transform, opacity: reduce ? 1 : 0, willChange: 'transform' }}>
      <div className={reduce ? '' : 'la-walk'} style={reduce ? undefined : { animationDelay: `${walk.delay}s`, animationIterationCount: steps }}>
        <svg viewBox={`0 0 ${FAM.w} ${FAM.h}`} className="block h-auto w-full overflow-visible">
          {f.kinds.map((k, j) => (
            <Figure
              key={j}
              kind={k}
              skin={f.skin[j]}
              hair={f.hair[j]}
              hairStyle={j === 0 ? 'short' : k === 'adult' ? 'long' : 'bun'}
              top={f.tops[j]}
              bottom={j % 2 ? 'slate' : 'sky'}
              transform={`translate(${FAM.ax + (j - (f.kinds.length - 1) / 2) * 8.5 * -going} ${FAM.ay - j * 0.8}) scale(0.27)`}
            />
          ))}
        </svg>
      </div>
    </div>
  );
});
