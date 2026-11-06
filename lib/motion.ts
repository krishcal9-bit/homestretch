// Shared motion tokens (BUILD_SPEC §4.1). No component defines its own duration or easing.
export const spring = {
  snappy: { type: 'spring', stiffness: 500, damping: 38, mass: 0.8 }, // buttons, toggles, chips
  smooth: { type: 'spring', stiffness: 260, damping: 30 }, // panels, drawers, layout shifts
  gentle: { type: 'spring', stiffness: 140, damping: 22 }, // numbers settling, Road markers
} as const;
export const ease = {
  out: [0.22, 1, 0.36, 1] as [number, number, number, number],
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
};
export const dur = { micro: 0.12, short: 0.2, medium: 0.32, long: 0.9 }; // seconds
export const stagger = 0.04;

/** Exits are ~30% faster than entrances (pro-ui-craft). */
export const exit = { type: 'tween', duration: 0.16, ease: ease.out } as const;
export const exitDrawer = { type: 'tween', duration: 0.22, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] } as const;
