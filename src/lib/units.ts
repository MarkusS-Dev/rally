// Weights are always stored in kg; the user's unit only affects display/input.

export type WeightUnit = 'kg' | 'lb';

const LB_PER_KG = 2.2046226218;

export function toKg(value: number, unit: WeightUnit): number {
  return unit === 'kg' ? value : value / LB_PER_KG;
}

export function fromKg(kg: number, unit: WeightUnit): number {
  return unit === 'kg' ? kg : kg * LB_PER_KG;
}

/** Round to the 2 decimals the database stores (numeric(5,2)). */
export function roundKg(kg: number): number {
  return Math.round(kg * 100) / 100;
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${fromKg(kg, unit).toFixed(1)} ${unit}`;
}
