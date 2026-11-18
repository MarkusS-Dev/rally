import { describe, expect, it } from '@jest/globals';

import type { WeighIn } from '../src/lib/api/types';
import {
  addDays,
  formatChangeKg,
  formatPct,
  goalProgress,
  linearTrend,
  rankingFor,
  weeklyChangeKg,
} from '../src/lib/stats';
import { splitTime } from '../src/lib/time';
import { normalizeTime, validateSignIn, validateSignUp } from '../src/lib/validation';

const w = (measuredOn: string, weightKg: number, id = 0): WeighIn => ({
  id,
  measuredOn,
  weightKg,
  lastModifiedAt: null,
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2022-01-01', -1)).toBe('2021-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29'); // leap year
    expect(addDays('2022-03-01', -60)).toBe('2021-12-31');
  });
});

describe('weeklyChangeKg', () => {
  it('compares the latest with the newest weigh-in at least 7 days older', () => {
    const items = [w('2022-01-15', 80), w('2022-01-09', 81.5), w('2022-01-08', 82), w('2022-01-01', 83)];
    expect(weeklyChangeKg(items)).toBe(-2); // 80 vs 82 on Jan 8
  });

  it('does not care about input order', () => {
    expect(weeklyChangeKg([w('2022-01-01', 70), w('2022-01-10', 70.4)])).toBe(0.4);
  });

  it('returns null without a week of history', () => {
    expect(weeklyChangeKg([w('2022-01-10', 80), w('2022-01-05', 81)])).toBeNull();
    expect(weeklyChangeKg([w('2022-01-10', 80)])).toBeNull();
  });
});

describe('goalProgress', () => {
  it('tracks a weight-loss goal', () => {
    expect(goalProgress(90, 85, 80)).toEqual({ fraction: 0.5, remainingKg: 5, reached: false });
  });

  it('tracks a weight-gain goal', () => {
    expect(goalProgress(60, 63, 66)).toEqual({ fraction: 0.5, remainingKg: 3, reached: false });
  });

  it('clamps when going the wrong way or past the goal', () => {
    expect(goalProgress(90, 92, 80)).toMatchObject({ fraction: 0, remainingKg: 12 });
    expect(goalProgress(90, 78, 80)).toEqual({ fraction: 1, remainingKg: 0, reached: true });
  });

  it('returns null when start equals goal', () => {
    expect(goalProgress(80, 79, 80)).toBeNull();
  });
});

describe('formatting', () => {
  it('uses a real minus sign and ± for zero', () => {
    expect(formatChangeKg(-1.24)).toBe('−1.2 kg');
    expect(formatChangeKg(0.4)).toBe('+0.4 kg');
    expect(formatChangeKg(0)).toBe('±0.0 kg');
    expect(formatPct(-5)).toBe('−5.0%');
  });
});

describe('account validation', () => {
  it('checks email and password on sign-in', () => {
    expect(validateSignIn({ email: ' sam@example.com ', password: 'x' })).toEqual({});
    expect(Object.keys(validateSignIn({ email: 'nope', password: '' })).sort()).toEqual(['email', 'password']);
  });

  it('requires a name and a 6+ character password on sign-up', () => {
    const errors = validateSignUp({ email: 'sam@example.com', password: '12345', displayName: ' ' });
    expect(errors.password).toEqual(['Password must be at least 6 characters.']);
    expect(errors.displayName).toEqual(['Name must not be empty.']);
    expect(validateSignUp({ email: 'sam@example.com', password: '123456', displayName: 'Sam' })).toEqual({});
  });
});

describe('normalizeTime', () => {
  it('pads valid times and rejects invalid ones', () => {
    expect(normalizeTime('7:05')).toBe('07:05');
    expect(normalizeTime(' 23:59 ')).toBe('23:59');
    expect(normalizeTime('24:00')).toBeNull();
    expect(normalizeTime('7:5')).toBeNull();
    expect(normalizeTime('seven')).toBeNull();
  });
});

describe('linearTrend', () => {
  it('fits a straight line', () => {
    const t = linearTrend([
      { x: 0, y: 100 },
      { x: 1, y: 99 },
      { x: 2, y: 98 },
    ]);
    expect(t?.slope).toBeCloseTo(-1);
    expect(t?.intercept).toBeCloseTo(100);
  });

  it('smooths noise', () => {
    const t = linearTrend([
      { x: 0, y: 80 },
      { x: 1, y: 81 },
      { x: 2, y: 79 },
      { x: 3, y: 80 },
    ]);
    expect(t?.slope).toBeCloseTo(-0.2);
  });

  it('needs two different x values', () => {
    expect(linearTrend([{ x: 1, y: 1 }])).toBeNull();
    expect(linearTrend([{ x: 1, y: 1 }, { x: 1, y: 2 }])).toBeNull();
  });
});

describe('rankingFor', () => {
  const e = (displayName: string, category: string, rankedBy: 'both' | 'kg' | 'pct', changeKg: number, pctChange: number) => ({
    displayName,
    category,
    rankedBy,
    changeKg,
    pctChange,
  });
  const entries = [
    e('Big', 'week', 'both', -2, -1.5), // heavy person: more kg, less %
    e('Small', 'week', 'both', -1.5, -2.3), // light person: less kg, more %
    e('Gainer', 'week', 'both', 0.4, 0.5),
    e('Big', 'best_day', 'kg', -1.7, -1.2),
    e('Big', 'best_day', 'pct', -1.5, -1.3),
    e('Other', 'month', 'both', -9, -9),
  ];

  it('ranks the same people differently by kg and by %', () => {
    expect(rankingFor(entries, 'week', 'kg').map((x) => x.displayName)).toEqual(['Big', 'Small', 'Gainer']);
    expect(rankingFor(entries, 'week', 'pct').map((x) => x.displayName)).toEqual(['Small', 'Big', 'Gainer']);
  });

  it('uses the record row that belongs to the metric', () => {
    expect(rankingFor(entries, 'best_day', 'kg')).toEqual([entries[3]]);
    expect(rankingFor(entries, 'best_day', 'pct')).toEqual([entries[4]]);
  });
});

describe('splitTime (reminder wheels)', () => {
  it('rounds minutes to the 5-minute wheel', () => {
    expect(splitTime('07:32')).toEqual([7, 30]);
    expect(splitTime('07:33')).toEqual([7, 35]);
    expect(splitTime('08:00')).toEqual([8, 0]);
    expect(splitTime('07:58')).toEqual([8, 0]); // carries into the next hour
    expect(splitTime('23:58')).toEqual([0, 0]); // and past midnight
  });
});
