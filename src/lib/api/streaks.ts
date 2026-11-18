import { supabase } from '../supabase';
import { localToday } from '../validation';
import { unwrap } from './errors';
import { currentUserId } from './session';
import type { GroupStreak, Streak, StreakEntry } from './types';

type StreakRow = {
  current_streak: number;
  best_streak: number;
  best_from: string | null;
  best_to: string | null;
};

function toStreak(r: StreakRow | undefined): Streak {
  return {
    current: r?.current_streak ?? 0,
    best: r?.best_streak ?? 0,
    bestFrom: r?.best_from ?? null,
    bestTo: r?.best_to ?? null,
  };
}

/** My current and best streak. Uses this phone's date for "today". */
export async function getMyStreak(): Promise<Streak> {
  const rows = unwrap<StreakRow[]>(await supabase.rpc('my_streak', { today: localToday() }));
  return toStreak(rows[0]);
}

/** Every group member's current and best streak. */
export async function getGroupStreaks(groupId: string): Promise<StreakEntry[]> {
  type Row = StreakRow & { user_id: string; display_name: string };
  const me = await currentUserId();
  const rows = unwrap<Row[]>(await supabase.rpc('group_streaks', { gid: groupId, today: localToday() }));
  return rows.map((r) => ({
    ...toStreak(r),
    userId: r.user_id,
    displayName: r.display_name,
    isMe: r.user_id === me,
  }));
}

/** The group's collective streak, and who hasn't weighed in today. */
export async function getGroupStreak(groupId: string): Promise<GroupStreak> {
  type Row = StreakRow & { missing_today: string[] | null };
  const rows = unwrap<Row[]>(await supabase.rpc('group_collective_streak', { gid: groupId, today: localToday() }));
  return { ...toStreak(rows[0]), missingToday: rows[0]?.missing_today ?? [] };
}
