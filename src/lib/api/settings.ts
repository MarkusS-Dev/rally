import type { ProfileRow, UserSettingsRow } from '../database.types';
import { supabase } from '../supabase';
import { roundKg, toKg } from '../units';
import { isValid, validateDisplayName, validateSettings, type FieldErrors } from '../validation';
import { ApiError, unwrap } from './errors';
import { currentUserId } from './session';
import type { MySettings, UpdateSettingsRequest } from './types';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function getMySettings(): Promise<MySettings> {
  const me = await currentUserId();
  const [profile, settings] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', me).single(),
    supabase.from('user_settings').select('goal_weight_kg, unit, reminder_time').eq('user_id', me).single(),
  ]);
  const p = unwrap<Pick<ProfileRow, 'display_name'>>(profile);
  const s = unwrap<Pick<UserSettingsRow, 'goal_weight_kg' | 'unit' | 'reminder_time'>>(settings);

  return {
    displayName: p.display_name,
    goalWeightKg: s.goal_weight_kg === null ? null : Number(s.goal_weight_kg),
    unit: s.unit,
    reminderTime: s.reminder_time?.slice(0, 5) ?? null,
  };
}

export async function updateSettings(request: UpdateSettingsRequest): Promise<void> {
  const errors: FieldErrors = validateSettings(request);
  if (request.reminderTime !== null && !HH_MM.test(request.reminderTime)) {
    errors.reminderTime = ['Reminder time must be HH:MM (24-hour).'];
  }
  if (!isValid(errors)) throw ApiError.validation(errors);

  const me = await currentUserId();
  unwrap(
    await supabase
      .from('user_settings')
      .update({
        goal_weight_kg:
          request.goalWeight === null ? null : roundKg(toKg(request.goalWeight, request.unit)),
        unit: request.unit,
        reminder_time: request.reminderTime,
      })
      .eq('user_id', me),
  );
}

export async function updateDisplayName(name: string): Promise<void> {
  const errors = validateDisplayName(name);
  if (!isValid(errors)) throw ApiError.validation(errors);

  const me = await currentUserId();
  unwrap(await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', me));
}
