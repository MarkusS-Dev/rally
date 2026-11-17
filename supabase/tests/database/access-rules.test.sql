-- Database tests (the course's integration tests, but for the access rules).
-- Run against a local stack:  npx supabase start && npx supabase test db
-- Each test file runs in a transaction that is rolled back afterwards.

begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Pin the clock, like the course's TestSystemClock.
set local app.fixed_now = '2022-01-01T00:00:00Z';

-- ---------------------------------------------------------------------------
-- Fixtures (as the superuser, bypassing RLS)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'ann@test.dev', '{"display_name":"Ann"}'),
  ('b0000000-0000-0000-0000-000000000002', 'ben@test.dev', '{"display_name":"Ben"}'),
  ('c0000000-0000-0000-0000-000000000003', 'cal@test.dev', '{}');

insert into public.weigh_ins (user_id, weight_kg, measured_on) values
  ('a0000000-0000-0000-0000-000000000001', 100, '2021-12-01'),
  ('a0000000-0000-0000-0000-000000000001',  95, '2021-12-31'),
  ('b0000000-0000-0000-0000-000000000002',  60, '2021-12-01');

insert into public.groups (id, name, invite_code, created_by)
  values ('d0000000-0000-0000-0000-000000000004', 'Test group', 'ABCDEF12', 'a0000000-0000-0000-0000-000000000001');
insert into public.group_members (group_id, user_id, joined_at) values
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', '2021-12-01'),
  ('d0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', '2021-12-01');

select is(
  (select display_name from public.profiles where id = 'c0000000-0000-0000-0000-000000000003'),
  'cal', 'sign-up falls back to the email name when no display_name is given');

-- ---------------------------------------------------------------------------
-- As Ann
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is((select count(*)::int from public.weigh_ins), 2,
  'Ann only sees her own weigh-ins, not Ben''s');

select is((select count(*)::int from public.user_settings), 1,
  'Ann only sees her own settings');

select is((select count(*)::int from public.profiles), 2,
  'Ann sees her own and her group-mate''s profile, not Cal''s');

select is(
  (select pct_change from public.group_leaderboard('d0000000-0000-0000-0000-000000000004')
    where user_id = 'a0000000-0000-0000-0000-000000000001'),
  -5.0::numeric, 'leaderboard shows Ann''s % change (100 → 95 kg = -5.0%)');

select is(
  (select pct_change from public.group_leaderboard('d0000000-0000-0000-0000-000000000004')
    where user_id = 'b0000000-0000-0000-0000-000000000002'),
  null, 'one weigh-in is not enough for a % change');

select is(
  (select array_to_string(proargnames, ',') from pg_proc
    where oid = 'public.group_leaderboard(uuid)'::regprocedure),
  'gid,user_id,display_name,pct_change,last_weighed_on,weigh_in_count',
  'leaderboard returns exactly these columns, and no raw weights');

-- Audit fields: set by the trigger from the pinned clock and the JWT.
insert into public.weigh_ins (weight_kg, measured_on) values (94, '2022-01-01');
select results_eq(
  $$select created_at, created_by from public.weigh_ins where measured_on = '2022-01-01'$$,
  $$values ('2022-01-01T00:00:00Z'::timestamptz, 'a0000000-0000-0000-0000-000000000001'::uuid)$$,
  'insert sets created_at from the clock and created_by from the signed-in user');

update public.weigh_ins set weight_kg = 93.5, created_by = 'b0000000-0000-0000-0000-000000000002'
  where measured_on = '2022-01-01';
select results_eq(
  $$select created_by, last_modified_by, last_modified_at from public.weigh_ins where measured_on = '2022-01-01'$$,
  $$values ('a0000000-0000-0000-0000-000000000001'::uuid,
            'a0000000-0000-0000-0000-000000000001'::uuid,
            '2022-01-01T00:00:00Z'::timestamptz)$$,
  'update sets last_modified_* and created_by cannot be rewritten');

select throws_ok(
  $$insert into public.weigh_ins (user_id, weight_kg) values ('b0000000-0000-0000-0000-000000000002', 50)$$,
  '42501', null, 'Ann cannot log a weigh-in as Ben');

select throws_ok(
  $$insert into public.weigh_ins (weight_kg, measured_on) values (90, '2022-01-01')$$,
  '23505', null, 'one weigh-in per day');

-- ---------------------------------------------------------------------------
-- As Cal (not in the group)
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000003","role":"authenticated"}';

select throws_ok(
  $$select * from public.group_leaderboard('d0000000-0000-0000-0000-000000000004')$$,
  'P0001', 'not a member of this group', 'non-members cannot read the leaderboard');

select is((select count(*)::int from public.groups), 0, 'non-members cannot see the group');

select is((public.join_group(' abcdef12 ')).name, 'Test group',
  'joining by invite code works (trimmed, case-insensitive)');

select * from finish();
rollback;
