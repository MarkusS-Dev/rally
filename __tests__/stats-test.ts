import { describe, expect, it } from '@jest/globals';

import type { WeighIn } from '../src/lib/api/types';
import {
  addDays,
  formatChangeKg,
  formatPct,
  goalProgress,
  weeklyChangeKg,
} from '../src/lib/stats';
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
