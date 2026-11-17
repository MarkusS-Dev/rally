import { describe, expect, it } from '@jest/globals';
import {
  isValid,
  localToday,
  validateDisplayName,
  validateGroupName,
  validateInviteCode,
  validatePage,
  validateSettings,
  validateWeighIn,
} from '../src/lib/validation';

// Pinned "today", like the course's TestSystemClock.
const TODAY = '2022-01-01';

describe('validateWeighIn', () => {
  it('accepts a normal weigh-in', () => {
    expect(validateWeighIn({ weight: 80.4, unit: 'kg', measuredOn: '2021-12-31' }, TODAY)).toEqual({});
  });

  it('accepts today', () => {
    expect(isValid(validateWeighIn({ weight: 80, unit: 'kg', measuredOn: TODAY }, TODAY))).toBe(true);
  });

  it('rejects zero, negative and non-numeric weights', () => {
    for (const weight of [0, -5, NaN, Infinity]) {
      const errors = validateWeighIn({ weight, unit: 'kg', measuredOn: TODAY }, TODAY);
      expect(errors.weight).toHaveLength(1);
      expect(errors.measuredOn).toBeUndefined();
    }
  });

  it('checks the upper bound after unit conversion', () => {
    // 700 lb ≈ 317 kg: fine. 1600 lb ≈ 726 kg: too high.
    expect(validateWeighIn({ weight: 700, unit: 'lb', measuredOn: TODAY }, TODAY)).toEqual({});
    expect(validateWeighIn({ weight: 1600, unit: 'lb', measuredOn: TODAY }, TODAY).weight).toEqual([
      'Weight looks too high. Check the unit (kg/lb).',
    ]);
  });

  it('rejects future dates', () => {
    expect(validateWeighIn({ weight: 80, unit: 'kg', measuredOn: '2022-01-02' }, TODAY).measuredOn).toEqual([
      "You can't log a weight for a future date.",
    ]);
  });

  it('rejects malformed and impossible dates', () => {
    for (const measuredOn of ['', '01/01/2022', '2021-02-30', '2021-13-01']) {
      expect(validateWeighIn({ weight: 80, unit: 'kg', measuredOn }, TODAY).measuredOn).toHaveLength(1);
    }
  });

  it('reports every broken field at once', () => {
    const errors = validateWeighIn({ weight: -1, unit: 'kg', measuredOn: 'nope' }, TODAY);
    expect(Object.keys(errors).sort()).toEqual(['measuredOn', 'weight']);
  });
});

describe('validateSettings', () => {
  it('allows clearing the goal', () => {
    expect(validateSettings({ goalWeight: null, unit: 'lb' })).toEqual({});
  });

  it('validates the goal like a weight', () => {
    expect(validateSettings({ goalWeight: 0, unit: 'kg' }).goalWeight).toEqual([
      'Goal weight must be greater than 0.',
    ]);
  });
});

describe('names and codes', () => {
  it('trims names before checking length', () => {
    expect(validateDisplayName('   ').displayName).toEqual(['Name must not be empty.']);
    expect(validateDisplayName('  Sam  ')).toEqual({});
    expect(validateDisplayName('x'.repeat(41)).displayName).toHaveLength(1);
    expect(validateGroupName('x'.repeat(60))).toEqual({});
    expect(validateGroupName('x'.repeat(61)).name).toHaveLength(1);
  });

  it('accepts invite codes case-insensitively, with surrounding spaces', () => {
    expect(validateInviteCode(' 1a2b3c4d ')).toEqual({});
    expect(validateInviteCode('1A2B3C4')).toHaveProperty('inviteCode');
    expect(validateInviteCode('1A2B3C4G')).toHaveProperty('inviteCode');
  });
});

describe('validatePage (GetAllEmployeesRequestValidator equivalent)', () => {
  it('accepts no paging at all', () => {
    expect(validatePage({})).toEqual({});
  });

  it('uses the course messages for page and size', () => {
    expect(validatePage({ page: 0 }).page).toEqual([
      'Page number must be set to a positive non-zero integer.',
    ]);
    expect(validatePage({ pageSize: 0 }).pageSize).toEqual(['You must return at least one record.']);
    expect(validatePage({ pageSize: 101 }).pageSize).toEqual(['You cannot return more than 100 records.']);
    expect(validatePage({ page: 1, pageSize: 100 })).toEqual({});
  });

  it('checks the date range', () => {
    expect(validatePage({ from: '2022-02-01', to: '2022-01-01' }).to).toEqual([
      'To must be on or after From.',
    ]);
    expect(validatePage({ from: '2022-01-01', to: '2022-01-01' })).toEqual({});
  });
});

describe('localToday', () => {
  it('formats the local date with zero padding', () => {
    expect(localToday(new Date(2022, 0, 5, 23, 59))).toBe('2022-01-05');
  });
});
