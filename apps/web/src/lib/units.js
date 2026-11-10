import { units as convert } from '@fuel-ride/fuel-core';
import { roundTo } from './forms.js';

// The API stores metric. These convert for display and input when the rider picked imperial.

export const weightUnit = (units) => (units === 'imperial' ? 'lb' : 'kg');
export const fluidUnit = (units) => (units === 'imperial' ? 'fl oz' : 'ml');

export const kgToDisplay = (kg, units) => (units === 'imperial' ? roundTo(convert.kgToLb(kg), 1) : kg);
export const displayToKg = (value, units) => roundTo(units === 'imperial' ? convert.lbToKg(value) : value, 1);

export const mlToDisplay = (ml, units) => (units === 'imperial' ? roundTo(convert.mlToFlOz(ml), 1) : ml);
export const displayToMl = (value, units) => Math.round(units === 'imperial' ? convert.flOzToMl(value) : value);

export const tempUnit = (units) => (units === 'imperial' ? '°F' : '°C');
/** 60.1 km → "60.1 km" / "37.3 mi" */
export const formatDistance = (km, units) =>
  units === 'imperial' ? `${roundTo(km * 0.621371, 1)} mi` : `${roundTo(km, 1)} km`;
/** 830 m → "830 m" / "2,723 ft" (climbing) */
export const formatElevation = (m, units) =>
  units === 'imperial' ? `${Math.round(m * 3.28084).toLocaleString()} ft` : `${Math.round(m).toLocaleString()} m`;
export const displayToC = (value, units) => roundTo(units === 'imperial' ? convert.fToC(value) : value, 1);
export const cToDisplay = (c, units) => (units === 'imperial' ? Math.round(convert.cToF(c)) : c);

/** A fluid amount for display: "600 ml", "1.2 L" for big totals, or "20.3 fl oz". */
export function formatFluid(ml, units) {
  if (units === 'imperial') return `${roundTo(convert.mlToFlOz(ml), 1)} fl oz`;
  return ml >= 1000 ? `${roundTo(ml / 1000, 1)} L` : `${Math.round(ml)} ml`;
}
