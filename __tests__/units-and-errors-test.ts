import { describe, expect, it } from '@jest/globals';
import { ApiError, toApiError, unwrap } from '../src/lib/api/errors';
import { formatWeight, fromKg, roundKg, toKg } from '../src/lib/units';

describe('units', () => {
  it('round-trips kg ↔ lb', () => {
    expect(fromKg(toKg(180, 'lb'), 'lb')).toBeCloseTo(180, 10);
    expect(toKg(80, 'kg')).toBe(80);
  });

  it('rounds to the 2 decimals the database stores', () => {
    expect(roundKg(toKg(180, 'lb'))).toBe(81.65);
  });

  it('formats in the chosen unit', () => {
    expect(formatWeight(80, 'kg')).toBe('80.0 kg');
    expect(formatWeight(80, 'lb')).toBe('176.4 lb');
  });
});

describe('toApiError (ProblemDetails equivalent)', () => {
  it('maps the one-per-day unique constraint to the date field', () => {
    const err = toApiError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "weigh_ins_user_id_measured_on_key"',
    });
    expect(err.kind).toBe('conflict');
    expect(err.fieldErrors.measuredOn?.[0]).toMatch(/already logged/);
  });

  it('maps check constraints to their field', () => {
    const err = toApiError({
      code: '23514',
      message: 'new row for relation "user_settings" violates check constraint "user_settings_goal_weight_kg_check"',
    });
    expect(err.kind).toBe('validation');
    expect(Object.keys(err.fieldErrors)).toEqual(['goalWeight']);
  });

  it('maps RPC exceptions', () => {
    const err = toApiError({ code: 'P0001', message: 'invalid invite code' });
    expect(err.kind).toBe('not-found');
    expect(err.fieldErrors.inviteCode).toEqual(['No group has that invite code.']);
  });

  it('treats permission errors as auth problems', () => {
    expect(toApiError({ code: '42501', message: 'permission denied' }).kind).toBe('auth');
  });

  it('falls back to the raw message', () => {
    const err = toApiError({ code: 'XX000', message: 'boom' });
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe('unknown');
    expect(err.message).toBe('boom');
  });

  it('unwrap returns data or throws ApiError', () => {
    expect(unwrap({ data: [1], error: null })).toEqual([1]);
    expect(() => unwrap({ data: null, error: { code: 'P0001', message: 'not authenticated' } })).toThrow(
      'Please sign in again.',
    );
  });
});
