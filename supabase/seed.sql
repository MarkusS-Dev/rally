-- Development seed data (the course's SeedData.MigrateAndSeed).
-- Loaded automatically by `npx supabase db reset` against a LOCAL stack only.
-- Never run this against the hosted project.
--
-- Three friends in one group. Every account's password is: password123
--   alex@example.com  (group owner, losing weight)
--   sam@example.com   (gaining a little)
--   kim@example.com   (just joined, not enough data yet)

-- Accounts. handle_new_user() creates their profiles and settings.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('password123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', jsonb_build_object('display_name', u.name),
  now(), now(), '', '', '', ''
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'alex@example.com', 'Alex'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'sam@example.com',  'Sam'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'kim@example.com',  'Kim')
) as u (id, email, name);

-- Email identities, needed for password sign-in.
insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
from auth.users u
where u.email in ('alex@example.com', 'sam@example.com', 'kim@example.com');

update public.user_settings set goal_weight_kg = 78, unit = 'kg'
  where user_id = '11111111-1111-1111-1111-111111111111';
update public.user_settings set unit = 'lb'
  where user_id = '22222222-2222-2222-2222-222222222222';

-- 60 days of history for Alex (85 → ~81 kg, with daily noise) and Sam (70 → ~71 kg, every other day).
insert into public.weigh_ins (user_id, created_by, weight_kg, measured_on)
select '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
       round((85 - d * 0.07 + sin(d) * 0.4)::numeric, 2), current_date - (60 - d)
from generate_series(0, 60) as d;

insert into public.weigh_ins (user_id, created_by, weight_kg, measured_on)
select '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
       round((70 + d * 0.02 + cos(d) * 0.3)::numeric, 2), current_date - (60 - d)
from generate_series(0, 60, 2) as d;

insert into public.weigh_ins (user_id, created_by, weight_kg, measured_on)
values ('33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 92.3, current_date);

-- The group, with a fixed invite code so it's easy to type while testing.
insert into public.groups (id, name, invite_code, created_by)
values ('44444444-4444-4444-4444-444444444444', 'Gym Buddies', 'C0FFEE42', '11111111-1111-1111-1111-111111111111');

insert into public.group_members (group_id, user_id, joined_at) values
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', now() - interval '60 days'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', now() - interval '60 days'),
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', now());
