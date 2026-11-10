// §9B Rides like this (FUELING_RULES.md). Pure: no I/O, no dates from the clock.
import { SIMILAR_RIDES as S } from './constants.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const halfServings = (n) => Math.round(n * 2) / 2;

/**
 * Past rides that look like the one being planned, so the rider can reuse what worked.
 *
 * @param {{ durationMin: number, kcalPerHour: number }} target  the ride being planned
 * @param {Array<{
 *   id: string, date: string, name?: string, durationMin: number, kcalBurned: number,
 *   actual: { carbsGph: number, fluidMlPerHr: number, sodiumMgPerHr: number } | null,
 *   intake?: Array<{ foodId: string, servings: number }>,
 *   checkIn?: { giScore: number, energyScore: number, bonked?: boolean } | null,
 * }>} rides  the rider's past rides (any order)
 * @returns {Array<{ id, date, name, durationMin, kcalPerHour, carbsGph, fluidMlPerHr, sodiumMgPerHr,
 *   worked: boolean, checkIn, perHour: Array<{ foodId: string, servings: number }> }>}
 *   Best first: rides that went well (good stomach and energy) before the rest, then the closest match.
 *   Only rides with something logged are useful, so the others are skipped.
 */
export function findSimilarRides(target, rides, { limit = S.limit } = {}) {
  const { durationMin, kcalPerHour } = target ?? {};
  if (!isNum(durationMin) || durationMin <= 0 || !isNum(kcalPerHour) || kcalPerHour <= 0) return [];

  const matches = [];
  for (const ride of rides ?? []) {
    if (!ride?.actual || !(ride.actual.carbsGph > 0)) continue; // nothing logged → nothing to learn
    if (!isNum(ride.durationMin) || ride.durationMin <= 0 || !isNum(ride.kcalBurned)) continue;
    const hours = ride.durationMin / 60;
    const rideKcalPerHour = ride.kcalBurned / hours;
    const durationDiff = Math.abs(ride.durationMin - durationMin) / durationMin;
    const intensityDiff = Math.abs(rideKcalPerHour - kcalPerHour) / kcalPerHour;
    if (durationDiff > S.durationTolerance || intensityDiff > S.intensityTolerance) continue;

    const c = ride.checkIn;
    const worked = Boolean(c) && c.giScore >= S.workedMinScore && c.energyScore >= S.workedMinScore && !c.bonked;
    matches.push({
      id: ride.id,
      date: ride.date,
      name: ride.name ?? null,
      durationMin: ride.durationMin,
      kcalPerHour: Math.round(rideKcalPerHour),
      carbsGph: ride.actual.carbsGph,
      fluidMlPerHr: ride.actual.fluidMlPerHr,
      sodiumMgPerHr: ride.actual.sodiumMgPerHr,
      worked,
      checkIn: c ? { giScore: c.giScore, energyScore: c.energyScore, bonked: Boolean(c.bonked) } : null,
      perHour: (ride.intake ?? [])
        .filter((i) => i.servings > 0)
        .map((i) => ({ foodId: i.foodId, servings: halfServings(i.servings / hours) }))
        .filter((i) => i.servings > 0),
      score: durationDiff / S.durationTolerance + intensityDiff / S.intensityTolerance,
    });
  }

  return matches
    .sort((a, b) => Number(b.worked) - Number(a.worked) || a.score - b.score || String(b.date).localeCompare(String(a.date)))
    .slice(0, limit)
    .map(({ score, ...rest }) => rest);
}
