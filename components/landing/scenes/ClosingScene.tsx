'use client';
import { memo, useEffect, useState } from 'react';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { P, mix } from '@/lib/illustrationPalette';
import { rng } from '@/components/illustrations/landing/kit';
import { Layer, SceneRoot, useSceneMount } from './Scene';
import { StreetLamp, nightStyle } from './parts';
import { Hills, Tree } from '@/components/illustrations/kit';

/**
 * Closing band: a street at dusk in one-point perspective, seen from a little above (as from the end of the
 * block). A hundred homes line it and the parallel rows behind, shrinking toward the vanishing point on the
 * right; the sky above the left half stays open for the sentence. Resting state (play 0): every lamp and
 * window lit. On each activation the lights replay: the street lamps come on first, then the windows light in
 * a wave from the nearest homes to the farthest while the counter rolls to 100 (each band of homes adds its
 * count as it lights). The homes, street and sky never leave the screen. The one ambient motion: now and then
 * a car's headlights come up the street.
 *
 * Drawn in the shared illustration language (components/illustrations/kit.tsx): layered hills on the horizon
 * sinking into the dusk haze, palms along the parkway, yard trees in two tones on their trunks, occlusion
 * where each home meets its yard, window glows as soft gradients (no filters).
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

type HouseGeo = { side: string; roof: string; front: string; trim: string; eave: string; wins: string; tree: string; treeLit: string; trunk: string; shade: boolean };
type Glow = { cx: number; cy: number; rx: number; ry: number };
type Band = { houses: HouseGeo[]; win: string; glows: Glow[]; ao: string; ground: string; count: number };
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
    const b: Band = { houses: [], win: '', glows: [], ao: '', ground: '', count: BAND_EDGES[k + 1] - BAND_EDGES[k] };
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
        treeLit: '',
        trunk: '',
        shade: h.side < 0,
      };
      // occlusion where the wall meets the yard, and the shadow it casts toward the street (the light is
      // top-left, so the homes on the left throw theirs across their front yards)
      b.ao += poly([p(near, 0, h.z0), p(near, 0, h.z1), p(near, 0.7, h.z1), p(near, 0.7, h.z0)]);
      const reach = h.side < 0 ? 2 : 0.7;
      b.ground += poly([p(near, 0, h.z0), p(near, 0, h.z1), p(near - h.side * reach, 0, h.z1 - 0.6), p(near - h.side * reach, 0, h.z0 + 0.4)]);
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
      b.glows.push({ cx: (g0.x + g1.x) / 2, cy: (g0.y + g1.y) / 2, rx: Math.abs(g1.x - g0.x) / 2 + 6, ry: Math.abs(g1.y - g0.y) / 2 + 6 });
      // a round tree in the yard toward the camera, now and then: a trunk, a crown in two tones (lit
      // top-left), its contact shadow on the yard
      if ((h.z0 * 7) % 3 < 1.1) {
        const tz = h.z0 - 2.5;
        const tx = near + h.side * 1.5;
        const c = p(tx, 3.4, tz);
        const rr = (F * 1.9) / tz;
        const circle = (x: number, y: number, r: number) => `M${f1(x - r)} ${f1(y)}a${f1(r)} ${f1(r)} 0 1 1 ${f1(r * 2)} 0a${f1(r)} ${f1(r)} 0 1 1 ${f1(-r * 2)} 0Z`;
        g.tree = circle(c.x, c.y, rr);
        g.treeLit = circle(c.x - rr * 0.22, c.y - rr * 0.24, rr * 0.7);
        const t0 = p(tx - 0.16, 0, tz);
        const t1 = p(tx + 0.16, 1.8, tz);
        g.trunk = `M${f1(t0.x)} ${f1(t0.y)}H${f1(t1.x)}V${f1(t1.y)}H${f1(t0.x)}Z`;
        const sh = p(tx + 0.9, 0, tz);
        b.ground += `M${f1(sh.x - rr)} ${f1(sh.y)}a${f1(rr)} ${f1(rr * 0.22)} 0 1 1 ${f1(rr * 2)} 0a${f1(rr)} ${f1(rr * 0.22)} 0 1 1 ${f1(-rr * 2)} 0Z`;
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

/** Palms along the parkway, between the lamps, both sides of the street (nearest first). */
const PALMS = (() => {
  const out: { x: number; base: number; size: number; haze: number; lean: number }[] = [];
  for (const side of [1, -1])
    for (let z = side > 0 ? 37 : 50; z < 200; z += 26) {
      const b = proj(side * 7.4, 0, z);
      out.push({ x: b.x, base: b.y, size: (F * 11) / z, haze: Math.min(0.55, z / 260), lean: side > 0 ? 5 : -5 });
    }
  return out.sort((a, b) => a.size - b.size);
})();

export const ClosingScene = memo(function ClosingScene({ play, reduce, night = false }: { play: number; reduce: boolean; night?: boolean }) {
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
const DUSK_SKY = <div className="il-day absolute left-[-28%] top-[38%] h-[40%] w-[104%]" style={{ background: `radial-gradient(closest-side, ${P.honeyLight}, transparent)`, opacity: 0.3 }} />;

const STARS: [number, number, number, number][] = (() => {
  const r = rng(7);
  return Array.from({ length: 46 }, () => [Math.round(r() * 1600), Math.round(r() * 420), 0.8 + r() * 1.3, 0.3 + r() * 0.6] as [number, number, number, number]);
})();

/** Stars (the brightest as small HTML dots); the afterglow is painted in the sky itself. The moon at night. */
const Sky = memo(function Sky() {
  return (
    <>
      <svg viewBox={`0 0 ${W.w} ${W.h}`} className="absolute inset-0 h-full w-full overflow-visible">
        {STARS.map(([x, y, rr, o], i) => (i % 6 === 0 ? null : <circle key={i} cx={x} cy={y} r={rr} fill={P.trim} opacity={o * (y < 300 ? 1 : 0.6)} />))}
        <g className="sc-light" style={nightStyle(0.3)}>
          <circle cx={1380} cy={250} r={40} fill={P.glow} opacity={0.12} />
          <path d="M1388 222a26 26 0 1 0 18 42a21 21 0 1 1 -18 -42Z" fill={P.honeyLight} />
        </g>
      </svg>
      {STARS.map(([x, y], i) =>
        i % 6 === 0 ? <span key={i} className="absolute block h-[3px] w-[3px] rounded-full" style={{ left: `${(x / W.w) * 100}%`, top: `${(y / W.h) * 100}%`, background: P.trim }} /> : null,
      )}
    </>
  );
});

/** Layered hills on the horizon, sinking into the dusk haze, and the far town beyond the last row: a dotted line of lights. */
const DUSK_HILL: [string, string, string] = [mix(P.duskBottom, P.honey, 0.14), mix(P.duskBottom, P.duskTop, 0.4), mix(P.duskTop, P.ink, 0.25)];
const Far = memo(function Far() {
  const r = rng(31);
  const dots = Array.from({ length: 70 }, () => [Math.round(r() * 1700 - 50), H0 + 2 + r() * 10, 0.7 + r() * 0.9] as [number, number, number]);
  return (
    <>
      <Hills
        x0={-400}
        x1={2000}
        bottom={H0 + 80}
        hazeTo={P.duskBottom}
        layers={[
          { y: H0 - 30, haze: 0.45, waves: 3, tones: DUSK_HILL, points: [[-400, H0 - 6], [0, H0 - 22], [420, H0 - 12], [760, H0 - 30], [940, H0 - 46], [1160, H0 - 40], [1400, H0 - 20], [1700, H0 - 18], [2000, H0 - 8]] },
          { y: H0 - 6, haze: 0.2, waves: 5, tones: DUSK_HILL, points: [[-400, H0 + 2], [200, H0 - 8], [600, H0 - 2], [1000, H0 - 10], [1400, H0 - 4], [2000, H0]] },
        ]}
      />
      {dots.map(([x, y, rr], i) => (
        <circle key={i} cx={x} cy={y} r={rr} fill={i % 3 ? P.honeyLight : P.glow} opacity={0.75} />
      ))}
    </>
  );
});

const Street = memo(function Street() {
  return (
    <>
      <defs>
        <linearGradient id="sc-dk-ground" x1="0" y1={H0} x2="0" y2={W.h} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={mix(P.duskBottom, P.sageDark, 0.2)} />
          <stop offset="1" stopColor={mix(P.sageDark, P.duskTop, 0.45)} />
        </linearGradient>
      </defs>
      <rect x={-400} y={H0 + 6} width={2400} height={W.h} fill="url(#sc-dk-ground)" />
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
    tree: tone(mix(P.foliageDeep, P.duskTop, 0.3)),
    treeLit: tone(mix(P.foliageLight, P.duskTop, 0.4)),
    trunk: tone(mix(P.bark, P.duskTop, 0.55)),
  };
  // each face is its own element, so an objectBoundingBox gradient models its light: walls darken toward
  // the ground (occlusion), the gable end is lit from the top-left, roofs catch the sky at the ridge
  const g = (name: string) => `url(#sc-dk-${name}${k})`;
  const grad = (name: string, a: string, b: string, x2 = 0, y2 = 1) => (
    <linearGradient id={`sc-dk-${name}${k}`} x1="0" y1="0" x2={x2} y2={y2}>
      <stop offset="0" stopColor={a} />
      <stop offset="1" stopColor={b} />
    </linearGradient>
  );
  return (
    <svg viewBox={`0 0 ${W.w} ${W.h}`} className="absolute inset-0 h-full w-full overflow-visible">
      <defs>
        {grad('sl', mix(c.sideLit, P.trim, 0.08), mix(c.sideLit, P.ink, 0.16))}
        {grad('ss', c.sideShade, mix(c.sideShade, P.ink, 0.2))}
        {grad('rl', mix(c.roofLit, P.trim, 0.12), mix(c.roofLit, P.ink, 0.12))}
        {grad('rs', mix(c.roofShade, P.slateLight, 0.25), c.roofShade)}
        {grad('fr', mix(c.front, P.trim, 0.12), mix(c.front, P.ink, 0.14), 1, 1)}
      </defs>
      <path d={BANDS[k].ground} fill={P.ink} opacity={0.22 * (1 - haze)} />
      {BANDS[k].houses.map((h, i) => (
        <g key={i}>
          <path d={h.side} fill={g(h.shade ? 'ss' : 'sl')} />
          <path d={h.roof} fill={g(h.shade ? 'rs' : 'rl')} />
          <path d={h.eave} fill={c.eave} />
          <path d={h.trim} fill={c.trim} />
          <path d={h.front} fill={g('fr')} />
          <path d={h.wins} fill={c.glass} />
          {h.tree && (
            <>
              <path d={h.trunk} fill={c.trunk} />
              <path d={h.tree} fill={c.tree} />
              <path d={h.treeLit} fill={c.treeLit} />
            </>
          )}
        </g>
      ))}
      <path d={BANDS[k].ao} fill={P.ink} opacity={0.3 * (1 - haze)} />
    </svg>
  );
});

/** Starts dark and turns on `delay` seconds after the section activates (CSS opacity, compositor). */
function lightProps(play: number, reduce: boolean, delay: number) {
  // at rest (play 0) and under reduced motion every light is on; a replay switches them on again in turn
  if (reduce || play === 0) return { className: '', style: undefined };
  return { className: 'sc-on', style: { animationDelay: `${delay}s` } };
}

/** A band's windows lighting (honey glass and a soft glow); replayed on each activation. */
function BandLights({ k, play, reduce }: { k: number; play: number; reduce: boolean }) {
  const b = BANDS[k];
  const l = lightProps(play, reduce, LIGHT_AT(k));
  return (
    <svg viewBox={`0 0 ${W.w} ${W.h}`} className={`absolute inset-0 h-full w-full overflow-visible ${l.className}`} style={l.style}>
      <defs>
        <radialGradient id={`sc-dk-g${k}`}>
          <stop offset="0" stopColor={P.honey} stopOpacity="0.5" />
          <stop offset="1" stopColor={P.honey} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g opacity={0.8 - k * 0.06}>
        {b.glows.map((g, i) => (
          <ellipse key={i} cx={f1(g.cx)} cy={f1(g.cy)} rx={f1(g.rx)} ry={f1(g.ry)} fill={`url(#sc-dk-g${k})`} />
        ))}
      </g>
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
      {STREET.lamps.map((m, i) => {
        // a StreetLamp's head sits at the end of its arm, over the street (see LampPosts)
        const k = (m.base - m.top) / 80;
        const drawn = m.base - m.top > 46;
        const hx = drawn ? m.x + (m.x > VPX ? -13 : 13) * k : m.x;
        const hy = drawn ? m.top - 1 * k : m.top;
        return (
          <g key={i}>
            <ellipse cx={hx} cy={m.base} rx={m.r * 26} ry={m.r * 6} fill="url(#sc-dk-pool)" />
            <circle cx={hx} cy={hy} r={m.r * 9} fill="url(#sc-dk-lamp)" />
            <circle cx={hx} cy={hy} r={m.r * 1.4} fill={P.glow} />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * The lamp posts (always there; their light is LampLights, which comes on with the section). The nearest
 * ones are the landing's shared StreetLamp, their arms reaching over the street; far down the street they
 * shrink to posts.
 */
const LampPosts = memo(function LampPosts() {
  return (
    <svg viewBox={`0 0 ${W.w} ${W.h}`} className="absolute inset-0 h-full w-full overflow-visible">
      {STREET.lamps.map((m, i) =>
        m.base - m.top > 46 ? (
          // right side: mirrored, so the arm reaches toward the street
          <g key={i} transform={m.x > VPX ? `translate(${(2 * m.x).toFixed(1)} 0) scale(-1 1)` : undefined}>
            <StreetLamp x={m.x} base={m.base} h={m.base - m.top} lit="none" />
          </g>
        ) : (
          <rect key={i} x={m.x - m.r * 0.5} y={m.top} width={m.r} height={m.base - m.top} fill={mix(P.pineDark, P.duskTop, 0.2)} />
        ),
      )}
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
      <Palms />
      <LampPosts />
      <LampLights key={`lamps${play}`} play={play} reduce={reduce} />
    </>
  );
}

/** The parkway palms (the kit's palm), farther ones deeper in the dusk haze. */
const Palms = memo(function Palms() {
  return (
    <svg viewBox={`0 0 ${W.w} ${W.h}`} className="absolute inset-0 h-full w-full overflow-visible">
      {PALMS.map((m, i) => (
        <Tree key={i} species="palm" x={m.x} base={m.base} size={m.size} lean={m.lean} haze={Math.min(0.75, 0.35 + m.haze)} hazeTo={P.duskTop} shadow={0.8} />
      ))}
    </svg>
  );
});

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
