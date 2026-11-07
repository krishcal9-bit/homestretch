'use client';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CX, R1, R2, STONE_POLYS, KEYHOLE_UP, ARCH_GEO } from '@/components/brand/arch';
import { PN, PX } from '@/lib/illustrationPalette';
import { FILM } from '@/components/introTimeline';
import type { HouseHandle } from './houseModel';

/**
 * The intro film's world, on the hero house's own canvas (StageScene): the stone arch that assembles in front of
 * the house, the blueprint grid it is drawn on, the dust, the beam that brings the keystone, and the street the
 * camera arrives on (ground, road, lamps). Everything is driven by one clock (FILM, seconds from the first
 * frame) in useFrame: no React state per frame. Cheap on purpose: the ten stones are ONE merged mesh whose
 * per-stone transforms are a uniform array (one draw call + one shadow pass), the dust and lamp halos are one
 * Points each, and every material is on screen from the first frame so nothing compiles mid-film.
 */

/* ---------------- scale and placement ---------------- */
/** metres per arch unit: the clear span (2·R1 = 50 units) is 4.2 m */
export const S = 4.2 / (2 * R1);
/** the arch stands across the street from the house, facing it (+z is toward the first camera) */
export const ZA = 20;
const DEPTH = 1.05;
const BEV = 0.065;
const ARCH_TOP = (26 + R2 + 5) * S;
/** where the camera arrives, standing in the street looking at the house */
export const T4 = new THREE.Vector3(0.3, 1.95, 0.7);
const AC = new THREE.Vector3(0, 2.75, ZA);

/** additive glow that adds colour without writing alpha (the canvas is transparent over the CSS sky) */
function glowBlend<M extends THREE.Material>(m: M): M {
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneFactor;
  m.blendSrcAlpha = THREE.ZeroFactor;
  m.blendDstAlpha = THREE.OneFactor;
  return m;
}
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const prog = (t: number, at: number, dur: number) => clamp01((t - at) / dur);
const easeOut = (p: number) => 1 - Math.pow(1 - clamp01(p), 3);
const easeOutQuart = (p: number) => 1 - Math.pow(1 - clamp01(p), 4);
const inOut = (p: number) => {
  const x = clamp01(p);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** deterministic noise per index (the film looks the same on every load) */
const rnd = (i: number, k = 0) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* ---------------- the sky (mirrors the CSS layers in components/Intro.tsx + app/globals.css .ks-twilight) ---------------- */
const SKY = {
  day: [new THREE.Color(PX.skyTop), new THREE.Color(PX.skyBottom)],
  night: [new THREE.Color(PN.skyTop), new THREE.Color(PN.skyBottom)],
  dusk: [new THREE.Color('#0b1622'), new THREE.Color('#13263a'), new THREE.Color('#24384a')],
};
/** the sky's colour at a height on screen (0 top … 1 bottom), `lift` 0 = twilight … 1 = the page's sky */
function skyAt(y: number, night: boolean, lift: number, out: THREE.Color, tmp: THREE.Color) {
  const [a, b] = night ? SKY.night : SKY.day;
  out.copy(a).lerp(b, clamp01(y / 0.72));
  const [d0, d1, d2] = SKY.dusk;
  if (y < 0.52) tmp.copy(d0).lerp(d1, y / 0.52);
  else tmp.copy(d1).lerp(d2, (y - 0.52) / 0.48);
  return out.lerp(tmp, 1 - lift);
}

/* ---------------- the camera ---------------- */
export const filmFov = (aspect: number) => (aspect < 1 ? 46 : 36);
function fit(aspect: number, fov: number, w: number, h: number) {
  const t = Math.tan(((fov / 2) * Math.PI) / 180);
  return Math.max(h / (2 * t), w / (2 * t * aspect));
}
function orbitPos(az: number, el: number, dist: number, target: THREE.Vector3, out: THREE.Vector3) {
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  return out.set(target.x + dist * Math.cos(e) * Math.sin(a), target.y + dist * Math.sin(e), target.z + dist * Math.cos(e) * Math.cos(a));
}
/** the assembly orbit (beats 1–3): high over the blueprint, then down and round 25° while the stones land */
function orbitAt(t: number, aspect: number, fov: number, pos: THREE.Vector3, target: THREE.Vector3) {
  const dA = fit(aspect, fov, 7.4 / 0.62, ARCH_TOP / 0.5);
  const a = inOut(t / 2.0);
  const b = prog(t, 2.0, 0.7);
  const az = lerp(-14, 9, a) + 2.5 * b;
  const el = lerp(33, 13, a) - 1.5 * b;
  const dist = dA * (lerp(1.2, 1.0, a) - 0.06 * easeOut(b));
  target.set(0, lerp(1.3, 2.75, inOut(t / 1.7)) + 0.3 * b, ZA);
  orbitPos(az, el, dist, target, pos);
}
/** where the push through the arch ends (eye level in the street, the house filling the frame) */
export function arrival(aspect: number, out: THREE.Vector3) {
  const fov = filmFov(aspect);
  const d = Math.min(ZA - 2.6 - T4.z, fit(aspect, fov, 14, 9.2));
  return out.set(T4.x + 0.15, T4.y + 0.12, T4.z + d);
}
export type FilmCam = { pos: THREE.Vector3; target: THREE.Vector3; fov: number; passed: boolean };
/** The film camera for beats 1–4 (t ≤ FILM.flyEnd; later it holds the arrival). */
export function filmCamera(t: number, aspect: number, curve: { c: THREE.CatmullRomCurve3 | null; aspect: number }, out: FilmCam) {
  const fov = filmFov(aspect);
  out.fov = fov;
  if (t < FILM.fly) {
    orbitAt(t, aspect, fov, out.pos, out.target);
    out.passed = false;
    return out;
  }
  // the path through the arch: from the orbit's last pose, low through the opening, on to the arrival
  if (!curve.c || curve.aspect !== aspect) {
    const p0 = new THREE.Vector3();
    orbitAt(FILM.fly, aspect, fov, p0, new THREE.Vector3());
    const p3 = arrival(aspect, new THREE.Vector3());
    curve.c = new THREE.CatmullRomCurve3([p0, new THREE.Vector3(0.05, 2.25, ZA + DEPTH / 2 + 5.5), new THREE.Vector3(0.1, 2.15, ZA - 2.2), p3], false, 'centripetal');
    curve.aspect = aspect;
  }
  const u = inOut(prog(t, FILM.fly, FILM.flyEnd - FILM.fly));
  curve.c.getPointAt(u, out.pos);
  const look = inOut(prog(t, FILM.fly, 0.55));
  out.target.copy(AC).lerp(T4, look);
  out.passed = out.pos.z < ZA - DEPTH;
  return out;
}

/* ---------------- shaders ---------------- */
const NOISE = /* glsl */ `
float ksHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ksNoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ksHash(i), ksHash(i + vec3(1,0,0)), f.x), mix(ksHash(i + vec3(0,1,0)), ksHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(ksHash(i + vec3(0,0,1)), ksHash(i + vec3(1,0,1)), f.x), mix(ksHash(i + vec3(0,1,1)), ksHash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float ksGrain(vec3 p){ return 0.62 * ksNoise(p) + 0.38 * ksNoise(p * 3.7); }
`;
const NSTONES = 10;

/** The ten pine stones: one merged geometry, per-stone transforms from a uniform array, a little grain. */
function useStones() {
  return useMemo(() => {
    const polys = STONE_POLYS.filter((p) => !p.key);
    const centres: THREE.Vector3[] = [];
    const geos = polys.map((p, i) => {
      const cx = (p.centroid[0] - CX) * S;
      const cy = p.centroid[1] * S;
      centres.push(new THREE.Vector3(cx, cy, 0));
      const shape = new THREE.Shape(p.pts.map(([x, y]) => new THREE.Vector2((x - CX) * S - cx, y * S - cy)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: DEPTH - 2 * BEV, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelOffset: -BEV, bevelSegments: 2, curveSegments: 1 });
      g.translate(0, 0, -(DEPTH - 2 * BEV) / 2);
      g.deleteAttribute('uv');
      const n = g.getAttribute('position').count;
      g.setAttribute('aStone', new THREE.BufferAttribute(new Float32Array(n).fill(i), 1));
      return g;
    });
    const geo = mergeGeometries(geos, false)!;
    geos.forEach((g) => g.dispose());
    const mats = Array.from({ length: NSTONES }, () => new THREE.Matrix4().makeScale(0, 0, 0));
    // light from the top-left: the left stones a touch lighter, every stone a little different
    const tints = polys.map((p, i) => {
      const k = 0.93 + (p.tone - 0.5) * 0.16 + (rnd(i, 3) - 0.5) * 0.06;
      return new THREE.Vector3(k * (1 + (rnd(i, 4) - 0.5) * 0.03), k, k * (1 - (rnd(i, 5) - 0.5) * 0.03));
    });
    const uniforms = { uStone: { value: mats }, uTint: { value: tints } };
    const mat = new THREE.MeshStandardMaterial({ color: '#4B7F6A', roughness: 0.88, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\nattribute float aStone;\nuniform mat4 uStone[${NSTONES}];\nuniform vec3 uTint[${NSTONES}];\nvarying vec3 vTint;\nvarying vec3 vGrain;`)
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\nint ksI = int(aStone + 0.5);\nmat4 ksM = uStone[ksI];\nobjectNormal = mat3(ksM) * objectNormal;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed = (ksM * vec4(transformed, 1.0)).xyz;\nvTint = uTint[ksI];\nvGrain = position * 2.4 + aStone * 7.31;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nvarying vec3 vTint;\nvarying vec3 vGrain;\n${NOISE}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\ndiffuseColor.rgb *= vTint * (0.95 + 0.08 * ksGrain(vGrain));`);
    };
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    depth.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>\nattribute float aStone;\nuniform mat4 uStone[${NSTONES}];`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed = (uStone[int(aStone + 0.5)] * vec4(transformed, 1.0)).xyz;`);
    };
    return { geo, mat, depth, mats, centres, polys };
  }, []);
}

/** The brass keystone, with its keyhole cut through. */
function useKeystone() {
  return useMemo(() => {
    const p = STONE_POLYS.find((s) => s.key)!;
    const cx = (p.centroid[0] - CX) * S;
    const cy = p.centroid[1] * S;
    const v = (x: number, y: number) => new THREE.Vector2((x - CX) * S - cx, y * S - cy);
    const shape = new THREE.Shape(p.pts.map(([x, y]) => v(x, y)));
    const k = KEYHOLE_UP;
    const c = v(k.cx, k.cy);
    shape.holes.push(new THREE.Path().absarc(c.x, c.y, k.r * S, 0, Math.PI * 2, true));
    const sl = k.slot;
    const slot = new THREE.Path([v(k.cx - sl.halfTop, sl.top), v(k.cx - sl.halfBottom, sl.bottom), v(k.cx + sl.halfBottom, sl.bottom), v(k.cx + sl.halfTop, sl.top)]);
    shape.holes.push(slot);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH + 0.06 - 2 * BEV, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelOffset: -BEV, bevelSegments: 2, curveSegments: 12 });
    geo.translate(0, 0, -(DEPTH + 0.06 - 2 * BEV) / 2);
    const mat = new THREE.MeshStandardMaterial({ color: PX.brass, roughness: 0.46, metalness: 0.25, emissive: new THREE.Color(PX.honey), emissiveIntensity: 0 });
    return { geo, mat, centre: new THREE.Vector3(cx, cy, 0) };
  }, []);
}

/** Thin quads in the joints (front face) that a brass glow runs along once, outward from the keystone. */
function useJoints() {
  return useMemo(() => {
    const { VOUSSOIRS } = ARCH_GEO;
    const span = 180 / VOUSSOIRS;
    const quads: { c: [number, number]; d: [number, number]; len: number; w: number; order: number }[] = [];
    const cy = 26;
    for (let j = 1; j < VOUSSOIRS; j++) {
      const a = ((180 - j * span) * Math.PI) / 180;
      const order = j === 3 || j === 4 ? 0 : j === 2 || j === 5 ? 1 : 2;
      const r = (R1 + R2) / 2;
      quads.push({ c: [CX + r * Math.cos(a), cy + r * Math.sin(a)], d: [Math.cos(a), Math.sin(a)], len: R2 - R1 + 2, w: 3.2, order });
    }
    for (const side of [-1, 1]) {
      const x = CX + side * (R1 + R2) / 2;
      quads.push({ c: [x, 26], d: [1, 0], len: R2 - R1 + 2, w: 3.2, order: 3 });
      quads.push({ c: [x, 13], d: [1, 0], len: R2 - R1 + 2, w: 3.2, order: 4 });
    }
    const pos: number[] = [];
    const uv: number[] = [];
    const ord: number[] = [];
    const idx: number[] = [];
    const z = DEPTH / 2 + 0.006;
    quads.forEach((q, i) => {
      const [dx, dy] = q.d;
      const [nx, ny] = [-dy, dx];
      const corners: [number, number, number, number][] = [
        [-0.5, -0.5, 0, 0],
        [0.5, -0.5, 1, 0],
        [0.5, 0.5, 1, 1],
        [-0.5, 0.5, 0, 1],
      ];
      corners.forEach(([a, b, u, w]) => {
        const x = q.c[0] + dx * a * q.len + nx * b * q.w;
        const y = q.c[1] + dy * a * q.len + ny * b * q.w;
        pos.push((x - CX) * S, y * S, z);
        uv.push(u, w);
        ord.push(q.order);
      });
      const o = i * 4;
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('aOrder', new THREE.Float32BufferAttribute(ord, 1));
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uS: { value: -1 }, uColor: { value: new THREE.Color('#FFD27A') } },
      vertexShader: /* glsl */ `attribute float aOrder; varying vec2 vUv; varying float vO; void main(){ vUv = uv; vO = aOrder; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform float uS; uniform vec3 uColor; varying vec2 vUv; varying float vO;
        void main(){ if (uS < 0.0) discard;
          float wave = exp(-pow((uS * 10.0 - vO) / 1.15, 2.0)) * (1.0 - smoothstep(0.42, 0.8, uS));
          float across = exp(-pow((vUv.y - 0.5) / 0.16, 2.0));
          float along = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
          gl_FragColor = vec4(uColor * wave * across * along * 1.6, 1.0); }`,
    });
    glowBlend(mat);
    return { geo, mat };
  }, []);
}

/** The beam that brings the keystone: a soft additive cone from above. */
function useBeam() {
  return useMemo(() => {
    const h = 8;
    const geo = new THREE.CylinderGeometry(0.5, 1.45, h, 40, 1, true);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { uO: { value: 0 }, uColor: { value: new THREE.Color('#FFD694') } },
      vertexShader: /* glsl */ `varying float vH; varying float vE; void main(){ vH = position.y / ${h.toFixed(1)} + 0.5;
        vec3 n = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vE = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `uniform float uO; uniform vec3 uColor; varying float vH; varying float vE;
        void main(){ float a = pow(1.0 - vH, 2.2) * pow(vE, 3.2) * smoothstep(0.0, 0.08, vH) * uO; gl_FragColor = vec4(uColor * a * 0.32, 1.0); }`,
    });
    glowBlend(mat);
    return { geo, mat, h };
  }, []);
}

/** Soft round points (dust, lamp halos): one draw call each, all motion in the vertex shader. */
function softPointsMaterial(additive: boolean) {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uT: { value: -10 }, uScale: { value: 400 }, uColor: { value: new THREE.Color('#E9E0D2') }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `attribute vec3 aVel; attribute float aBirth; attribute float aLife; attribute float aSize;
      uniform float uT; uniform float uScale; varying float vA;
      void main(){
        float age = uT - aBirth;
        if (aLife > 0.0 && (age < 0.0 || age > aLife)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
        float k = aLife > 0.0 ? age / aLife : 0.0;
        vec3 p = position + aVel * (1.0 - exp(-3.2 * max(age, 0.0))) / 3.2 + vec3(0.0, -0.22 * age * age, 0.0) * step(0.0, aLife);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * (1.0 + 0.7 * k) * uScale / max(0.1, -mv.z);
        vA = aLife > 0.0 ? smoothstep(0.0, 0.07, age) * pow(1.0 - k, 1.4) : 1.0;
      }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uOpacity; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); a *= a; a *= vA * uOpacity;
        ${additive ? 'gl_FragColor = vec4(uColor * a, 1.0);' : 'gl_FragColor = vec4(uColor, a);'} }`,
  });
  return additive ? glowBlend(m) : m;
}

/** Dust: ~10 soft particles per stone landing, a larger slower puff at the lock that drifts down and settles. */
function useDust(stones: { centres: THREE.Vector3[]; polys: typeof STONE_POLYS }, order: number[], landAt: (k: number) => number, keyCentre: THREE.Vector3) {
  return useMemo(() => {
    const pos: number[] = [];
    const vel: number[] = [];
    const birth: number[] = [];
    const life: number[] = [];
    const size: number[] = [];
    let n = 0;
    const puff = (o: THREE.Vector3, out: THREE.Vector2, count: number, at: number, lifeS: number, big = 1) => {
      for (let i = 0; i < count; i++, n++) {
        const a = rnd(n, 1) * Math.PI * 2;
        const front = rnd(n, 2) < 0.7 ? 1 : -1;
        pos.push(o.x + (rnd(n, 3) - 0.5) * 0.5, Math.max(0.04, o.y + (rnd(n, 4) - 0.5) * 0.25), o.z + front * (DEPTH / 2) * (0.6 + 0.4 * rnd(n, 5)));
        const sp = (0.55 + 0.7 * rnd(n, 6)) * big;
        vel.push(Math.cos(a) * sp * 0.8 + out.x * 0.5, Math.abs(Math.sin(a)) * sp * 0.45 + 0.15, front * (0.35 + 0.5 * rnd(n, 7)));
        birth.push(at + rnd(n, 8) * 0.03);
        life.push(lifeS * (0.8 + 0.4 * rnd(n, 9)));
        size.push((0.16 + 0.16 * rnd(n, 10)) * big);
      }
    };
    order.forEach((si, k) => {
      const c = stones.centres[si];
      const p = stones.polys[si];
      // pier stones puff at their feet; voussoirs at the joint they land on
      const o = si < 4 ? new THREE.Vector3(c.x, si < 2 ? 0.05 : c.y - 0.5, 0) : c.clone().multiplyScalar(1);
      const out = new THREE.Vector2(p.side * 0.6, 0);
      puff(o, out, 10, landAt(k), 0.42);
    });
    // the lock: both of the keystone's joints, slower, drifting down
    for (const side of [-1, 1]) puff(new THREE.Vector3(keyCentre.x + side * 0.42, keyCentre.y - 0.15, 0), new THREE.Vector2(side * 0.8, 0), 12, FILM.lock, 0.95, 1.25);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aVel', new THREE.Float32BufferAttribute(vel, 3));
    geo.setAttribute('aBirth', new THREE.Float32BufferAttribute(birth, 1));
    geo.setAttribute('aLife', new THREE.Float32BufferAttribute(life, 1));
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
    const mat = softPointsMaterial(false);
    mat.uniforms.uOpacity.value = 0.8;
    return { geo, mat };
  }, [stones, order, landAt, keyCentre]);
}

/** The arch's elevation in blueprint hairlines (every stone's outline on the front face), drawn bottom-up. */
function useElevation() {
  return useMemo(() => {
    const pos: number[] = [];
    const tt: number[] = [];
    const kk: number[] = [];
    const z = DEPTH / 2 + 0.012;
    for (const p of STONE_POLYS) {
      const n = p.pts.length;
      for (let i = 0; i < n; i++) {
        const [ax, ay] = p.pts[i];
        const [bx, by] = p.pts[(i + 1) % n];
        pos.push((ax - CX) * S, ay * S, z, (bx - CX) * S, by * S, z);
        tt.push((ay * S) / ARCH_TOP, (by * S) / ARCH_TOP);
        kk.push(p.key ? 1 : 0, p.key ? 1 : 0);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aT', new THREE.Float32BufferAttribute(tt, 1));
    geo.setAttribute('aKey', new THREE.Float32BufferAttribute(kk, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uDraw: { value: 0 }, uFade: { value: 1 }, uKey: { value: 1 }, uColor: { value: new THREE.Color('#CFE3DA') } },
      vertexShader: /* glsl */ `attribute float aT; attribute float aKey; varying float vT; varying float vK; void main(){ vT = aT; vK = aKey; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform float uDraw; uniform float uFade; uniform float uKey; uniform vec3 uColor; varying float vT; varying float vK;
        void main(){ if (vT > uDraw) discard; gl_FragColor = vec4(uColor, 0.85 * mix(uFade, uKey, vK)); }`,
    });
    return { geo, mat };
  }, []);
}

/** The blueprint the arch is drawn on: an AA grid + its measurements, revealed by a radial wave. */
function useBlueprint() {
  return useMemo(() => {
    const geo = new THREE.PlaneGeometry(44, 44);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uR: { value: 0 }, uColor: { value: new THREE.Color('#CFE3DA') }, uGrid: { value: 0 }, uMarks: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `uniform float uR; uniform vec3 uColor; uniform float uGrid; uniform float uMarks; varying vec2 vP;
        float gridL(vec2 p, float cell){ vec2 c = p / cell; vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c); return 1.0 - min(min(g.x, g.y), 1.0); }
        float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); float d = length(pa - ba * h);
          float fw = length(fwidth(p)); return 1.0 - smoothstep(0.6, 1.6, d / fw); }
        void main(){
          float r = length(vP);
          float shown = 1.0 - smoothstep(uR - 0.9, uR, r);
          float front = exp(-pow((r - uR) / 0.45, 2.0)) * step(0.05, uR) * (1.0 - smoothstep(14.0, 18.0, uR));
          float fade = 1.0 - smoothstep(7.0, 15.0, r);
          float g = gridL(vP, 0.5) * 0.28 + gridL(vP, 2.5) * 0.5;
          float zD = ${(DEPTH / 2 + 1.55).toFixed(3)};
          float m = 0.0;
          // the span: dimension line, ticks, extension lines
          m = max(m, seg(vP, vec2(-2.1, zD), vec2(2.1, zD)));
          m = max(m, seg(vP, vec2(-2.1, zD - 0.22), vec2(-2.1, zD + 0.22)));
          m = max(m, seg(vP, vec2(2.1, zD - 0.22), vec2(2.1, zD + 0.22)));
          m = max(m, seg(vP, vec2(-2.1, ${(DEPTH / 2 + 0.15).toFixed(3)}), vec2(-2.1, zD + 0.3)) * 0.7);
          m = max(m, seg(vP, vec2(2.1, ${(DEPTH / 2 + 0.15).toFixed(3)}), vec2(2.1, zD + 0.3)) * 0.7);
          // the pier footprints
          for (int i = 0; i < 2; i++) { float s = i == 0 ? -1.0 : 1.0; float x0 = s * 2.1; float x1 = s * 3.7; float z0 = ${(-DEPTH / 2).toFixed(3)}; float z1 = ${(DEPTH / 2).toFixed(3)};
            m = max(m, seg(vP, vec2(x0, z0), vec2(x1, z0))); m = max(m, seg(vP, vec2(x0, z1), vec2(x1, z1)));
            m = max(m, seg(vP, vec2(x0, z0), vec2(x0, z1))); m = max(m, seg(vP, vec2(x1, z0), vec2(x1, z1))); }
          // the centre line, dashed
          m = max(m, seg(vP, vec2(0.0, -6.5), vec2(0.0, 6.5)) * step(0.45, fract(vP.y * 1.4)) * 0.75);
          float a = (g * uGrid * fade + m * uMarks) * shown + front * 0.35 * uGrid * fade;
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    return { geo, mat };
  }, []);
}

function radialAlpha(inner: number, outer: number) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(128, 128, inner * 128, 128, 128, outer * 128);
  g.addColorStop(0, '#fff');
  g.addColorStop(1, '#000');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
/** The street in front of the house: asphalt with a dashed centre line, kerbs, fading out at both ends. */
function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const x = c.getContext('2d')!;
  x.fillStyle = '#DCD9CF';
  x.fillRect(0, 20, 1024, 216);
  x.fillStyle = '#8E9692';
  x.fillRect(0, 44, 1024, 168);
  x.fillStyle = '#F4EFE2';
  for (let i = 10; i < 1024; i += 64) x.fillRect(i, 126, 30, 4);
  // fade at the ends
  x.globalCompositeOperation = 'destination-in';
  const g = x.createLinearGradient(0, 0, 1024, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.22, 'rgba(0,0,0,1)');
  g.addColorStop(0.78, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 1024, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const LAMPS: [number, number][] = [
  [-5.3, 5.35],
  [5.5, 5.35],
  [-14.5, 5.35],
  [14.5, 5.35],
];

/** Live DOM labels pinned to points in the scene (the blueprint's annotations; text stays text). */
function useLabels(texts: { span: string; key: string }) {
  const gl = useThree((s) => s.gl);
  const els = useRef<HTMLDivElement[]>([]);
  useEffect(() => {
    const root = gl.domElement.parentElement?.parentElement;
    if (!root) return;
    const mk = (s: string) => {
      const d = document.createElement('div');
      d.textContent = s;
      d.style.cssText =
        'position:absolute;left:0;top:0;font-size:13px;line-height:16px;font-weight:500;white-space:nowrap;font-variant-numeric:tabular-nums;pointer-events:none;opacity:0;will-change:transform,opacity';
      root.appendChild(d);
      return d;
    };
    // only the keystone label: the span is shown as a dimension line, never as text
    els.current = [mk(texts.key)];
    return () => els.current.forEach((d) => d.remove());
  }, [gl, texts.key]);
  return els;
}

export type FilmProps = {
  /** shared with the camera rig: the film's start (wall clock, seconds) */
  start: { t: number | null };
  mode: MutableRefObject<'intro' | 'slot'>;
  ctl: HouseHandle;
  labels: { span: string; key: string };
  /** the arch has left the frame: its projected rect (viewport px), for the 2D arch that shrinks into the logo */
  onArchOut?: (r: { left: number; top: number; width: number; height: number }) => void;
};

export function IntroWorld({ start, mode, ctl, labels, onArchOut }: FilmProps) {
  const scene = useThree((s) => s.scene);
  const stones = useStones();
  const key = useKeystone();
  const joints = useJoints();
  const beam = useBeam();
  const bp = useBlueprint();
  const elev = useElevation();
  const labelEls = useLabels(labels);
  // landing order: piers bottom-up, then the voussoirs alternating left / right toward the crown
  const order = useMemo(() => [0, 1, 2, 3, 4, 9, 5, 8, 6, 7], []);
  const landAt = useMemo(() => (k: number) => FILM.stones + k * FILM.stoneGap + FILM.stoneDur, []);
  const dust = useDust(stones, order, landAt, key.centre);
  const mats = useMemo(() => {
    const ground = new THREE.MeshLambertMaterial({ color: '#ECEDE7', transparent: true, alphaMap: radialAlpha(0.18, 0.5), depthWrite: false });
    const road = new THREE.MeshLambertMaterial({ map: roadTexture(), transparent: true, depthWrite: false });
    const catcher = new THREE.ShadowMaterial({ color: '#1C2A24', opacity: 0.24, depthWrite: false });
    const pole = new THREE.MeshStandardMaterial({ color: PX.slateDark, roughness: 0.6, transparent: true });
    const glass = new THREE.MeshBasicMaterial({ color: '#FFE2A6', transparent: true });
    const halo = softPointsMaterial(true);
    halo.uniforms.uColor.value.set('#FFC86E');
    halo.uniforms.uT.value = 0;
    return { ground, road, catcher, pole, glass, halo };
  }, []);
  const lampGeo = useMemo(() => {
    const pole = new THREE.CylinderGeometry(0.055, 0.075, 3.3, 10);
    pole.translate(0, 1.65, 0);
    const arm = new THREE.BoxGeometry(0.42, 0.05, 0.05);
    arm.translate(0.16, 3.22, 0);
    const head = new THREE.CylinderGeometry(0.12, 0.2, 0.18, 12);
    head.translate(0.34, 3.14, 0);
    const poleAll = mergeGeometries(LAMPS.map(([x, z]) => mergeGeometries([pole, arm, head].map((g) => g.clone().translate(x, 0, z)))!))!;
    const glass = new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12);
    const glassAll = mergeGeometries(LAMPS.map(([x, z]) => glass.clone().translate(x + 0.34, 3.03, z)))!;
    const halo = new THREE.BufferGeometry();
    halo.setAttribute('position', new THREE.Float32BufferAttribute(LAMPS.flatMap(([x, z]) => [x + 0.34, 2.98, z]), 3));
    halo.setAttribute('aVel', new THREE.Float32BufferAttribute(LAMPS.flatMap(() => [0, 0, 0]), 3));
    halo.setAttribute('aBirth', new THREE.Float32BufferAttribute(LAMPS.map(() => 0), 1));
    halo.setAttribute('aLife', new THREE.Float32BufferAttribute(LAMPS.map(() => 0), 1));
    halo.setAttribute('aSize', new THREE.Float32BufferAttribute(LAMPS.map(() => 1.5), 1));
    return { poleAll, glassAll, halo };
  }, []);

  const arch = useRef<THREE.Group>(null);
  const keyMesh = useRef<THREE.Mesh>(null);
  const beamMesh = useRef<THREE.Mesh>(null);
  const keyLight = useRef<THREE.PointLight>(null);
  const world = useRef<THREE.Group>(null);
  const street = useRef<THREE.Group>(null);
  const out = useRef(false);
  const passed = useRef(false);
  const frames = useRef(0);
  const settle = useRef<number | null>(null);
  const fog = useMemo(() => new THREE.Fog('#132436', 1000, 2000), []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Color(), d: new THREE.Color() }), []);
  const film = useMemo(() => ({ focus: new THREE.Vector3(0, 0, ZA), dusk: 1 }), []);
  const flights = useMemo(
    () =>
      order.map((si, k) => {
        const p = stones.polys[si];
        const side = p.side || 1;
        const end = stones.centres[si].clone();
        const from = new THREE.Vector3(side * (11 + 2 * rnd(k, 11)), end.y + 2.6 + 2.2 * rnd(k, 12), 2.4 + 2.2 * rnd(k, 13));
        const ctrl = new THREE.Vector3(lerp(from.x, end.x, 0.55), Math.max(from.y, end.y) + 2.2 + rnd(k, 14), lerp(from.z, end.z, 0.4));
        const rot = new THREE.Euler((rnd(k, 15) - 0.5) * 1.4, side * (0.9 + 0.6 * rnd(k, 16)), -side * (0.7 + 0.8 * rnd(k, 17)));
        return { si, from, ctrl, end, rot, launch: FILM.stones + k * FILM.stoneGap };
      }),
    [order, stones],
  );

  // the fog is the sky at the horizon: the house waits in it until the camera comes through the arch
  useLayoutEffect(() => {
    scene.fog = fog;
    ctl.film = film;
    return () => {
      if (scene.fog === fog) scene.fog = null;
      ctl.film = undefined;
    };
  }, [scene, fog, ctl, film]);

  useFrame((st) => {
    const W = st.size.width;
    const H = st.size.height;
    const night = (ctl.state.night ?? 0) > 0.5;
    if (mode.current === 'slot' || start.t === null) {
      // the film is over (or never ran): nothing of it stays in the hero's frame
      if (world.current?.visible) {
        world.current.visible = false;
        fog.near = 1e5;
        fog.far = 2e5;
        ctl.film = undefined;
        ctl.hidden = false;
        labelEls.current.forEach((d) => (d.style.opacity = '0'));
      }
      return;
    }
    const t = performance.now() / 1000 - start.t;
    const cam = st.camera as THREE.PerspectiveCamera;
    // the house is drawn (and its shaders are compiled, see StageScene's Precompile) before the film starts, then
    // waits until the keystone beat
    ctl.hidden = frames.current++ > 0 && t < FILM.beam;

    // ---- light and sky: dusk lifts toward the page colour ----
    const sky = inOut(prog(t, FILM.sky, FILM.skyDur));
    film.dusk = 1 - sky;
    film.focus.set(0, 0, lerp(ZA, 0, inOut(prog(t, 2.85, 0.6))));
    // the fog is the CSS sky at the height the street sits on screen, so what waits behind the arch is haze
    const fy = clamp01((1 - tmp.p.set(0, 2.2, 0).project(cam).y) / 2);
    skyAt(fy, night, sky, fog.color, tmp.c);
    const toArch = cam.position.distanceTo(AC);
    const clear = easeOut(prog(t, 2.85, 0.65));
    fog.near = toArch + 3.5 + clear * 90;
    fog.far = toArch + 15 + clear * 180;

    // ---- the blueprint: grid draws outward, measurements, then it fades as the stones stand ----
    const bpCol = tmp.d.set('#BFD9CE').lerp(tmp.c.set(night ? '#7FB09C' : PX.pine), sky);
    bp.mat.uniforms.uColor.value.copy(bpCol);
    bp.mat.uniforms.uR.value = 18 * easeOut(prog(t, FILM.grid, FILM.gridDur * 1.25));
    const bpFade = 1 - inOut(prog(t, 2.2, 0.9));
    bp.mat.uniforms.uGrid.value = 0.85 * bpFade;
    bp.mat.uniforms.uMarks.value = 0.9 * (1 - inOut(prog(t, 2.0, 0.5)));
    elev.mat.uniforms.uColor.value.copy(bpCol);
    elev.mat.uniforms.uDraw.value = 1.02 * inOut(prog(t, 0.18, 0.62));
    elev.mat.uniforms.uFade.value = 1 - inOut(prog(t, 1.2, 0.8));
    elev.mat.uniforms.uKey.value = 1 - inOut(prog(t, FILM.lock - 0.1, 0.25));

    // ---- the stones: curved flights from both sides, alternating, each rotating into place and settling ----
    const u = stones.mats;
    for (const f of flights) {
      const p = (t - f.launch) / FILM.stoneDur;
      const m = u[f.si];
      if (p <= 0) {
        m.makeScale(0, 0, 0);
        continue;
      }
      const e = easeOutQuart(p);
      // quadratic Bézier from the side, over the top, into place
      const a = tmp.a.copy(f.from).lerp(f.ctrl, e);
      const b = tmp.b.copy(f.ctrl).lerp(f.end, e);
      tmp.p.copy(a).lerp(b, e);
      const r = 1 - easeOut(Math.min(1, p * 1.08));
      tmp.e.set(f.rot.x * r, f.rot.y * r, f.rot.z * r);
      // the settle: a few millimetres past the landing and back
      const age = (p - 1) * FILM.stoneDur;
      if (age > 0) tmp.p.y -= 0.035 * Math.exp(-age * 11) * Math.sin(age * 26);
      tmp.q.setFromEuler(tmp.e);
      m.compose(tmp.p, tmp.q, tmp.s);
    }

    // ---- the keystone: a beam opens, it comes down slowly turning 90°, then drops into its slot ----
    const kp = prog(t, FILM.beam, FILM.lock - FILM.beam);
    const km = keyMesh.current;
    if (km) {
      const down = kp < 0.8 ? 0.84 * Math.sin((kp / 0.8) * (Math.PI / 2)) : 0.84 + 0.16 * Math.pow((kp - 0.8) / 0.2, 2);
      km.scale.setScalar(t >= FILM.beam ? 1 : 1e-4);
      km.position.set(key.centre.x, key.centre.y + 4.2 * (1 - down), 0);
      km.rotation.y = (Math.PI / 2) * (1 - inOut(Math.min(1, kp / 0.82)));
      const s = t - FILM.lock;
      key.mat.emissiveIntensity = s > 0 ? 0.6 * Math.exp(-s * 4.5) : 0.12 * prog(t, FILM.beam, 0.3);
      if (keyLight.current) keyLight.current.intensity = s > 0 ? 7 * Math.exp(-s * 4) : 0;
    }
    const bm = beamMesh.current;
    if (bm) {
      const open = easeOut(prog(t, FILM.beam, 0.22)) * (1 - inOut(prog(t, FILM.lock + 0.08, 0.45)));
      beam.mat.uniforms.uO.value = open * (night ? 1.0 : 0.45);
      bm.scale.set(0.15 + 0.85 * open, 1, 0.15 + 0.85 * open);
    }
    // the lock: the whole arch settles 2px (in screen pixels at this distance) and the glow runs out the joints
    const s = t - FILM.lock;
    if (arch.current) {
      if (s > 0 && settle.current === null) settle.current = (2 * 2 * cam.position.distanceTo(AC) * Math.tan(((cam.fov / 2) * Math.PI) / 180)) / H;
      const px = settle.current ?? 0;
      arch.current.position.y = s > 0 ? -px * (1 - Math.exp(-s * 22)) * (1 + 0.25 * Math.exp(-s * 9) * Math.sin(s * 30)) : 0;
      // once the camera is through, the arch is behind it for good: stop drawing it
      if (cam.position.z < ZA - 3) passed.current = true;
      arch.current.visible = !passed.current;
    }
    joints.mat.uniforms.uS.value = s > 0 ? s : -1;
    dust.mat.uniforms.uT.value = t;
    // moonlight is dim: the stones lift toward the night logo's pine so the arch reads on the night sky
    stones.mat.color.set(night ? '#5F9C85' : '#4B7F6A');
    dust.mat.uniforms.uScale.value = H / (2 * Math.tan(((cam.fov / 2) * Math.PI) / 180));
    dust.mat.uniforms.uColor.value.set(night ? '#8E99A0' : '#E6DDCF');

    // ---- the arch leaves the frame (the camera is in its opening): hand over to the 2D arch ----
    if (!out.current && cam.position.z < ZA + DEPTH / 2 + 1.1 && t > FILM.fly) {
      out.current = true;
      const pts = [
        [-(R2 * S), 0],
        [R2 * S, 0],
        [-(R2 * S), ARCH_TOP],
        [R2 * S, ARCH_TOP],
      ].map(([x, y]) => tmp.p.set(x, y, ZA + DEPTH / 2).project(cam).clone());
      const xs = pts.map((v) => ((v.x + 1) / 2) * W);
      const ys = pts.map((v) => ((1 - v.y) / 2) * H);
      const left = Math.min(...xs);
      const top = Math.min(...ys);
      onArchOut?.({ left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top });
    }

    // ---- the street: lamps glow at dusk (and at night); it all fades as the scene lands on the hero ----
    const leave = 1 - easeOut(prog(t, FILM.exit, 0.38));
    const lampOn = night ? 1 : 0.35 + 0.65 * film.dusk;
    mats.halo.uniforms.uOpacity.value = lampOn * 0.75 * leave;
    mats.halo.uniforms.uScale.value = dust.mat.uniforms.uScale.value;
    mats.glass.opacity = leave;
    mats.glass.color.set('#FFE2A6').multiplyScalar(0.75 + 0.25 * lampOn);
    mats.pole.opacity = leave;
    mats.ground.opacity = leave;
    // the paper ground and the street darken with the page at night
    mats.ground.color.set(night ? '#4E5955' : '#ECEDE7');
    mats.road.color.set(night ? '#7C8682' : '#FFFFFF');
    mats.road.opacity = leave;
    if (street.current) street.current.visible = leave > 0.003;
    if (world.current) world.current.visible = t < FILM.total + 0.2;

    // ---- the annotations ----
    // the span is drawn as a dimension line only: no "span 4.2m" text in the opening
    const [keyEl] = labelEls.current;
    const col = `#${bpCol.getHexString()}`;
    const place = (el: HTMLDivElement | undefined, x: number, y: number, z: number, o: number, dy: number) => {
      if (!el) return;
      if (o <= 0.003) {
        if (el.style.opacity !== '0') el.style.opacity = '0';
        return;
      }
      const v = tmp.p.set(x, y, z).project(cam);
      el.style.transform = `translate3d(${(((v.x + 1) / 2) * W).toFixed(1)}px, ${(((1 - v.y) / 2) * H + dy).toFixed(1)}px, 0) translate(-50%, -50%)`;
      el.style.opacity = o.toFixed(3);
      el.style.color = col;
    };
    place(keyEl, 0, ARCH_TOP, ZA + DEPTH / 2, easeOut(prog(t, 0.62, 0.3)) * (1 - inOut(prog(t, FILM.beam - 0.15, 0.3))), -16);
  });

  return (
    <>
      {/* the lock's warm light: outside every group that hides, so the scene's light count never changes (a
          change would recompile every lit material mid-film) */}
      <pointLight ref={keyLight} color="#FFC56E" intensity={0} distance={6} decay={1.6} position={[0, ARCH_TOP - 0.5, ZA + DEPTH / 2 + 0.9]} />
    <group ref={world}>
      {/* the street the camera arrives on */}
      <group ref={street}>
        <mesh material={mats.ground} position={[0, -0.09, 8]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-3}>
          <planeGeometry args={[80, 80]} />
        </mesh>
        <mesh material={mats.road} position={[0, -0.075, 9.7]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-2}>
          <planeGeometry args={[64, 8.4]} />
        </mesh>
        <mesh geometry={lampGeo.poleAll} material={mats.pole} castShadow />
        <mesh geometry={lampGeo.glassAll} material={mats.glass} />
        <points geometry={lampGeo.halo} material={mats.halo} frustumCulled={false} />
      </group>
      {/* the arch, its blueprint and its shadow */}
      <group position={[0, 0, ZA]}>
        <mesh geometry={bp.geo} material={bp.mat} position={[0, 0.004, 0]} renderOrder={1} />
        <mesh material={mats.catcher} position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow renderOrder={0}>
          <planeGeometry args={[18, 18]} />
        </mesh>
        <group ref={arch}>
          <mesh geometry={stones.geo} material={stones.mat} customDepthMaterial={stones.depth} castShadow receiveShadow frustumCulled={false} />
          <mesh ref={keyMesh} geometry={key.geo} material={key.mat} castShadow receiveShadow scale={1e-4} />
          <mesh geometry={joints.geo} material={joints.mat} renderOrder={4} frustumCulled={false} />
          <lineSegments geometry={elev.geo} material={elev.mat} renderOrder={3} frustumCulled={false} />
          <mesh ref={beamMesh} geometry={beam.geo} material={beam.mat} position={[0, ARCH_TOP + beam.h / 2, 0]} renderOrder={5} />
        </group>
        <points geometry={dust.geo} material={dust.mat} frustumCulled={false} renderOrder={6} />
      </group>
    </group>
    </>
  );
}
