import type { Stage } from '@/lib/engine';

/**
 * What a site looks like at each point of a build, in order. The first three are drawn by BuildArt
 * (a lot with a site sign and survey stakes, the footprint cleared and strung, a poured slab); the last
 * three are IsoHouse's own stages.
 */
export const BUILD_STAGES = ['lot', 'staked', 'slab', 'framing', 'roofing', 'finished'] as const;
export type BuildStage = (typeof BUILD_STAGES)[number];

const BY_STATUS: [RegExp, BuildStage][] = [
  [/finish|complete|move|keys|ready|landscap|paint/i, 'finished'],
  [/roof|dry ?wall|insulat|mechanical|plumb|electric|rough/i, 'roofing'],
  [/fram/i, 'framing'],
  [/found|slab|pour|concrete/i, 'slab'],
  [/permit|grading|site prep|stak|survey|break ?ground/i, 'staked'],
];

/** A home's status ("Design", "Permitting", "Framing", …) as the stage its site is drawn in. Unknown statuses read as a lot. */
export function buildStageOf(status: string): BuildStage {
  return BY_STATUS.find(([re]) => re.test(status))?.[1] ?? 'lot';
}

/**
 * The family drawer draws the family's house as far along as their readiness: ready now is a finished house
 * with its window lit, the next six months has the roof going on, and so on back to an empty lot.
 */
export const FAMILY_BUILD: Record<Stage, BuildStage> = {
  ready_now: 'finished',
  le6: 'roofing',
  six_18: 'framing',
  gt18: 'slab',
  not_eligible: 'lot',
};
