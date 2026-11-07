/**
 * The landing intro, one continuous film (seconds from the first 3D frame). One clock drives the 3D scene
 * (components/three/introFilm.tsx), the CSS sky and the title lockup (components/Intro.tsx).
 *  0.00–0.70  dusk to light: deep ink-blue twilight, a warm horizon glow rises, the sky turns toward the page;
 *             a blueprint grid draws outward on the ground with the arch's measurements ("span 4.2m", "keystone")
 *  0.70–2.00  the arch assembles: extruded, bevelled stones fly in from both sides in alternating order on
 *             curved paths, rotate into place and settle, a puff of dust on each landing; the camera orbits 25°
 *  2.00–2.70  the keystone: a 150ms pause, a light beam opens from above, the brass keystone descends turning
 *             90° and locks; the arch settles 2px, a brass glow runs out along the joints, the dust settles
 *  2.70–3.70  through the arch: the camera pushes forward and flies through; on the other side the street
 *             resolves from soft focus (the house, street lamps and trees); the arch shrinks into the logo
 *  3.70–4.50  the name: the scene dims and blurs, "Keystone" solidifies letter by letter, the notch glints,
 *             the tagline fades in; a 1s hold
 *  5.50–6.20  the lockup flies into the header while the scene lands on the hero's house slot and the hero
 *             assembles
 * Without WebGL (or if three.js is late) a still version plays on a shorter clock (INTRO_STILL).
 */
export const FILM = {
  /** blueprint grid draws outward */
  grid: 0,
  gridDur: 0.7,
  /** the twilight lifts toward the page colour */
  sky: 0.2,
  skyDur: 1.9,
  /** stones: launch of the first, gap between launches, flight */
  stones: 0.7,
  stoneGap: 0.095,
  stoneDur: 0.42,
  /** the beam opens and the keystone starts down; it locks at `lock` */
  beam: 2.15,
  lock: 2.62,
  /** the camera's push through the arch */
  fly: 2.7,
  flyEnd: 3.62,
  /** the title lockup mounts (letters still hidden) so the arch can shrink into it */
  mount: 2.9,
  /** the name reveal begins (scene dims and blurs) */
  title: 3.7,
  /** the lockup leaves for the header; the scene lands on the hero slot */
  exit: 5.5,
  total: 6.2,
};
export const INTRO = { title: FILM.title, exit: FILM.exit, pull: FILM.exit, total: FILM.total };
/** The still version: sky, the arch (a render of the 3D one), the arch into the logo, the name, the hand-off. */
export const INTRO_STILL = { arch: 0.25, out: 1.35, mount: 1.0, title: 1.9, exit: 3.7, pull: 3.7, total: 4.4 };
/** If the 3D stage hasn't drawn its first frame by then, the still plays instead. */
export const INTRO_WAIT_MS = 1500;
