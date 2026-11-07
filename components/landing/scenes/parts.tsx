'use client';
import { useId } from 'react';
import { P, mix } from '@/lib/illustrationPalette';

/**
 * Small shaded SVG pieces shared by the landing scenes. Same light as everywhere: from the top-left, so
 * fronts and tops are lit, right faces and undersides fall into shade, shadows fall right. Each draws
 * inside a parent <svg>, anchored at (x, base) = bottom-left (houses) or bottom-centre (everything else).
 *
 * Colours come only from the palette (P, mix): never parsed, never given hex alpha. Translucency is the
 * opacity attribute. `haze` (0–1) pushes a piece toward `hazeTo` for distance (aerial perspective).
 *
 * Night slots: anything that lights up at night (windows, porch lights, headlights) is its own element with
 * the class `sc-light` and a stagger delay in --d; invisible by day, it fades in under the dark theme (or a
 * scene's data-night). Street and table lamps have their own classes (.sc-lamp, see StreetLamp).
 */
/** Rounds to 0.1 (trigonometry can differ in the last digit between the server and the browser). */
export const r1 = (v: number) => Math.round(v * 10) / 10;

export const toward = (c: string, haze: number, to: string = P.skyBottom) => (haze > 0 ? mix(c, to, haze) : c);

/** A light that switches on at night, `delay` seconds into the stagger. */
export function nightStyle(delay: number): React.CSSProperties {
  return { ['--d' as string]: `${delay.toFixed(2)}s` };
}

/** A soft cumulus: shaded underside, lit puffs, a highlight on the top-left. viewBox 200×84, base at the bottom. */
export function CloudShape({ shade = 0.12 }: { shade?: number }) {
  return (
    <>
      <path d="M18 70C4 70 0 56 12 50C8 36 26 28 38 34C42 18 64 12 76 24C84 8 112 6 122 24C134 14 158 18 160 36C178 34 194 46 188 60C194 70 184 76 172 74Z" fill={mix(P.skyTop, P.slateLight, shade)} opacity={0.5} />
      <path d="M22 64C10 64 8 52 18 47C15 35 30 29 40 34C45 21 63 16 74 26C82 13 108 12 117 27C128 18 150 22 152 38C168 37 182 47 176 58C180 64 172 68 162 66Z" fill={P.trim} opacity={0.94} />
      <path d="M40 40C46 26 62 22 72 31C80 20 100 18 110 30" fill="none" stroke={P.trim} strokeWidth={6} strokeLinecap="round" opacity={0.7} />
    </>
  );
}

/** Three birds in a loose V (stroke only). Origin top-left, about 60×20. */
export function BirdsShape({ color = P.slate }: { color?: string }) {
  return (
    <>
      {[
        [4, 12, 1],
        [22, 5, 0.8],
        [40, 14, 0.9],
      ].map(([x, y, s], i) => (
        <path key={i} d={`M${x} ${y}q${5 * s} ${-5 * s} ${10 * s} 0q${5 * s} ${-5 * s} ${10 * s} 0`} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" opacity={0.55} />
      ))}
    </>
  );
}

export type HouseLook = { roof: 'gable' | 'hip'; wall?: string; solar?: boolean; chimney?: boolean; door?: 'left' | 'right'; garage?: boolean };

/**
 * A street-facing house: lit front wall, receding side wall in shade, gable or hip roof with a trim line,
 * windows with sills and a mullion, a door, optional garage, solar and chimney, a contact shadow and a
 * long late-afternoon shadow falling right on the lawn. Night slot: the windows and the porch light.
 */
export function House({ x, base, w, h, look, haze = 0, hazeTo, light = 0, shadow = 1 }: { x: number; base: number; w: number; h: number; look: HouseLook; haze?: number; hazeTo?: string; light?: number; shadow?: number }) {
  const f = (c: string) => toward(c, haze, hazeTo);
  const side = w * 0.3;
  const dy = side * 0.45;
  const roofH = look.roof === 'gable' ? h * 0.66 : h * 0.44;
  const wall = look.wall ?? P.wall;
  const top = base - h;
  const winW = w * 0.2;
  const winH = h * 0.3;
  const doorLeft = look.door === 'left';
  const doorX = doorLeft ? x + w * 0.14 : x + w * 0.62;
  const winX = doorLeft ? x + w * 0.56 : x + w * 0.14;
  const win2X = look.garage ? null : doorLeft ? x + w * 0.8 - winW * 0.6 : null;
  const garage = look.garage;
  const sideWinX = x + w + side * 0.3;
  return (
    <g>
      {/* long shadow on the lawn, falling right, and a contact shadow */}
      {shadow > 0 && <path d={`M${x + w * 0.2} ${base}H${x + w + side}L${x + w + side + w * 0.9} ${base + 5}H${x + w * 0.5}Z`} fill={P.ink} opacity={0.06 * shadow} />}
      <rect x={x - 1} y={base - 1.2} width={w + side + 2} height={2.4} fill={P.ink} opacity={0.08} />
      {/* side wall (shade) */}
      <path d={`M${x + w} ${base}L${x + w + side} ${base - dy}V${top - dy}L${x + w} ${top}Z`} fill={f(mix(wall, P.wallDeep, 0.72))} />
      <path d={`M${sideWinX} ${top + h * 0.34 - dy * 0.3}l${side * 0.36} ${-dy * 0.36}v${h * 0.28}l${-side * 0.36} ${dy * 0.36}Z`} fill={f(mix(P.glass, P.wallDeep, 0.25))} />
      {/* front wall (lit), with light falling off toward the right */}
      <rect x={x} y={top} width={w} height={h} fill={f(wall)} />
      <rect x={x + w * 0.62} y={top} width={w * 0.38} height={h} fill={f(mix(wall, P.wallShade, 0.4))} opacity={0.5} />
      {/* roof */}
      {look.roof === 'gable' ? (
        <>
          <path d={`M${x - 2} ${top + 1}L${x + w / 2} ${top - roofH}L${x + w + 2} ${top + 1}Z`} fill={f(mix(wall, P.trim, 0.45))} />
          <path d={`M${x + w / 2} ${top - roofH}L${x + w / 2 + side} ${top - roofH - dy}L${x + w + side + 3} ${top - dy + 2}L${x + w + 3} ${top + 2}Z`} fill={f(P.slateLight)} />
          <path d={`M${x + w / 2 + side * 0.5} ${top - roofH - dy * 0.5}L${x + w + side * 0.5 + 3} ${top - dy * 0.5 + 2}`} stroke={f(P.slate)} strokeWidth={0.8} opacity={0.5} />
          <path d={`M${x - 3} ${top + 2}L${x + w / 2} ${top - roofH - 1}L${x + w + 3} ${top + 2}`} fill="none" stroke={f(P.trim)} strokeWidth={1.8} strokeLinejoin="round" />
          {look.solar && <path d={`M${x + w / 2 + side * 0.2 + 3} ${top - roofH * 0.8 - dy * 0.2}L${x + w / 2 + side * 0.85} ${top - roofH * 0.8 - dy * 0.85}L${x + w + side * 0.85 - 3} ${top - dy * 0.85 - 5}L${x + w + side * 0.2} ${top - dy * 0.2 - 5}Z`} fill={f(P.solar)} />}
          <rect x={x + w / 2 - w * 0.07} y={top - roofH * 0.48} width={w * 0.14} height={roofH * 0.26} fill={f(P.glass)} />
        </>
      ) : (
        <>
          <path d={`M${x - 3} ${top + 1}L${x + w * 0.22} ${top - roofH}H${x + w * 0.78 + side}L${x + w + side + 3} ${top - dy + 1}L${x + w + 3} ${top + 1}Z`} fill={f(P.slate)} />
          <path d={`M${x - 3} ${top + 1}L${x + w * 0.22} ${top - roofH}H${x + w * 0.78}L${x + w + 3} ${top + 1}Z`} fill={f(P.slateLight)} />
          <path d={`M${x - 3} ${top + 1}L${x + w * 0.22} ${top - roofH}H${x + w * 0.4}L${x + w * 0.2} ${top + 1}Z`} fill={f(mix(P.slateLight, P.trim, 0.18))} />
          {look.solar && <path d={`M${x + w * 0.3} ${top - roofH * 0.82}H${x + w * 0.74}L${x + w * 0.84} ${top - roofH * 0.25}H${x + w * 0.22}Z`} fill={f(P.solar)} />}
        </>
      )}
      {look.chimney && (
        <>
          <rect x={x + w * 0.68} y={top - roofH * 0.95} width={w * 0.09} height={roofH * 0.6} fill={f(P.stone)} />
          <rect x={x + w * 0.68 + w * 0.05} y={top - roofH * 0.95} width={w * 0.04} height={roofH * 0.6} fill={f(P.stoneShade)} />
        </>
      )}
      {/* windows (sill + mullion) */}
      {[winX, win2X].map((wx) =>
        wx === null ? null : (
          <g key={wx}>
            <rect x={wx} y={top + h * 0.26} width={winW} height={winH} fill={f(P.glass)} />
            <path d={`M${wx} ${top + h * 0.26}h${winW * 0.45}l${-winW * 0.3} ${winH}h${-winW * 0.15}Z`} fill={f(P.glassLight)} opacity={0.45} />
            <rect x={wx + winW / 2 - 0.6} y={top + h * 0.26} width={1.2} height={winH} fill={f(P.trim)} />
            <rect x={wx - 1.5} y={top + h * 0.26 + winH} width={winW + 3} height={2} fill={f(P.trim)} />
          </g>
        ),
      )}
      {/* door, or a garage */}
      {garage ? (
        <>
          <rect x={x + w * 0.5} y={base - h * 0.62} width={w * 0.42} height={h * 0.62} fill={f(P.trimShade)} />
          {[0.2, 0.4, 0.6, 0.8].map((k) => (
            <rect key={k} x={x + w * 0.5} y={base - h * 0.62 + h * 0.62 * k} width={w * 0.42} height={1} fill={f(P.stoneShade)} />
          ))}
        </>
      ) : (
        <>
          <rect x={doorX} y={base - h * 0.58} width={w * 0.17} height={h * 0.58} fill={f(P.pine)} />
          <rect x={doorX} y={base - h * 0.58} width={w * 0.06} height={h * 0.58} fill={f(P.pineLight)} />
        </>
      )}
      {/* night: lit windows and the porch light */}
      <g className="sc-light" style={nightStyle(light)}>
        {[winX, win2X].map((wx) => (wx === null ? null : <rect key={wx} x={wx} y={top + h * 0.26} width={winW} height={winH} fill={P.honey} />))}
        <circle cx={garage ? x + w * 0.44 : doorX - 2.5} cy={base - h * 0.5} r={2.2} fill={P.glow} />
        <circle cx={garage ? x + w * 0.44 : doorX - 2.5} cy={base - h * 0.5} r={7} fill={P.honey} opacity={0.3} />
      </g>
    </g>
  );
}

/**
 * A Mexican fan palm (the OC street palm): a slim trunk with ring marks, curving with `lean`, and a crown of
 * fronds in two tones. The crown sways a little (ambient; paused when the scene is inactive).
 */
export function Palm({ x, base, h, lean = 4, haze = 0, hazeTo, sway = true, delay = 0 }: { x: number; base: number; h: number; lean?: number; haze?: number; hazeTo?: string; sway?: boolean; delay?: number }) {
  const f = (c: string) => toward(c, haze, hazeTo);
  const tx = x + lean;
  const ty = base - h;
  const frond = (a: number, len: number, c: string) => {
    const r = (a * Math.PI) / 180;
    const ex = r1(tx + Math.cos(r) * len);
    const ey = r1(ty + Math.sin(r) * len * 0.75 + len * 0.2);
    const mx = r1(tx + Math.cos(r) * len * 0.55);
    const my = r1(ty + Math.sin(r) * len * 0.55 - len * 0.16);
    return <path key={a} d={`M${tx} ${ty}Q${mx} ${my} ${ex} ${ey}Q${mx} ${my + len * 0.08} ${tx} ${ty + 2}Z`} fill={f(c)} />;
  };
  const len = Math.max(18, h * 0.3);
  return (
    <g>
      <path d={`M${x - 2.6} ${base}Q${x + lean * 0.3} ${base - h * 0.5} ${tx - 1.7} ${ty}H${tx + 1.7}Q${x + lean * 0.3 + 3.4} ${base - h * 0.5} ${x + 2.6} ${base}Z`} fill={f(P.bark)} />
      <path d={`M${x + 0.6} ${base}Q${x + lean * 0.3 + 2.2} ${base - h * 0.5} ${tx + 0.4} ${ty}H${tx + 1.7}Q${x + lean * 0.3 + 3.4} ${base - h * 0.5} ${x + 2.6} ${base}Z`} fill={f(mix(P.bark, P.ink, 0.22))} />
      <g className={sway ? 'sc-amb sc-sway' : undefined} style={sway ? { transformOrigin: `${tx}px ${ty}px`, animationDelay: `${-delay}s` } : undefined}>
        {[196, 226, 160, 336, 302, 18, 250].map((a, i) => frond(a, len * (i === 6 ? 0.7 : 1), i % 2 ? P.tree : P.treeLight))}
        <circle cx={tx} cy={ty + 1} r={2.4} fill={f(P.bark)} />
      </g>
    </g>
  );
}

/**
 * The landing's street lamp, one design for every outdoor scene: a dark pine pole on a small plinth, a
 * swan-neck arm, a brass head with a glass bulb. Drawn inside a parent <svg> at (x, base) = the pole's foot;
 * `h` is the pole's height in that svg's units.
 *
 * Light: off by day, on at night (the dark theme, or a scene's data-night). When the theme switches the lamps
 * along a street come on, or go off, one after another: give each lamp its place along the street in `i`
 * (CSS transition-delay i × 80ms); the first one (`flicker`, default when i is 0) flickers before it holds.
 * Lit, it shows a warm bulb, a halo, a soft cone of light under the head and a pool on the ground; `pool`
 * stretches the pool along the road (1 = round). `lit="always"` keeps it on regardless of the theme (a dusk
 * scene that lights its own lamps). CSS: .sc-lamp in app/globals.css (r6:scenes).
 */
export function StreetLamp({ x, base, h = 80, i = 0, flicker, pool = 1.6, lit = 'theme' }: { x: number; base: number; h?: number; i?: number; flicker?: boolean; pool?: number; lit?: 'theme' | 'always' }) {
  const id = `sl${useId().replace(/:/g, '')}`;
  const k = h / 80; // the drawing is designed at h = 80
  const top = base - h;
  const hx = x + 13 * k; // the head's centre
  const hy = top - 3 * k;
  const lightCls = lit === 'always' ? '' : `sc-lamp${(flicker ?? i === 0) ? ' sc-lamp-flicker' : ''}`;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-cone`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={P.honeyLight} stopOpacity="0.55" />
          <stop offset="1" stopColor={P.honeyLight} stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-pool`}>
          <stop offset="0" stopColor={P.honeyLight} stopOpacity="0.6" />
          <stop offset="0.6" stopColor={P.honey} stopOpacity="0.2" />
          <stop offset="1" stopColor={P.honey} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" stopColor={P.glow} stopOpacity="0.9" />
          <stop offset="0.35" stopColor={P.honeyLight} stopOpacity="0.4" />
          <stop offset="1" stopColor={P.honey} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* contact shadow (falls right) */}
      <ellipse cx={x + 6 * k} cy={base} rx={9 * k} ry={1.8 * k} fill={P.ink} opacity={0.14} />
      {/* night: the pool on the ground and the cone under the head (behind the pole) */}
      <g className={lightCls} style={{ ['--i' as string]: i }}>
        <ellipse cx={hx} cy={base + 1} rx={20 * k * pool} ry={5 * k} fill={`url(#${id}-pool)`} />
        <path d={`M${hx - 3.4 * k} ${hy + 2 * k}L${hx + 3.4 * k} ${hy + 2 * k}L${hx + 17 * k * Math.min(pool, 1.4)} ${base}L${hx - 17 * k * Math.min(pool, 1.4)} ${base}Z`} fill={`url(#${id}-cone)`} />
      </g>
      {/* plinth, pole (lit left edge), swan-neck arm */}
      <path d={`M${x - 3.6 * k} ${base}l${0.8 * k} ${-6 * k}h${5.6 * k}l${0.8 * k} ${6 * k}Z`} fill={P.pineDark} />
      <rect x={x - 1.7 * k} y={top} width={3.4 * k} height={h - 5 * k} fill={P.pineDark} />
      <rect x={x - 1.7 * k} y={top} width={1.2 * k} height={h - 5 * k} fill={P.pine} />
      <path d={`M${x} ${top + 2 * k}C${x} ${top - 8 * k} ${x + 6 * k} ${top - 9 * k} ${hx} ${top - 8 * k}`} fill="none" stroke={P.pineDark} strokeWidth={2.4 * k} strokeLinecap="round" />
      {/* brass head: lit top, shaded underside, the glass bulb below */}
      <path d={`M${hx - 6 * k} ${hy - 1 * k}Q${hx} ${hy - 8 * k} ${hx + 6 * k} ${hy - 1 * k}Z`} fill={P.brass} />
      <path d={`M${hx - 6 * k} ${hy - 1 * k}Q${hx - 3 * k} ${hy - 6 * k} ${hx} ${hy - 6.6 * k}V${hy - 1 * k}Z`} fill={P.honey} opacity={0.7} />
      <rect x={hx - 6.4 * k} y={hy - 1.4 * k} width={12.8 * k} height={1.8 * k} rx={0.6 * k} fill={P.brassDark} />
      <path d={`M${hx - 3.2 * k} ${hy + 0.4 * k}h${6.4 * k}l${-0.8 * k} ${2.6 * k}h${-4.8 * k}Z`} fill={mix(P.glassLight, P.trim, 0.4)} />
      {/* night: the warm bulb and its halo */}
      <g className={lightCls} style={{ ['--i' as string]: i }}>
        <circle cx={hx} cy={hy + 2 * k} r={16 * k} fill={`url(#${id}-halo)`} />
        <path d={`M${hx - 3.2 * k} ${hy + 0.4 * k}h${6.4 * k}l${-0.8 * k} ${2.6 * k}h${-4.8 * k}Z`} fill={P.glow} />
      </g>
    </g>
  );
}

/** The round-1 lamp's signature, drawn with the shared StreetLamp (light 0–1 → its place in the stagger). */
export function Lamp({ x, base, h = 70, light = 0 }: { x: number; base: number; h?: number; light?: number }) {
  return <StreetLamp x={x} base={base} h={h} i={Math.round(light * 10)} />;
}

/**
 * The indoor lamp: a brass table lamp with a linen shade. Off by day; at night it comes on like the street
 * lamps (same stagger and flicker classes): a warm bulb under the shade, light through the linen, a pool on
 * the table. Drawn at (x, base) = the centre of its foot, `h` tall.
 */
export function TableLamp({ x, base, h = 120, i = 0 }: { x: number; base: number; h?: number; i?: number }) {
  const id = `tl${useId().replace(/:/g, '')}`;
  const k = h / 120;
  const shadeTop = base - h;
  const shadeBottom = base - h + 46 * k;
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-pool`}>
          <stop offset="0" stopColor={P.honeyLight} stopOpacity="0.7" />
          <stop offset="1" stopColor={P.honey} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-halo`}>
          <stop offset="0" stopColor={P.glow} stopOpacity="0.8" />
          <stop offset="0.4" stopColor={P.honeyLight} stopOpacity="0.35" />
          <stop offset="1" stopColor={P.honey} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="sc-lamp sc-lamp-flicker" style={{ ['--i' as string]: i }}>
        <circle cx={x} cy={shadeBottom - 8 * k} r={110 * k} fill={`url(#${id}-halo)`} />
        <ellipse cx={x} cy={base} rx={90 * k} ry={14 * k} fill={`url(#${id}-pool)`} />
      </g>
      <ellipse cx={x + 8 * k} cy={base} rx={26 * k} ry={4 * k} fill={P.ink} opacity={0.14} />
      {/* foot and stem (brass, lit left) */}
      <path d={`M${x - 20 * k} ${base}q0 -8 ${20 * k} ${-9 * k}q${20 * k} ${1 * k} ${20 * k} ${9 * k}Z`} fill={P.brassDark} />
      <path d={`M${x - 20 * k} ${base}q0 -8 ${20 * k} ${-9 * k}v${9 * k}Z`} fill={P.brass} />
      <rect x={x - 2.4 * k} y={shadeBottom} width={4.8 * k} height={base - shadeBottom - 8 * k} fill={P.brassDark} />
      <rect x={x - 2.4 * k} y={shadeBottom} width={2 * k} height={base - shadeBottom - 8 * k} fill={P.honey} />
      {/* the shade: linen, lit left, warm from inside at night */}
      <path d={`M${x - 24 * k} ${shadeTop}h${48 * k}l${12 * k} ${46 * k}h${-72 * k}Z`} fill={mix(P.paper, P.wallShade, 0.3)} />
      <path d={`M${x - 24 * k} ${shadeTop}h${20 * k}l${-6 * k} ${46 * k}h${-26 * k}Z`} fill={P.paper} />
      <g className="sc-lamp" style={{ ['--i' as string]: i }}>
        <path d={`M${x - 24 * k} ${shadeTop}h${48 * k}l${12 * k} ${46 * k}h${-72 * k}Z`} fill={P.honeyLight} opacity={0.85} />
        <ellipse cx={x} cy={shadeBottom} rx={36 * k} ry={4 * k} fill={P.glow} />
      </g>
    </g>
  );
}

/** A round street tree (sycamore/oak): trunk, crown of lit spheres, long shadow falling right. */
export function RoundTree({ x, base, r, haze = 0, hazeTo, shadow = true }: { x: number; base: number; r: number; haze?: number; hazeTo?: string; shadow?: boolean }) {
  const f = (c: string) => toward(c, haze, hazeTo);
  return (
    <g>
      {shadow && <ellipse cx={x + r * 1.1} cy={base + 1} rx={r * 1.5} ry={r * 0.16} fill={P.ink} opacity={0.08} />}
      <rect x={x - r * 0.08} y={base - r * 1.3} width={r * 0.16} height={r * 1.3} fill={f(P.bark)} />
      <circle cx={x} cy={base - r * 1.6} r={r} fill={f(P.tree)} />
      <circle cx={x - r * 0.28} cy={base - r * 1.82} r={r * 0.66} fill={f(P.treeLight)} />
      <circle cx={x - r * 0.44} cy={base - r * 2.02} r={r * 0.26} fill={f(P.pineLighter)} opacity={0.65} />
      <circle cx={x + r * 0.42} cy={base - r * 1.3} r={r * 0.5} fill={f(P.treeDark)} opacity={0.55} />
    </g>
  );
}

/** A jacaranda in bloom: a broad crown of lavender puffs on a forked trunk. */
export function Jacaranda({ x, base, r, haze = 0, hazeTo, shadow = true }: { x: number; base: number; r: number; haze?: number; hazeTo?: string; shadow?: boolean }) {
  const f = (c: string) => toward(c, haze, hazeTo);
  return (
    <g>
      {shadow && <ellipse cx={x + r * 1.2} cy={base + 1} rx={r * 1.6} ry={r * 0.15} fill={P.ink} opacity={0.08} />}
      <path d={`M${x - 2} ${base}L${x - 1} ${base - r * 1.1}L${x - r * 0.4} ${base - r * 1.5}h2L${x + 0.5} ${base - r * 1.25}L${x + r * 0.35} ${base - r * 1.55}h2L${x + 1.5} ${base - r * 1.05}L${x + 2.5} ${base}Z`} fill={f(P.bark)} />
      <ellipse cx={x} cy={base - r * 1.7} rx={r * 1.15} ry={r * 0.8} fill={f(P.jacarandaDark)} />
      <circle cx={x - r * 0.45} cy={base - r * 1.85} r={r * 0.62} fill={f(P.jacaranda)} />
      <circle cx={x + r * 0.4} cy={base - r * 1.82} r={r * 0.56} fill={f(P.jacaranda)} />
      <circle cx={x - r * 0.05} cy={base - r * 2.1} r={r * 0.5} fill={f(P.jacaranda)} />
      <circle cx={x - r * 0.55} cy={base - r * 2.12} r={r * 0.26} fill={f(P.jacarandaLight)} />
      <circle cx={x - r * 0.12} cy={base - r * 2.38} r={r * 0.18} fill={f(P.jacarandaLight)} />
    </g>
  );
}

/** A low shrub: three lit spheres and a soft contact shadow. */
export function Shrub({ x, base, r, haze = 0, hazeTo }: { x: number; base: number; r: number; haze?: number; hazeTo?: string }) {
  const f = (c: string) => toward(c, haze, hazeTo);
  return (
    <g>
      <ellipse cx={x + r * 0.6} cy={base} rx={r * 1.5} ry={r * 0.22} fill={P.ink} opacity={0.1} />
      <circle cx={x + r * 0.55} cy={base - r * 0.62} r={r * 0.74} fill={f(P.tree)} />
      <circle cx={x - r * 0.15} cy={base - r * 0.7} r={r * 0.84} fill={f(P.treeLight)} />
      <circle cx={x - r * 0.38} cy={base - r * 1.04} r={r * 0.3} fill={f(P.pineLighter)} opacity={0.6} />
    </g>
  );
}

/** A tall Italian cypress (a dark column), for hillsides. */
export function Cypress({ x, base, h, haze = 0, hazeTo }: { x: number; base: number; h: number; haze?: number; hazeTo?: string }) {
  const f = (c: string) => toward(c, haze, hazeTo);
  const w = h * 0.17;
  return (
    <g>
      <ellipse cx={x + h * 0.4} cy={base + 0.5} rx={h * 0.5} ry={h * 0.035} fill={P.ink} opacity={0.08} />
      <path d={`M${x} ${base - h}C${x + w * 0.9} ${base - h * 0.7} ${x + w} ${base - h * 0.25} ${x + w * 0.5} ${base}H${x - w * 0.5}C${x - w} ${base - h * 0.25} ${x - w * 0.9} ${base - h * 0.7} ${x} ${base - h}Z`} fill={f(P.treeDark)} />
      <path d={`M${x} ${base - h}C${x - w * 0.9} ${base - h * 0.7} ${x - w} ${base - h * 0.25} ${x - w * 0.5} ${base}H${x - w * 0.05}C${x - w * 0.3} ${base - h * 0.4} ${x - w * 0.2} ${base - h * 0.75} ${x} ${base - h}Z`} fill={f(P.tree)} />
    </g>
  );
}
