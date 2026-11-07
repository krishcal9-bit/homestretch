/**
 * The landing intro, one continuous film (seconds from the first 3D frame):
 *  0.00–0.37  sky + blueprint grid, construction lines draw
 *  0.37–1.30  the house builds with overlap (plinth, walls 60ms apart, roof drops and settles, chimney,
 *             windows and door slot in); the camera orbits 20° and pushes in while the trees grow
 *  1.45       the first window lights; smoke starts
 *  1.63–1.91  the brass key flies in, turns; the door swings open, warm light spills out
 *  1.95–4.25  title card (the hero of the intro): the scene blurs and dims to ~30%; "HomeStretch" (700,
 *             ~68% of the width) rises letter by letter, the road draws under "Stretch", the house mark pops
 *             and its window lights, the tagline fades in; a 1.2s hold with one shimmer
 *  4.25–5.00  the wordmark flies into the header (700ms spring); the scene un-blurs and lands on the hero's
 *             house slot; the hero assembles
 * Without WebGL (or if three.js is late) the still render plays the same title card on a shorter clock.
 */
export const INTRO = { speed: 1.35, title: 1.95, exit: 4.25, pull: 4.25, total: 5.0 };
export const INTRO_STILL = { title: 0.55, exit: 2.85, pull: 2.85, total: 3.6 };
/** If the 3D stage hasn't drawn its first frame by then, the still plays instead. */
export const INTRO_WAIT_MS = 1200;
