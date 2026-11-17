-- Weight tracker: initial schema
--
-- Privacy model
--   * weigh_ins and user_settings (goal, unit) are visible ONLY to their owner.
--   * Group-mates can see each other's display name and, through
--     group_leaderboard(), a % change. They never see actual weights.
--   * Groups are joined with an invite code through join_group(); a group's
--     rows are invisible to non-members.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Public-ish profile: only what group-mates are allowed to see.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at   timestamptz not null default now()
);

-- Private per-user settings.
create table public.user_settings (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  goal_weight_kg numeric(5, 2) check (goal_weight_kg > 0 and goal_weight_kg < 700),
  unit           text not null default 'kg' check (unit in ('kg', 'lb')),
  reminder_time  time,            -- local time for the daily reminder; null = off
  updated_at     timestamptz not null default now()
);

-- One weigh-in per user per day; weights are always stored in kg.
create table public.weigh_ins (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  weight_kg   numeric(5, 2) not null check (weight_kg > 0 and weight_kg < 700),
  measured_on date not null default current_date,
  created_at  timestamptz not null default now(),
  unique (user_id, measured_on)
);

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  created_by  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.group_members (
  group_id  uuid not null references public.groups (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER so RLS policies on group_members can call it without
-- recursing into group_members' own policies.
create function public.is_group_member(gid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create function public.shares_group_with(other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members me
    join public.group_members them on them.group_id = me.group_id
    where me.user_id = auth.uid() and them.user_id = other
  );
$$;

-- Create a profile + settings row whenever someone signs up.
-- The app passes display_name in the sign-up metadata.
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
             nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
             'Friend')
  );
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.user_settings enable row level security;
alter table public.weigh_ins     enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;

-- profiles: see yourself and anyone you share a group with; edit only yourself.
create policy "profiles: read self and group-mates" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_group_with(id));

create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- user_settings: owner only.
create policy "user_settings: owner read" on public.user_settings
  for select to authenticated using (user_id = auth.uid());

create policy "user_settings: owner update" on public.user_settings
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- weigh_ins: owner only, full CRUD.
create policy "weigh_ins: owner all" on public.weigh_ins
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- groups: members can read; creator can rename/delete.
-- Creating and joining go through the functions below.
create policy "groups: members read" on public.groups
  for select to authenticated using (public.is_group_member(id));

create policy "groups: creator update" on public.groups
  for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

create policy "groups: creator delete" on public.groups
  for delete to authenticated using (created_by = auth.uid());

-- group_members: see the members of your groups; leave a group yourself.
create policy "group_members: members read" on public.group_members
  for select to authenticated using (public.is_group_member(group_id));

create policy "group_members: leave" on public.group_members
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPC functions (called from the app with supabase.rpc(...))
-- ---------------------------------------------------------------------------

create function public.create_group(group_name text)
returns public.groups
language plpgsql security definer set search_path = ''
as $$
declare
  g public.groups;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.groups (name, created_by)
  values (group_name, auth.uid())
  returning * into g;

  insert into public.group_members (group_id, user_id) values (g.id, auth.uid());
  return g;
end;
$$;

create function public.join_group(code text)
returns public.groups
language plpgsql security definer set search_path = ''
as $$
declare
  g public.groups;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into g from public.groups where invite_code = upper(trim(code));
  if not found then
    raise exception 'invalid invite code';
  end if;

  insert into public.group_members (group_id, user_id)
  values (g.id, auth.uid())
  on conflict do nothing;
  return g;
end;
$$;

-- Leaderboard for a group: % change per member since they joined.
-- Baseline = latest weigh-in on or before the join date, falling back to the
-- first weigh-in after it. Raw weights never leave this function.
create function public.group_leaderboard(gid uuid)
returns table (
  user_id         uuid,
  display_name    text,
  pct_change      numeric,   -- negative = lost weight; null = not enough data
  last_weighed_on date,
  weigh_in_count  bigint     -- weigh-ins since joining, for "consistency"
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_group_member(gid) then
    raise exception 'not a member of this group';
  end if;

  return query
  select
    m.user_id,
    p.display_name,
    case
      when base.weight_kg is null or latest.weight_kg is null
           or latest.measured_on <= base.measured_on then null
      else round((latest.weight_kg - base.weight_kg) / base.weight_kg * 100, 1)
    end,
    latest.measured_on,
    (select count(*) from public.weigh_ins w
      where w.user_id = m.user_id and w.measured_on >= m.joined_at::date)
  from public.group_members m
  join public.profiles p on p.id = m.user_id
  left join lateral (
    select w.weight_kg, w.measured_on
    from public.weigh_ins w
    where w.user_id = m.user_id
    order by (w.measured_on <= m.joined_at::date) desc,   -- before/at join first
             case when w.measured_on <= m.joined_at::date
                  then w.measured_on end desc nulls last, -- …latest of those
             w.measured_on asc                            -- else earliest after
    limit 1
  ) base on true
  left join lateral (
    select w.weight_kg, w.measured_on
    from public.weigh_ins w
    where w.user_id = m.user_id
    order by w.measured_on desc
    limit 1
  ) latest on true
  where m.group_id = gid
  order by 3 asc nulls last, 2;
end;
$$;

-- Only signed-in users may call the RPCs.
revoke execute on function public.create_group(text)     from public, anon;
revoke execute on function public.join_group(text)       from public, anon;
revoke execute on function public.group_leaderboard(uuid) from public, anon;
grant  execute on function public.create_group(text)     to authenticated;
grant  execute on function public.join_group(text)       to authenticated;
grant  execute on function public.group_leaderboard(uuid) to authenticated;
