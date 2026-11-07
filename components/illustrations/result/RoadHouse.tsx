'use client';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { memo } from 'react';
import { HouseCanvas } from '@/components/three/HouseCanvas';
import { IsoHouse, isoPx } from '@/components/illustrations/IsoHouse';
import { ease } from '@/lib/motion';
import type { HouseBuild } from '@/components/three/houseModel';

/** Where the Road's slot meets the road (keep in step with SLOT.house in components/result/Road.tsx). */
const AX = 0.31;
const AY = 0.81;
/** The 2D house's lawn corner that should meet the end of the road (house units, see IsoHouse). */
const ISO_FOOT = { x: -2, y: 4 };

/**
 * What stands at the end of the result / plan Road: the 3D house (it builds as the road reaches it, lights
 * one window per ticked plan item and its porch light once the date settles). While a home is chosen in
 * "Aim for a specific home", that home stands there instead: the 3D house sinks back and fades, the chosen
 * house builds in on the same spot. Memoized with primitive props, so dragging a lever (which re-renders the
 * Road every frame) never re-renders the canvas: the canvas renders on demand from these props only.
 */
export const RoadHouse = memo(function RoadHouse({
  build,
  lit,
  porch,
  tilt = false,
  chosen,
  onBuilt,
}: {
  build: HouseBuild;
  lit: number;
  porch: boolean;
  tilt?: boolean;
  /** a chosen home's id: the 2D house stands in for the 3D one */
  chosen?: string | null;
  onBuilt?: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="relative h-full w-full [container-type:inline-size]">
      <motion.div
        className="absolute inset-0"
        style={{ originX: AX, originY: AY }}
        initial={false}
        animate={{ opacity: chosen ? 0 : 1, scale: chosen ? 0.92 : 1, y: chosen ? 6 : 0 }}
        transition={chosen ? { duration: 0.28, ease: ease.out } : { type: 'spring', duration: 0.5, bounce: 0.15 }}
      >
        <HouseCanvas build={build} lit={Math.min(5, lit)} porch={porch} tilt={tilt} eager onBuilt={onBuilt} />
      </motion.div>
      <AnimatePresence initial={false}>
        {chosen && (
          <motion.div
            key={chosen}
            className="absolute inset-0"
            initial={reduce ? { opacity: 0 } : { opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
          >
            <ChosenHouse />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/** The chosen home on the slot: a 2D house whose lawn corner meets the end of the road. */
function ChosenHouse() {
  // sized in the slot's own width (cqw) so it scales with the slot; positioned from house units
  const size = 54; // % of the slot width
  const foot = isoPx(100, ISO_FOOT.x, ISO_FOOT.y); // in % of the house's width
  const left = AX * 100 - (foot.x * size) / 100;
  // the slot is 5:4, so 1% of its height is 0.8% of its width
  const top = AY * 80 - (foot.y * size) / 100;
  return (
    <div className="absolute" style={{ left: `${left}cqw`, top: `${top}cqw`, width: `${size}cqw` }}>
      <IsoHouse size={1000} build="quick" lit porch doorBrass className="!h-auto !w-full" />
    </div>
  );
}
