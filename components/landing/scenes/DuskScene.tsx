'use client';
import { memo, useEffect, useState } from 'react';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { P, mix } from '@/lib/illustrationPalette';
import { rng } from '@/components/illustrations/landing/kit';
import { Layer, SceneRoot, useSceneMount } from './Scene';
import { nightStyle } from './parts';

/**
 * Closing band: a street at dusk in one-point perspective, seen from a little above (as from the end of the
 * block). A hundred homes line it and the parallel rows behind, shrinking toward the vanishing point on the
 * right; the sky above the left half stays open for the sentence. The street lamps come on first, then the
 * windows light in a wave from the nearest homes to the farthest while the counter rolls to 100 (each band of
 * homes adds its count as it lights). Stars twinkle; now and then a car's headlights come up the street.
 *
 * Built from one projection (camera 14m up, horizon at y 520 of a 1600×900 world, vanishing point x 1060);
 * each band's geometry is merged into a few paths per material at module load, and each band's lights are
 * one layer whose opacity animates on the compositor. Layers: stars 0.3 · far hills and town 0.55 · street
 * and homes 1 · the near lamp 1.15. Night slots: brighter stars and the moon.
 */
const W = { w: 1600, h: 900 };
const H0 = 520; // horizon
const VPX = 1060;
const F = 800;
const HC = 14; // camera height (m)
const proj = (X: number, Y: number, z: number) => ({ x: VPX + (F * X) / z, y: H0 + (F * (HC - Y)) / z });
const f1 = (v: number) => v.toFixed(1);

type HouseGeo = { side: string; roof: string; front: string; trim: string; eave: string; wins: string; tree: string; shade: boolean };
type Band = { houses: HouseGeo[]; win: string; glow: string; count: number };
type HouseDef = { X0: number; X1: number; z0: number; z1: number; side: 1 | -1; hw: number; hr: number };

/** The homes, nearest first, cut to the hundred the camera sees; grouped in bands by distance. */
const HOMES = (() => {
  const r = rng(23);
  const all: HouseDef[] = [];
  const rows = [11, 31, 51, 71, 91];
  for (const side of [1, -1] as const)
    for (const [k, X0] of rows.entries())
      for (let z = 22 + k * 3; z < 420; z += 13 + r() * 2) {
        const w = 10 + r() * 3;
        all.push({ X0: side * X0, X1: side * (X0 + w), z0: z, z1: z + 9 + r() * 2, side, hw: 3.2 + r() * 0.8, hr: 5.6 + r() * 1.2 });
      }
  const visible = all.filter((h) => {
    const a = proj(h.side > 0 ? h.X0 : h.X1, h.hr, h.z0);
    const b = proj(h.side > 0 ? h.X1 : h.X0, 0, h.z0);
    return Math.max(a.x, b.x) > -40 && Math.min(a.x, b.x) < W.w + 40 && proj(0, 0, h.z0).y < W.h + 120;
  });
  visible.sort((a, b) => a.z0 - b.z0);
  return visible.slice(0, 100);
})();
const BAND_EDGES = [0, 10, 22, 36, 52, 68, 84, 100];
export const LIGHT_AT = (k: number) => 0.55 + k * 0.17;

const poly = (pts: { x: number; y: number }[]) => `M${pts.map((q) => `${f1(q.x)} ${f1(q.y)}`).join('L')}Z`;

const BANDS: Band[] = (() => {
  const out: Band[] = [];
  for (let k = 0; k < BAND_EDGES.length - 1; k++) {
    const b: Band = { houses: [], win: '', glow: '', count: BAND_EDGES[k + 1] - BAND_EDGES[k] };
    // painter's order inside the band: far to near, and each house whole (walls, roof, gable end, tree)
    const hs = HOMES.slice(BAND_EDGES[k], BAND_EDGES[k + 1]).sort((a, c) => c.z0 - a.z0 || Math.abs(c.X0) - Math.abs(a.X0));
    for (const h of hs) {
      const near = h.side > 0 ? Math.min(h.X0, h.X1) : Math.max(h.X0, h.X1); // the wall facing the street
      const far = h.side > 0 ? Math.max(h.X0, h.X1) : Math.min(h.X0, h.X1);
      const mid = (near + far) / 2;
      const inw = h.side * 0.28; // trim width, toward the house
      const p = proj;
      const g: HouseGeo = {
        // the street-facing wall and roof plane (receding), the eave between them, then the gable end facing us
        side: poly([p(near, 0, h.z0), p(near, 0, h.z1), p(near, h.hw, h.z1), p(near, h.hw, h.z0)]),
        roof: poly([p(near - h.side * 0.3, h.hw - 0.1, h.z0), p(near - h.side * 0.3, h.hw - 0.1, h.z1), p(mid, h.hr, h.z1), p(mid, h.hr, h.z0)]),
        eave: poly([p(near - h.side * 0.3, h.hw - 0.1, h.z0), p(near - h.side * 0.3, h.hw - 0.1, h.z1), p(near - h.side * 0.3, h.hw - 0.4, h.z1), p(near - h.side * 0.3, h.hw - 0.4, h.z0)]),
        trim: poly([p(near - h.side * 0.3, 0, h.z0), p(far + h.side * 0.3, 0, h.z0), p(far + h.side * 0.3, h.hw - 0.1, h.z0), p(mid, h.hr + 0.25, h.z0), p(near - h.side * 0.3, h.hw - 0.1, h.z0)]),
        front: poly([p(near + inw * 0.4, 0, h.z0), p(far - inw * 0.4, 0, h.z0), p(far - inw * 0.4, h.hw - 0.35, h.z0), p(mid, h.hr - 0.2, h.z0), p(near + inw * 0.4, h.hw - 0.35, h.z0)]),
        wins: '',
        tree: '',
        shade: h.side < 0,
      };
      // windows: two on the street-facing wall, one in the gable end
      const wins: string[] = [];
      for (const t of [0.2, 0.62]) {
        const za = h.z0 + (h.z1 - h.z0) * t;
        const zb = za + (h.z1 - h.z0) * 0.14;
        wins.push(poly([p(near, 1.3, za), p(near, 1.3, zb), p(near, 2.3, zb), p(near, 2.3, za)]));
      }
      const wx = mid + (far - mid) * 0.35;
      const ww = Math.abs(far - near) * 0.08;
      wins.push(poly([p(wx - ww, 1.3, h.z0), p(wx + ww, 1.3, h.z0), p(wx + ww, 2.3, h.z0), p(wx - ww, 2.3, h.z0)]));
      g.wins = wins.join('');
      b.win += g.wins;
      const g0 = p(near, 0.8, h.z0);
      const g1 = p(near, 2.8, h.z1);
      b.glow += `M${f1(Math.min(g0.x, g1.x) - 2)} ${f1(Math.min(g0.y, g1.y) - 2)}H${f1(Math.max(g0.x, g1.x) + 2)}V${f1(Math.max(g0.y, g1.y) + 2)}H${f1(Math.min(g0.x, g1.x) - 2)}Z`;
      // a round tree in the yard toward the camera, now and then
      if ((h.z0 * 7) % 3 < 1.1) {
        const tz = h.z0 - 2.5;
        const c = p(near + h.side * 1.5, 3.4, tz);
        const rr = (F * 1.9) / tz;
        g.tree = `M${f1(c.x - rr)} ${f1(c.y)}a${f1(rr)} ${f1(rr)} 0 1 1 ${f1(rr * 2)} 0a${f1(rr)} ${f1(rr)} 0 1 1 ${f1(-rr * 2)} 0Z`;
      }
      b.houses.push(g);
    }
    out.push(b);
  }
  return out;
})();

/** The street: sidewalks, asphalt, centre dashes; lamps every 26m on both sides. */
const STREET = (() => {
  const p = proj;
  const quad = (X0: number, X1: number, z0: number, z1: number) => {
    const a = p(X0, 0, z0);
    const b = p(X1, 0, z0);
    const c = p(X1, 0, z1);
    const d = p(X0, 0, z1);
    return `M${f1(a.x)} ${f1(a.y)}L${f1(b.x)} ${f1(b.y)}L${f1(c.x)} ${f1(c.y)}L${f1(d.x)} ${f1(d.y)}Z`;
  };
  let dashes = '';
  for (let z = 16; z < 400; z += 7) dashes += quad(-0.12, 0.12, z, z + 3);
  const lamps: { x: number; top: number; base: number; r: number }[] = [];
  for (const side of [1, -1])
    for (let z = 24 + (side > 0 ? 0 : 13); z < 300; z += 26) {
      const b = p(side * 8.2, 0, z);
      const t = p(side * 8.2, 5.4, z);
      lamps.push({ x: b.x, base: b.y, top: t.y, r: Math.max(0.6, (F * 0.16) / z) });
    }
  return {
    yards: quad(-10.5, 10.5, 14, 600),
    walk: quad(-8.8, 8.8, 14, 600),
    curb: quad(-6.3, 6.3, 14, 600),
    road: quad(-6, 6, 14, 600),
    dashes,
    lamps,
  };
})();

export const DuskScene = memo(function DuskScene({ play, reduce, night = false }: { play: number; reduce: boolean; night?: boolean }) {
  const mounted = useSceneMount(4);
  return (
    <SceneRoot index={4} night={night} testId="closing-scene" skyArt={DUSK_SKY} className="[container-type:size] [--s:max(calc(100cqw/1600),calc(100cqh/900))]">
      {mounted && (
        <>
          <Layer speed={0.3}>
            <Stage>
              <Sky />
            </Stage>
          </Layer>
          <Layer speed={0.55}>
            <Stage>
              <svg viewBox={`0 0 ${W.w} ${W.h}`} className="absolute inset-0 h-full w-full overflow-visible">
                <Far />
              </svg>
            </Stage>
          </Layer>
          <Layer speed={1}>
            <Stage>
              <Town play={play} reduce={reduce} />
              {!reduce && <Headlights />}
              <style>{DUSK_CAR_CSS}</style>
            </Stage>
          </Layer>
        </>
      )}
    </SceneRoot>
  );
});

/** The world box at cover scale: world y 860 sits on the band's bottom edge; world x 860 is the band's centre. */
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute" style={{ left: 'calc(50cqw - var(--s) * 860)', bottom: 'calc(var(--s) * -40)', width: 'calc(var(--s) * 1600)', height: 'calc(var(--s) * 900)' }}>
      {children}
    </div>
  );
}

/** The afterglow low on the left horizon, painted into the sky. */
const DUSK_SKY = <div className="absolute left-[-28%] top-[38%] h-[40%] w-[104%]" style={{ background: `radial-gradient(closest-side, ${P.honeyLight}, transparent)`, opacity: 0.3 }} />;

const STARS: [number, number, number, number][] = (() => {
  const r = rng(7);
  return Array.from({ length: 46 }, () => [Math.round(r() * 1600), Math.round(r() * 420), 0.8 + r() * 1.3, 0.3 + r() * 0.6] as [number, number, number, number]);
})();

/**
 * Stars; a few of the brightest twinkle (small HTML dots, so the twinkle is an opacity change on the
 * compositor, never a repaint of the sky). The afterglow is painted in the sky itself. The moon at night.
 */
const Sky = memo(function Sky() {
  return (
    <>
      <svg viewBox={`0 0 ${W.w} ${W.h}`} className="absolute inset-0 h-full w-full overflow-visible">
        {STARS.map(([x, y, rr, o], i) => (i % 6 === 0 ? null : <circle key={i} cx={x} cy={y} r={rr} fill={P.trim} opacity={o * (y < 300 ? 1 : 0.6)} />))}
        <g className="sc-light" style={nightStyle(0.3)}>
          <circle cx={1380} cy={110} r={40} fill={P.glow} opacity={0.12} />
          <path d="M1388 82a26 26 0 1 0 18 42a21 21 0 1 1 -18 -42Z" fill={P.honeyLight} />
        </g>
      </svg>
      {STARS.map(([x, y], i) =>
        i % 6 === 0 ? (
          <span key={i} className="sc-amb sc-twinkle absolute block h-[3px] w-[3px] rounded-full" style={{ left: `${(x / W.w) * 100}%`, top: `${(y / W.h) * 100}%`, background: P.trim, animationDelay: `${-(i % 7) * 0.45}s` }} />
        ) : null,
      )}
    </>
  );
});

/** The hills on the horizon and the far town beyond the last row: a dotted line of lights. */
const Far = memo(function Far() {
  const r = rng(31);
  const dots = Array.from({ length: 70 }, () => [Math.round(r() * 1700 - 50), H0 + 2 + r() * 10, 0.7 + r() * 0.9] as [number, number, number]);
  return (
    <>
      <path d={`M-400 ${H0 - 6}C-100 ${H0 - 20} 200 ${H0 - 24} 420 ${H0 - 12}C620 ${H0 - 2} 760 ${H0 - 30} 920 ${H0 - 44}C1040 ${H0 - 56} 1160 ${H0 - 40} 1300 ${H0 - 26}C1480 ${H0 - 10} 1700 ${H0 - 18} 2000 ${H0 - 8}V${H0 + 60}H-400Z`} fill={mix(P.duskBottom, P.duskTop, 0.55)} />
      <path d={`M-400 ${H0 + 2}C0 ${H0 - 6} 400 ${H0 - 2} 900 ${H0 - 4}C1300 ${H0 - 6} 1700 ${H0} 2000 ${H0}V${H0 + 80}H-400Z`} fill={mix(P.duskBottom, P.sageDark, 0.25)} />
      {dots.map(([x, y, rr], i) => (
        <circle key={i} cx={x} cy={y} r={rr} fill={i % 3 ? P.honeyLight : P.glow} opacity={0.75} />
      ))}
    </>
  );
});

const Street = memo(function Street() {
  return (
    <>
      <rect x={-400} y={H0 + 6} width={2400} height={W.h} fill={mix(P.duskBottom, P.sageDark, 0.3)} />
      <path d={STREET.yards} fill={mix(P.sageDark, P.duskTop, 0.5)} />
      <path d={STREET.walk} fill={mix(P.stone, P.duskTop, 0.62)} />
      <path d={STREET.curb} fill={mix(P.stoneShade, P.duskTop, 0.55)} />
      <path d={STREET.road} fill={mix(P.asphalt, P.duskTop, 0.42)} />
      <path d={STREET.dashes} fill={mix(P.trim, P.duskTop, 0.5)} />
    </>
  );
});

/**
 * One band of homes (walls, roof, eave, gable end with its trim, unlit windows, a yard tree), each house whole,
 * far to near. Bands farther away sink into the dusk haze.
 */
const HomesBand = memo(function HomesBand({ k }: { k: number }) {
  const haze = Math.min(0.5, k * 0.075);
  const tone = (c: string) => mix(c, P.duskBottom, haze);
  const c = {
    sideLit: tone(mix(P.wall, P.duskTop, 0.56)),
    sideShade: tone(mix(P.wallDeep, P.duskTop, 0.74)),
    roofLit: tone(mix(P.slateLight, P.duskBottom, 0.3)),
    roofShade: tone(mix(P.slateDark, P.duskTop, 0.28)),
    eave: tone(mix(P.trim, P.duskTop, 0.62)),
    trim: tone(mix(P.trim, P.duskTop, 0.52)),
    front: tone(mix(P.wall, P.duskTop, 0.48)),
    glass: tone(mix(P.glass, P.duskTop, 0.55)),
    tree: tone(mix(P.treeDark, P.duskTop, 0.3)),
  };
  return (
    <svg viewBox={`0 0 ${W.w} ${W.h}`} className="absolute inset-0 h-full w-full overflow-visible">
      {BANDS[k].houses.map((h, i) => (
        <g key={i}>
          <path d={h.side} fill={h.shade ? c.sideShade : c.sideLit} />
          <path d={h.roof} fill={h.shade ? c.roofShade : c.roofLit} />
          <path d={h.eave} fill={c.eave} />
          <path d={h.trim} fill={c.trim} />
          <path d={h.front} fill={c.front} />
          <path d={h.wins} fill={c.glass} />
          {h.tree && <path d={h.tree} fill={c.tree} />}
        </g>
      ))}
    </svg>
  );
});

/** Starts dark and turns on `delay` seconds after the section activates (CSS opacity, compositor). */
function lightProps(play: number, reduce: boolean, delay: number) {
  if (reduce) return { className: '', style: undefined };
  if (play === 0) return { className: '', style: { opacity: 0 } };
  return { className: 'sc-on', style: { animationDelay: `${delay}s` } };
}

/** A band's windows lighting (honey glass and a soft glow); replayed on each activation. */
function BandLights({ k, play, reduce }: { k: number; play: number; reduce: boolean }) {
  const b = BANDS[k];
  const l = lightProps(play, reduce, LIGHT_AT(k));
  return (
    <svg viewBox={`0 0 ${W.w} ${W.h}`} className={`absolute inset-0 h-full w-full overflow-visible ${l.className}`} style={l.style}>
      <defs>
        <filter id={`sc-dk-b${k}`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation={Math.max(1.2, 5 - k * 0.6)} />
        </filter>
      </defs>
      <path d={b.glow} fill={P.honey} opacity={0.3 - k * 0.025} filter={`url(#sc-dk-b${k})`} />
      <path d={b.win} fill={P.honeyLight} opacity={1 - k * 0.06} />
    </svg>
  );
}

/** The street lamps: they come on first. */
function LampLights({ play, reduce }: { play: number; reduce: boolean }) {
  const l = lightProps(play, reduce, 0.2);
  return (
    <svg viewBox={`0 0 ${W.w} ${W.h}`} className={`absolute inset-0 h-full w-full overflow-visible ${l.className}`} style={l.style}>
      <defs>
        <radialGradient id="sc-dk-lamp">
          <stop offset="0" stopColor={P.glow} stopOpacity="0.9" />
          <stop offset="0.3" stopColor={P.honeyLight} stopOpacity="0.45" />
          <stop offset="1" stopColor={P.honey} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="sc-dk-pool">
          <stop offset="0" stopColor={P.honeyLight} stopOpacity="0.4" />
          <stop offset="1" stopColor={P.honey} stopOpacity="0" />
        </radialGradient>
      </defs>
      {STREET.lamps.map((m, i) => (
        <g key={i}>
          <ellipse cx={m.x} cy={m.base} rx={m.r * 26} ry={m.r * 6} fill="url(#sc-dk-pool)" />
          <circle cx={m.x} cy={m.top} r={m.r * 9} fill="url(#sc-dk-lamp)" />
          <circle cx={m.x} cy={m.top} r={m.r * 1.4} fill={P.glow} />
        </g>
      ))}
    </svg>
  );
}

/** Lamp posts (always there; their light is LampLights). */
const LampPosts = memo(function LampPosts() {
  return (
    <svg viewBox={`0 0 ${W.w} ${W.h}`} className="absolute inset-0 h-full w-full overflow-visible">
      {STREET.lamps.map((m, i) => (
        <rect key={i} x={m.x - m.r * 0.5} y={m.top} width={m.r} height={m.base - m.top} fill={mix(P.slateDark, P.duskTop, 0.2)} />
      ))}
    </svg>
  );
});

/**
 * The street and the homes, with each band's lights right above its houses (nearer homes cover farther
 * lights), then the lamps. Lights replay on each activation: the lamps first, then the windows band by band,
 * nearest first. Reduced motion: all on.
 */
function Town({ play, reduce }: { play: number; reduce: boolean }) {
  return (
    <>
      <svg viewBox={`0 0 ${W.w} ${W.h}`} className="absolute inset-0 h-full w-full overflow-visible">
        <Street />
      </svg>
      {BANDS.map((_, j) => {
        const k = BANDS.length - 1 - j;
        return (
          <div key={k} className="absolute inset-0">
            <HomesBand k={k} />
            <BandLights key={play} k={k} play={play} reduce={reduce} />
          </div>
        );
      })}
      <LampPosts />
      <LampLights key={play} play={play} reduce={reduce} />
    </>
  );
}

/** Now and then, a car's headlights come up the street toward the camera (CSS; ambient). */
function Headlights() {
  return (
    <div className="sc-amb sc-dusk-car absolute left-0 top-0 h-full w-full">
      <div className="sc-amb sc-dusk-car-s absolute" style={{ left: 0, top: 0, width: '3%', aspectRatio: '3', transformOrigin: '50% 50%' }}>
        <svg viewBox="0 0 30 10" className="block h-full w-full overflow-visible">
          <ellipse cx={15} cy={6} rx={18} ry={6} fill={P.honeyLight} opacity={0.35} />
          <circle cx={9} cy={5} r={2.2} fill={P.glow} />
          <circle cx={21} cy={5} r={2.2} fill={P.glow} />
        </svg>
      </div>
    </div>
  );
}

/** The closing's counter: rolls up band by band as the windows light (10, 22, 36 … 100). */
export function DuskCount({ reduce, format }: { reduce: boolean; format: (n: number) => string }) {
  const [v, setV] = useState(reduce ? 100 : 0);
  useEffect(() => {
    if (reduce) return;
    const timers = BAND_EDGES.slice(1).map((n, k) => setTimeout(() => setV(n), (LIGHT_AT(k) + 0.12) * 1000));
    return () => timers.forEach(clearTimeout);
  }, [reduce]);
  return <AnimatedNumber value={v} format={format} />;
}

/** Keyframes for the headlights: sampled from the projection (right lane, from far to near). */
export const DUSK_CAR_CSS = (() => {
  const pos: string[] = [];
  const scl: string[] = [];
  const zs = [380, 240, 160, 110, 80, 60, 46, 36, 29, 24];
  zs.forEach((z, i) => {
    const pct = Math.round((i / (zs.length - 1)) * 60);
    const c = proj(-3, 0.7, z);
    // the box is 3% of the stage wide, centred on the point
    pos.push(`${pct}% { transform: translate(${f1((c.x / W.w) * 100 - 1.5)}%, ${f1((c.y / W.h) * 100 - 0.5)}%); opacity: ${i === 0 ? 0 : 1}; }`);
    scl.push(`${pct}% { transform: scale(${(Math.min(9, (F * 0.42) / z / 6)).toFixed(3)}); }`);
  });
  pos.push(`61%, 100% { transform: translate(${f1((proj(-3, 0.7, 24).x / W.w) * 100 - 1.5)}%, 110%); opacity: 0; }`);
  scl.push(`61%, 100% { transform: scale(1); }`);
  return `@keyframes sc-dusk-car { ${pos.join(' ')} } @keyframes sc-dusk-car-s { ${scl.join(' ')} } .sc-dusk-car { animation: sc-dusk-car 12s linear 2s infinite both; } .sc-dusk-car-s { animation: sc-dusk-car-s 12s linear 2s infinite both; } @media (prefers-reduced-motion: reduce) { .sc-dusk-car { display: none; } }`;
})();
