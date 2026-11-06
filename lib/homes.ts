import type { Home } from './types';
/** A home fits when it has at least one bedroom per two people and isn't more than one bedroom per person. */
export const homeFits = (householdSize: number, bedrooms: number) => bedrooms >= Math.ceil(householdSize / 2) && bedrooms <= Math.max(2, householdSize);
export const fittingHomes = (homes: Home[], size: number) => homes.filter((h) => homeFits(size, h.bedrooms)).sort((a, b) => a.completion.localeCompare(b.completion));
