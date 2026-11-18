// Pure calculations for the Today screen. No I/O, so they're easy to test.

import type { WeighIn } from './api/types';

/** Shift a YYYY-MM-DD date by a number of days. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Change from roughly a week ago to the latest weigh-in.
 * Baseline = the newest weigh-in at least 7 days older than the latest one.
 * `items` may be in any order. Returns null if there's no such baseline.
 */
export function weeklyChangeKg(items: WeighIn[]): number | null {
  if (items.length < 2) return null;
  const sorted = [...items].sort((a, b) => b.measuredOn.localeCompare(a.measuredOn));
  const latest = sorted[0];
  const cutoff = addDays(latest.measuredOn, -7);
  const baseline = sorted.find((w) => w.measuredOn <= cutoff);
  if (!baseline) return null;
  return Math.round((latest.weightKg - baseline.weightKg) * 10) / 10;
}

export type GoalProgress = {
  /** 0–1 share of the distance from start to goal that's been covered. */
  fraction: number;
  /** kg still to go (always ≥ 0). */
  remainingKg: number;
  reached: boolean;
};

/** Works for losing and gaining goals. Null when start equals goal. */
export function goalProgress(startKg: number, latestKg: number, goalKg: number): GoalProgress | null {
  const total = goalKg - startKg;
  if (total === 0) return null;
  const done = latestKg - startKg;
  const fraction = Math.min(1, Math.max(0, done / total));
  const remaining = Math.max(0, (goalKg - latestKg) * Math.sign(total));
  return {
    fraction,
    remainingKg: Math.round(remaining * 10) / 10,
    reached: fraction >= 1,
  };
}

export function formatKg(kg: number): string {
  return `${kg.toFixed(1)} kg`;
}

/** "+0.4 kg" / "−1.2 kg" (with a real minus sign) / "±0.0 kg". */
export function formatChangeKg(kg: number): string {
  if (kg === 0) return '±0.0 kg';
  return `${kg > 0 ? '+' : '−'}${Math.abs(kg).toFixed(1)} kg`;
}

export function formatPct(pct: number): string {
  if (pct === 0) return '±0.0%';
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`;
}
