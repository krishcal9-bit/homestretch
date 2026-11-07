// Login → console hand-off. The login panel leaves to the left; the console that replaces it should
// arrive from the right, as one continuous move. This only holds within one client-side navigation, so
// it lives in module scope (a hard reload of /staff starts clean and the console appears without travel).
const WINDOW_MS = 4000;
let arrivedAt = -Infinity;

/** Called by the login form right before it navigates into the console. */
export function markConsoleArrival() {
  arrivedAt = performance.now();
}

/** True while the console is mounting straight after a sign-in. Read once, at mount. */
export function arrivingFromLogin() {
  if (typeof performance === 'undefined') return false;
  return performance.now() - arrivedAt < WINDOW_MS;
}

/** Called once the console has played its entrance, so later tab mounts don't replay it. */
export function clearConsoleArrival() {
  arrivedAt = -Infinity;
}
