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

/** Least-squares straight line through the points, or null if there's no slope to fit. */
export function linearTrend(points: { x: number; y: number }[]): { slope: number; intercept: number } | null {
  const n = points.length;
  if (n < 2) return null;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (const p of points) {
    sxy += (p.x - meanX) * (p.y - meanY);
    sxx += (p.x - meanX) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { slope, intercept: meanY - slope * meanX };
}

type Rankable = {
  category: string;
  rankedBy: 'both' | 'kg' | 'pct';
  changeKg: number;
  pctChange: number;
  displayName: string;
};

/**
 * One ranking: the entries for `category` that apply to `metric`, sorted with
 * the biggest loss first (most negative), ties broken by name.
 */
export function rankingFor<T extends Rankable>(entries: T[], category: string, metric: 'kg' | 'pct'): T[] {
  const value = (e: T) => (metric === 'kg' ? e.changeKg : e.pctChange);
  return entries
    .filter((e) => e.category === category && (e.rankedBy === 'both' || e.rankedBy === metric))
    .sort((a, b) => value(a) - value(b) || a.displayName.localeCompare(b.displayName));
}

/** Days since 1970-01-01 for a YYYY-MM-DD date (handy as a chart x value). */
export function dayNumber(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / 86_400_000;
}
