// One error type for every API call, playing the role of the course's
// ProblemDetails / ValidationProblemDetails: a human message plus optional
// per-field errors the screen can show next to the right input.

import type { FieldErrors } from '../validation';

export type ApiErrorKind = 'validation' | 'conflict' | 'not-found' | 'auth' | 'unknown';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly fieldErrors: FieldErrors = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static validation(fieldErrors: FieldErrors): ApiError {
    return new ApiError('Please fix the highlighted fields.', 'validation', fieldErrors);
  }
}

/** Subset of supabase-js's PostgrestError that we rely on. */
type PostgrestLikeError = { code?: string; message: string };

// Database constraint names → which field broke and what to tell the user.
// Postgres names constraints <table>_<column>_check / <table>_<cols>_key.
const CONSTRAINTS: Record<string, { field: string; message: string; kind: ApiErrorKind }> = {
  weigh_ins_user_id_measured_on_key: {
    field: 'measuredOn',
    message: 'You already logged a weight for this day. Edit that entry instead.',
    kind: 'conflict',
  },
  weigh_ins_weight_kg_check: { field: 'weight', message: 'Weight is out of range.', kind: 'validation' },
  user_settings_goal_weight_kg_check: { field: 'goalWeight', message: 'Goal weight is out of range.', kind: 'validation' },
  user_settings_unit_check: { field: 'unit', message: 'Unit must be kg or lb.', kind: 'validation' },
  profiles_display_name_check: { field: 'displayName', message: 'Name must be 1–40 characters.', kind: 'validation' },
  groups_name_check: { field: 'name', message: 'Group name must be 1–60 characters.', kind: 'validation' },
};

// Messages raised by our RPC functions (RAISE EXCEPTION, code P0001).
const RPC_MESSAGES: Record<string, { field?: string; message: string; kind: ApiErrorKind }> = {
  'invalid invite code': { field: 'inviteCode', message: 'No group has that invite code.', kind: 'not-found' },
  'not a member of this group': { message: "You're not a member of this group.", kind: 'not-found' },
  'not authenticated': { message: 'Please sign in again.', kind: 'auth' },
};

export function toApiError(error: PostgrestLikeError): ApiError {
  // 23505 unique_violation, 23514 check_violation
  if (error.code === '23505' || error.code === '23514') {
    const name = Object.keys(CONSTRAINTS).find((c) => error.message.includes(`"${c}"`));
    if (name) {
      const { field, message, kind } = CONSTRAINTS[name];
      return new ApiError(message, kind, { [field]: [message] });
    }
  }
  if (error.code === 'P0001') {
    const known = RPC_MESSAGES[error.message];
    if (known) {
      return new ApiError(known.message, known.kind, known.field ? { [known.field]: [known.message] } : {});
    }
  }
  // PGRST301: JWT expired; 42501: RLS / permission denied
  if (error.code === 'PGRST301' || error.code === '42501') {
    return new ApiError('Please sign in again.', 'auth');
  }
  return new ApiError(error.message || 'Something went wrong.', 'unknown');
}

/** Unwrap a supabase-js `{ data, error }` result, throwing ApiError on failure. */
export function unwrap<T>(result: { data: T | null; error: PostgrestLikeError | null }): T {
  if (result.error) throw toApiError(result.error);
  return result.data as T;
}
