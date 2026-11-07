'use client';
import { IsoHouse, type HouseStage } from '@/components/illustrations/IsoHouse';

// A street of homes going up, at different stages and sizes so it reads as a skyline, not a pattern.
const ROW: [HouseStage, number][] = [
  ['finished', 34],
  ['framing', 30],
  ['roofing', 36],
  ['finished', 32],
  ['finished', 38],
  ['framing', 33],
  ['roofing', 30],
  ['finished', 36],
  ['framing', 31],
  ['finished', 34],
  ['roofing', 37],
  ['finished', 31],
  ['framing', 35],
  ['finished', 33],
];

/**
 * The console header's skyline: a faint, static row of houses at different build stages (framing, roofing,
 * finished; never a brass door), standing on the header's bottom rule at 9% strength. It sits in the empty
 * stretch between the tabs and the theme switch, so it is never behind a control, and fades in from the left. No motion.
 */
export function HeaderSkyline() {
  return (
    <div
      aria-hidden
      data-testid="header-skyline"
      className="pointer-events-none absolute inset-y-0 left-[560px] right-[176px] -z-10 flex items-end justify-end gap-1.5 overflow-hidden opacity-[0.09] [mask-image:linear-gradient(to_right,transparent,#000_120px)]"
    >
      {ROW.map(([stage, size], i) => (
        <IsoHouse key={i} size={size} stage={stage} doorBrass={false} detail={false} className="-mb-[3px] shrink-0" />
      ))}
    </div>
  );
}
