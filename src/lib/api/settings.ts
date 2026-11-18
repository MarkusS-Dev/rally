import type { ProfileRow, UserSettingsRow } from '../database.types';
import { supabase } from '../supabase';
import { roundKg, toKg } from '../units';
import { isValid, validateDisplayName, validateSettings, type FieldErrors } from '../validation';
import { ApiError, unwrap } from './errors';
import { currentUserId } from './session';
import type { MySettings, UpdateSettingsRequest } from './types';

export async function getMySettings(): Promise<MySettings> {
  const me = await currentUserId();
  const [profile, settings] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', me).single(),
    supabase.from('user_settings').select('goal_weight_kg, unit').eq('user_id', me).single(),
  ]);
  const p = unwrap<Pick<ProfileRow, 'display_name'>>(profile);
  const s = unwrap<Pick<UserSettingsRow, 'goal_weight_kg' | 'unit'>>(settings);

  return {
    displayName: p.display_name,
    goalWeightKg: s.goal_weight_kg === null ? null : Number(s.goal_weight_kg),
    unit: s.unit,
  };
}

export async function updateSettings(request: UpdateSettingsRequest): Promise<void> {
  const errors: FieldErrors = validateSettings(request);
  if (!isValid(errors)) throw ApiError.validation(errors);

  const me = await currentUserId();
  unwrap(
    await supabase
      .from('user_settings')
      .update({
        goal_weight_kg:
          request.goalWeight === null ? null : roundKg(toKg(request.goalWeight, request.unit)),
        unit: request.unit,
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
