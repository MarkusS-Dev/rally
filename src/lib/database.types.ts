// Row shapes of the Supabase tables, mirroring supabase/migrations.
//
// Hand-written for now. Once the Supabase project exists, replace this file with
// generated types:  npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
// (the Supabase equivalent of the course's Swagger/OpenAPI docs).

type Audit = {
  created_at: string;
  created_by: string | null;
  last_modified_at: string | null;
  last_modified_by: string | null;
};

export type ProfileRow = Audit & {
  id: string;
  display_name: string;
};

export type UserSettingsRow = Audit & {
  user_id: string;
  goal_weight_kg: number | null;
  unit: 'kg' | 'lb';
  reminder_time: string | null; // "HH:MM:SS"
};

export type WeighInRow = Audit & {
  id: number;
  user_id: string;
  weight_kg: number;
  measured_on: string; // "YYYY-MM-DD"
};

export type GroupRow = Omit<Audit, 'created_by'> & {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
};

export type GroupMemberRow = {
  group_id: string;
  user_id: string;
  joined_at: string;
};

export type LeaderboardRow = {
  user_id: string;
  display_name: string;
  pct_change: number | null;
  last_weighed_on: string | null;
  weigh_in_count: number;
};
