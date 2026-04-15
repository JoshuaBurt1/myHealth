// src/utils/tdeeUtils.ts

export const calculateTDEE = (
  formula: 'mifflin' | 'katch',
  weight: number,
  height: number,
  age: number,
  sex: string,
  lbm: number,
  activityFactor: number
): number => {
  let bmr = 0;

  if (formula === 'mifflin') {
    if (!weight || !height || !age) return 0;
    const sexMod = (sex.toLowerCase().startsWith('m')) ? 5 : -161;
    bmr = (10 * weight) + (6.25 * height) - (5 * age) + sexMod;
  } else if (formula === 'katch') {
    if (!lbm) return 0;
    bmr = 370 + (21.6 * lbm);
  }

  return Math.max(0, Math.round(bmr * activityFactor));
};

export const estimateActivityFactorFromSteps = (steps: number): { factor: number, label: string } => {
  if (steps >= 12500) return { factor: 1.9, label: `Extra Active (Last 5 avg ${steps} steps)` };
  if (steps >= 10000) return { factor: 1.725, label: `Very Active (Last 5 avg ${steps} steps)` };
  if (steps >= 7500) return { factor: 1.55, label: `Moderately Active (Last 5 avg ${steps} steps)` };
  if (steps >= 5000) return { factor: 1.375, label: `Lightly Active (Last 5 avg ${steps} steps)` };
  return { factor: 1.2, label: `Sedentary (Last 5 avg ${steps} steps)` };
};