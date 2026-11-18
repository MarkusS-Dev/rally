import type { GroupRow, LeaderboardRow } from '../database.types';
import { supabase } from '../supabase';
import { isValid, normalizeInviteCode, validateGroupName, validateInviteCode } from '../validation';
import { ApiError, unwrap } from './errors';
import { currentUserId } from './session';
import type { Group, GroupMember, LeaderboardEntry, LeaderboardPeriod } from './types';

type GroupFields = Pick<GroupRow, 'id' | 'name' | 'invite_code' | 'created_by'>;

function toGroup(row: GroupFields, me: string): Group {
  return { id: row.id, name: row.name, inviteCode: row.invite_code, isOwner: row.created_by === me };
}

/** Groups you belong to (RLS only returns those). */
export async function listMyGroups(): Promise<Group[]> {
  const me = await currentUserId();
  const rows = unwrap<GroupFields[]>(
    await supabase.from('groups').select('id, name, invite_code, created_by').order('name'),
  );
  return rows.map((r) => toGroup(r, me));
}

export async function createGroup(name: string): Promise<Group> {
  const errors = validateGroupName(name);
  if (!isValid(errors)) throw ApiError.validation(errors);

  const me = await currentUserId();
  const row = unwrap<GroupFields>(await supabase.rpc('create_group', { group_name: name.trim() }));
  return toGroup(row, me);
}

export async function joinGroup(inviteCode: string): Promise<Group> {
  const errors = validateInviteCode(inviteCode);
  if (!isValid(errors)) throw ApiError.validation(errors);

  const me = await currentUserId();
  const row = unwrap<GroupFields>(
    await supabase.rpc('join_group', { code: normalizeInviteCode(inviteCode) }),
  );
  return toGroup(row, me);
}

export async function leaveGroup(groupId: string): Promise<void> {
  const me = await currentUserId();
  unwrap(await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', me));
}

/** Delete a group for everyone. Only its creator may do this (enforced by RLS). */
export async function deleteGroup(groupId: string): Promise<void> {
  const { data, error } = await supabase.from('groups').delete().eq('id', groupId).select('id');
  if (unwrap<{ id: string }[]>({ data, error }).length === 0) {
    throw new ApiError('Only the person who created the group can delete it.', 'not-found');
  }
}

/** Members of a group: the sub-resource, like the course's /employees/{id}/benefits. */
export async function listGroupMembers(groupId: string): Promise<GroupMember[]> {
  // Many-to-one embeds arrive as one object; untyped supabase-js claims an array. Accept both.
  type Profile = { display_name: string };
  type Row = { user_id: string; joined_at: string; profiles: Profile | Profile[] | null };
  const rows = unwrap<Row[]>(
    await supabase
      .from('group_members')
      .select('user_id, joined_at, profiles(display_name)')
      .eq('group_id', groupId)
      .order('joined_at'),
  );
  return rows.map((r) => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return { userId: r.user_id, displayName: profile?.display_name ?? 'Unknown', joinedAt: r.joined_at };
  });
}

/** Each member's current weight and change over the period, most % lost first. */
export async function getLeaderboard(
  groupId: string,
  period: LeaderboardPeriod = 'total',
): Promise<LeaderboardEntry[]> {
  const me = await currentUserId();
  const rows = unwrap<LeaderboardRow[]>(
    await supabase.rpc('group_leaderboard', { gid: groupId, period }),
  );
  const num = (v: number | string | null) => (v === null ? null : Number(v));
  return rows.map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    currentWeightKg: num(r.current_weight_kg),
    changeKg: num(r.change_kg),
    pctChange: num(r.pct_change),
    lastWeighedOn: r.last_weighed_on,
    weighInCount: Number(r.weigh_in_count),
    isMe: r.user_id === me,
  }));
}
