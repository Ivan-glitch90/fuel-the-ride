// Metric ↔ imperial helpers for the UI. The calculator itself is metric only.

const LB_PER_KG = 2.2046226218;
const ML_PER_FL_OZ = 29.5735295625;

export const kgToLb = (kg) => kg * LB_PER_KG;
export const lbToKg = (lb) => lb / LB_PER_KG;
export const mlToFlOz = (ml) => ml / ML_PER_FL_OZ;
export const flOzToMl = (flOz) => flOz * ML_PER_FL_OZ;
export const cToF = (c) => (c * 9) / 5 + 32;
export const fToC = (f) => ((f - 32) * 5) / 9;
