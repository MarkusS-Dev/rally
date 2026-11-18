// Weight picker: one wheel in 0.1 kg steps.

import { Wheel } from './wheel';

const toTenths = (kg: number) => Math.round(kg * 10);

export function WeightWheel({
  value,
  onChange,
  min = 30,
  max = 300,
}: {
  value: number;
  onChange: (kg: number) => void;
  min?: number;
  max?: number;
}) {
  const count = toTenths(max) - toTenths(min) + 1;
  const valueAt = (i: number) => (toTenths(min) + i) / 10;
  return (
    <Wheel
      count={count}
      index={toTenths(value) - toTenths(min)}
      onChange={(i) => onChange(valueAt(i))}
      label={(i) => valueAt(i).toFixed(1)}
      width={112}
      accessibilityLabel="Weight in kilograms"
    />
  );
}
