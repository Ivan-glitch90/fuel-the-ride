import { units as convert } from '@fuel-ride/fuel-core';
import { roundTo } from './forms.js';

// The API stores metric. These convert for display and input when the rider picked imperial.

export const weightUnit = (units) => (units === 'imperial' ? 'lb' : 'kg');
export const fluidUnit = (units) => (units === 'imperial' ? 'fl oz' : 'ml');

export const kgToDisplay = (kg, units) => (units === 'imperial' ? roundTo(convert.kgToLb(kg), 1) : kg);
export const displayToKg = (value, units) => roundTo(units === 'imperial' ? convert.lbToKg(value) : value, 1);

export const mlToDisplay = (ml, units) => (units === 'imperial' ? roundTo(convert.mlToFlOz(ml), 1) : ml);
export const displayToMl = (value, units) => Math.round(units === 'imperial' ? convert.flOzToMl(value) : value);
