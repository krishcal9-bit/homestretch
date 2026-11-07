'use client';
import { P, mix } from '@/lib/illustrationPalette';

/**
 * Scenery parts: small shaded SVG pieces for the neighborhood (houses, palms, jacarandas, street furniture).
 * Same light as everything else: top-left; front faces lit, right faces and undersides in shade. Each part
 * draws inside a parent <svg>, anchored at (x, base) = bottom-centre (or bottom-left for houses).
 * `fade` (0–1) pushes a part toward the sky colour for distance (aerial perspective) and desaturates it.
 */
const toward = (c: string, fade: number, sky: string = P.skyBottom) => (fade ? mix(c, sky, fade) : c);

export type HouseStyle = { roof: 'gable' | 'hip'; solar?: boolean; wall?: string; trim?: string };
export function MiniHouse({ x, base, w, h, style, lit = false, porch = false, fade = 0, chimney = false }: { x: number; base: number; w: number; h: number; style: HouseStyle; lit?: boolean; porch?: boolean; fade?: number; chimney?: boolean }) {
  const f = (c: string) => toward(c, fade);
  const side = w * 0.32; // receding side face
  const dy = side * 0.45;
  const roofH = style.roof === 'gable' ? h * 0.62 : h * 0.42;
  const wall = style.wall ?? P.wall;
  const top = base - h;
  const winW = w * 0.2;
  const winH = h * 0.32;
  return (
    <g>
      {/* side face (shade) */}
      <path d={`M${x + w} ${base}L${x + w + side} ${base - dy}V${top - dy}L${x + w} ${top}Z`} fill={f(mix(wall, P.wallDeep, 0.75))} />
      {/* front face (lit) */}
      <rect x={x} y={top} width={w} height={h} fill={f(wall)} />
      {/* roof */}
      {style.roof === 'gable' ? (
        <>
          <path d={`M${x - 2} ${top + 1}L${x + w / 2} ${top - roofH}L${x + w + 2} ${top + 1}Z`} fill={f(mix(wall, P.trim, 0.4))} />
          <path d={`M${x + w / 2} ${top - roofH}L${x + w / 2 + side} ${top - roofH - dy}L${x + w + side + 3} ${top - dy + 2}L${x + w + 3} ${top + 2}Z`} fill={f(P.slateLight)} />
          <path d={`M${x - 3} ${top + 2}L${x + w / 2} ${top - roofH - 1}L${x + w + 3} ${top + 2}`} fill="none" stroke={f(P.trim)} strokeWidth={1.6} strokeLinejoin="round" />
          {style.solar && (
            <g>
              <path d={`M${x + w / 2 + side * 0.15 + 3} ${top - roofH * 0.82 - dy * 0.15}L${x + w / 2 + side * 0.85} ${top - roofH * 0.82 - dy * 0.85}L${x + w + side * 0.85 - 3} ${top - dy * 0.85 - 4}L${x + w + side * 0.15} ${top - dy * 0.15 - 4}Z`} fill={f(P.solar)} />
              <path d={`M${x + w / 2 + side * 0.5} ${top - roofH * 0.82 - dy * 0.5}L${x + w + side * 0.5} ${top - dy * 0.5 - 4}`} stroke={f(P.glassLight)} strokeWidth={0.6} opacity={0.6} />
            </g>
          )}
        </>
      ) : (
        <>
          <path d={`M${x - 3} ${top + 1}L${x + w * 0.22} ${top - roofH}H${x + w * 0.78 + side}L${x + w + side + 3} ${top - dy + 1}L${x + w + 3} ${top + 1}Z`} fill={f(P.slate)} />
          <path d={`M${x - 3} ${top + 1}L${x + w * 0.22} ${top - roofH}H${x + w * 0.78}L${x + w + 3} ${top + 1}Z`} fill={f(P.slateLight)} />
          {style.solar && <path d={`M${x + w * 0.24} ${top - roofH * 0.82}H${x + w * 0.74}L${x + w * 0.84} ${top - roofH * 0.25}H${x + w * 0.14}Z`} fill={f(P.solar)} />}
        </>
      )}
      {chimney && <rect x={x + w * 0.7} y={top - roofH * 0.95} width={w * 0.09} height={roofH * 0.55} fill={f(P.stoneShade)} />}
      {/* windows + door */}
      <rect x={x + w * 0.12} y={top + h * 0.28} width={winW} height={winH} fill={lit ? P.honey : f(P.glass)} />
      <rect x={x + w * 0.12 - 1} y={top + h * 0.28 + winH} width={winW + 2} height={1.4} fill={f(P.trim)} />
      <rect x={x + w * 0.58} y={top + h * 0.4} width={w * 0.18} height={h * 0.6} fill={f(P.slateLight)} />
      {porch && <circle cx={x + w * 0.53} cy={top + h * 0.45} r={2.6} fill={P.honey} />}
    </g>
  );
}

export function Palm({ x, base, h, fade = 0, lean = 4 }: { x: number; base: number; h: number; fade?: number; lean?: number }) {
  const f = (c: string) => toward(c, fade);
  const tx = x + lean;
  const ty = base - h;
  const frond = (a: number, len: number, c: string) => {
    const r = (a * Math.PI) / 180;
    const ex = tx + Math.cos(r) * len;
    const ey = ty + Math.sin(r) * len * 0.75 + len * 0.18;
    const mx = tx + Math.cos(r) * len * 0.55;
    const my = ty + Math.sin(r) * len * 0.55 - len * 0.14;
    return <path key={a} d={`M${tx} ${ty}Q${mx} ${my} ${ex} ${ey}Q${mx} ${my + 4} ${tx} ${ty + 2}Z`} fill={f(c)} />;
  };
  return (
    <g>
      <path d={`M${x - 2.2} ${base}Q${x + lean * 0.3} ${base - h * 0.5} ${tx - 1.6} ${ty}H${tx + 1.6}Q${x + lean * 0.3 + 3} ${base - h * 0.5} ${x + 2.2} ${base}Z`} fill={f(P.bark)} />
      {[200, 230, 160, 330, 300, 20].map((a, i) => frond(a, h * 0.32, i % 2 ? P.tree : P.treeLight))}
    </g>
  );
}

export function Jacaranda({ x, base, r, fade = 0 }: { x: number; base: number; r: number; fade?: number }) {
  const f = (c: string) => toward(c, fade);
  return (
    <g>
      <path d={`M${x - 2} ${base}L${x - 1} ${base - r * 1.2}H${x + 1}L${x + 2} ${base}Z`} fill={f(P.bark)} />
      <circle cx={x} cy={base - r * 1.55} r={r} fill={f(P.jacarandaDark)} />
      <circle cx={x - r * 0.35} cy={base - r * 1.75} r={r * 0.72} fill={f(P.jacaranda)} />
      <circle cx={x + r * 0.42} cy={base - r * 1.65} r={r * 0.6} fill={f(P.jacaranda)} />
      <circle cx={x - r * 0.45} cy={base - r * 1.95} r={r * 0.32} fill={f(P.jacarandaLight)} />
    </g>
  );
}

export function RoundTree({ x, base, r, fade = 0 }: { x: number; base: number; r: number; fade?: number }) {
  const f = (c: string) => toward(c, fade);
  return (
    <g>
      <rect x={x - 1.6} y={base - r * 1.2} width={3.2} height={r * 1.2} fill={f(P.bark)} />
      <circle cx={x} cy={base - r * 1.6} r={r} fill={f(P.tree)} />
      <circle cx={x - r * 0.3} cy={base - r * 1.85} r={r * 0.62} fill={f(P.treeLight)} />
      <circle cx={x - r * 0.42} cy={base - r * 2.0} r={r * 0.25} fill={f(P.pineLighter)} opacity={0.6} />
    </g>
  );
}

export function Bush({ x, base, r, fade = 0 }: { x: number; base: number; r: number; fade?: number }) {
  const f = (c: string) => toward(c, fade);
  return (
    <g>
      <ellipse cx={x + r * 0.5} cy={base} rx={r * 1.4} ry={r * 0.22} fill={P.shadowSoft} />
      <circle cx={x + r * 0.55} cy={base - r * 0.65} r={r * 0.75} fill={f(P.tree)} />
      <circle cx={x - r * 0.15} cy={base - r * 0.7} r={r * 0.85} fill={f(P.treeLight)} />
      <circle cx={x - r * 0.35} cy={base - r * 1.05} r={r * 0.3} fill={f(P.pineLighter)} opacity={0.55} />
    </g>
  );
}

export function PicketFence({ x, base, w, h = 16 }: { x: number; base: number; w: number; h?: number }) {
  const n = Math.floor(w / 7);
  return (
    <g>
      <rect x={x} y={base - h * 0.7} width={w} height={2} fill={P.trimShade} />
      <rect x={x} y={base - h * 0.3} width={w} height={2} fill={P.trimShade} />
      {Array.from({ length: n }, (_, i) => (
        <path key={i} d={`M${x + i * 7} ${base}V${base - h + 2}L${x + i * 7 + 2} ${base - h}L${x + i * 7 + 4} ${base - h + 2}V${base}Z`} fill={i % 2 ? P.trim : P.trimShade} />
      ))}
    </g>
  );
}

export function Mailbox({ x, base }: { x: number; base: number }) {
  return (
    <g>
      <rect x={x - 1.3} y={base - 24} width={2.6} height={24} fill={P.bark} />
      <path d={`M${x - 7} ${base - 23}V${base - 30}a7 7 0 0 1 14 0V${base - 23}Z`} fill={P.slate} />
      <path d={`M${x + 2} ${base - 23}V${base - 30}a7 7 0 0 0 -2 -5`} fill="none" stroke={P.slateLight} strokeWidth={1} />
      <rect x={x + 6} y={base - 36} width={1.4} height={8} fill={P.honey} />
    </g>
  );
}

export function StreetLamp({ x, base, h = 70, glow = 0 }: { x: number; base: number; h?: number; glow?: number }) {
  return (
    <g>
      <circle cx={x + 8} cy={base - h + 4} r={16} fill={P.honey} opacity={0.35 * glow} style={{ filter: 'blur(6px)' }} />
      <rect x={x - 1.6} y={base - h} width={3.2} height={h} fill={P.slateDark} />
      <path d={`M${x} ${base - h}q0 -6 9 -6`} fill="none" stroke={P.slateDark} strokeWidth={2.4} />
      <path d={`M${x + 4} ${base - h - 4}h10l-2 5h-6Z`} fill={P.slate} />
      <rect x={x + 6} y={base - h + 1} width={6} height={2} fill={glow > 0.2 ? P.glow : P.stone} />
    </g>
  );
}
