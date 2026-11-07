/**
 * A walk cycle for a <Figure>: legs swing from the hip like pendulums (ease-out from rest, ease-in-out
 * between extremes, ease-in back to rest), arms swing against the legs, and the body (`bob`, an HTML
 * wrapper, so it runs on the compositor) rises a little on each step. Web Animations API only: no per-frame
 * JS, transforms only. Returns a cancel function.
 */
type Opts = { steps: number; dur: number; arms?: boolean; amp?: number; delay?: number; bob?: HTMLElement | null };

const part = (fig: SVGGElement, name: string) => fig.querySelector<SVGGElement>(`[data-part="${name}"]`);

function pendulum(steps: number, amp: number): Keyframe[] {
  const k = Math.max(1, steps);
  const frames: Keyframe[] = [{ transform: 'rotate(0deg)', offset: 0, easing: 'cubic-bezier(0.2, 0.6, 0.4, 1)' }];
  for (let i = 0; i < k; i++) {
    const a = i % 2 === 0 ? amp : -amp;
    frames.push({ transform: `rotate(${a}deg)`, offset: (i + 0.5) / k, easing: i === k - 1 ? 'cubic-bezier(0.6, 0, 0.8, 0.4)' : 'cubic-bezier(0.45, 0, 0.55, 1)' });
  }
  frames.push({ transform: 'rotate(0deg)', offset: 1 });
  return frames;
}

export function swing(fig: SVGGElement, { steps, dur, arms = true, amp = 20, delay = 0, bob }: Opts): () => void {
  const ms = dur * 1000;
  const anims: Animation[] = [];
  const parts: [string, number][] = [
    ['legL', amp],
    ['legR', -amp],
  ];
  if (arms) parts.push(['armL', -amp * 0.7], ['armR', amp * 0.7]);
  for (const [name, a] of parts) {
    const el = part(fig, name);
    if (!el || typeof el.animate !== 'function') continue;
    if (name.startsWith('leg')) {
      el.style.transformBox = 'fill-box';
      el.style.transformOrigin = '50% 0%';
    }
    anims.push(el.animate(pendulum(steps, a), { duration: ms, delay }));
  }
  if (bob && typeof bob.animate === 'function') {
    anims.push(
      bob.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-1.2px)' }, { transform: 'translateY(0)' }], {
        duration: ms / Math.max(1, steps),
        iterations: Math.max(1, steps),
        delay,
        easing: 'ease-in-out',
      }),
    );
  }
  return () => anims.forEach((a) => a.cancel());
}

/** Cancel every running animation on these elements and their descendants. */
export function cancelAll(...els: (Element | null | undefined)[]) {
  for (const el of els) el?.getAnimations?.({ subtree: true }).forEach((a) => a.cancel());
}
