// Request validation, modelled on the course's FluentValidation validators.
//
// Each validator returns field -> messages (empty object = valid), the same
// shape as ASP.NET's ValidationProblemDetails.errors, so screens can show a
// message under the right input. The rules mirror the CHECK constraints in
// supabase/migrations; the database still enforces them as the last line.
//
// Like the course's injectable ISystemClock, anything that depends on "today"
// takes it as a parameter, so tests can pin the date.

import { toKg, type WeightUnit } from './units';

export type FieldErrors<F extends string = string> = Partial<Record<F, string[]>>;

export const MAX_PAGE_SIZE = 100;
const MAX_WEIGHT_KG = 700;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const INVITE_CODE = /^[0-9A-F]{8}$/;

export function isValid(errors: FieldErrors): boolean {
  return Object.keys(errors).length === 0;
}

/** Today's date as YYYY-MM-DD in the device's local time zone. */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function add<F extends string>(errors: FieldErrors<F>, field: F, message: string) {
  (errors[field] ??= []).push(message);
}

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

function checkWeight<F extends string>(
  errors: FieldErrors<F>,
  field: F,
  value: number,
  unit: WeightUnit,
  label: string,
) {
  if (!Number.isFinite(value)) {
    add(errors, field, `${label} must be a number.`);
  } else if (value <= 0) {
    add(errors, field, `${label} must be greater than 0.`);
  } else if (toKg(value, unit) >= MAX_WEIGHT_KG) {
    add(errors, field, `${label} looks too high. Check the unit (kg/lb).`);
  }
}

// ---------------------------------------------------------------------------

export type WeighInInput = { weight: number; unit: WeightUnit; measuredOn: string };

export function validateWeighIn(
  input: WeighInInput,
  today: string = localToday(),
): FieldErrors<'weight' | 'measuredOn'> {
  const errors: FieldErrors<'weight' | 'measuredOn'> = {};
  checkWeight(errors, 'weight', input.weight, input.unit, 'Weight');

  if (!isRealDate(input.measuredOn)) {
    add(errors, 'measuredOn', 'Date must be a valid date (YYYY-MM-DD).');
  } else if (input.measuredOn > today) {
    add(errors, 'measuredOn', "You can't log a weight for a future date.");
  }
  return errors;
}

export type SettingsInput = { goalWeight: number | null; unit: WeightUnit };

export function validateSettings(input: SettingsInput): FieldErrors<'goalWeight' | 'unit'> {
  const errors: FieldErrors<'goalWeight' | 'unit'> = {};
  if (input.unit !== 'kg' && input.unit !== 'lb') {
    add(errors, 'unit', 'Unit must be kg or lb.');
  }
  if (input.goalWeight !== null) {
    checkWeight(errors, 'goalWeight', input.goalWeight, input.unit, 'Goal weight');
  }
  return errors;
}

export function validateDisplayName(name: string): FieldErrors<'displayName'> {
  const errors: FieldErrors<'displayName'> = {};
  const trimmed = name.trim();
  if (trimmed.length === 0) add(errors, 'displayName', 'Name must not be empty.');
  else if (trimmed.length > 40) add(errors, 'displayName', 'Name must be 40 characters or fewer.');
  return errors;
}

export function validateGroupName(name: string): FieldErrors<'name'> {
  const errors: FieldErrors<'name'> = {};
  const trimmed = name.trim();
  if (trimmed.length === 0) add(errors, 'name', 'Group name must not be empty.');
  else if (trimmed.length > 60) add(errors, 'name', 'Group name must be 60 characters or fewer.');
  return errors;
}

export function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

export function validateInviteCode(code: string): FieldErrors<'inviteCode'> {
  const errors: FieldErrors<'inviteCode'> = {};
  if (!INVITE_CODE.test(normalizeInviteCode(code))) {
    add(errors, 'inviteCode', 'Invite codes are 8 characters, letters A–F and digits.');
  }
  return errors;
}

// Paging, as in the course's GetAllEmployeesRequestValidator.
export type PageInput = { page?: number; pageSize?: number; from?: string; to?: string };

export function validatePage(input: PageInput): FieldErrors<'page' | 'pageSize' | 'from' | 'to'> {
  const errors: FieldErrors<'page' | 'pageSize' | 'from' | 'to'> = {};
  const { page, pageSize, from, to } = input;

  if (page !== undefined && (!Number.isInteger(page) || page < 1)) {
    add(errors, 'page', 'Page number must be set to a positive non-zero integer.');
  }
  if (pageSize !== undefined) {
    if (!Number.isInteger(pageSize) || pageSize < 1) {
      add(errors, 'pageSize', 'You must return at least one record.');
    } else if (pageSize > MAX_PAGE_SIZE) {
      add(errors, 'pageSize', `You cannot return more than ${MAX_PAGE_SIZE} records.`);
    }
  }
  if (from !== undefined && !isRealDate(from)) add(errors, 'from', 'From must be a valid date.');
  if (to !== undefined && !isRealDate(to)) add(errors, 'to', 'To must be a valid date.');
  if (from && to && isRealDate(from) && isRealDate(to) && from > to) {
    add(errors, 'to', 'To must be on or after From.');
  }
  return errors;
}
