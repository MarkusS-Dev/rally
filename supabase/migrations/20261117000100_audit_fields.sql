-- Audit fields, modelled on the course's AuditableEntity
-- (CreatedBy / CreatedOn / LastModifiedBy / LastModifiedOn).
--
-- The course fills these in DbContext.SaveChanges(). Here, triggers do the
-- same job in the database, so no client can skip or forge them. As in the
-- course, the clock is injectable: the trigger reads app.now() rather than
-- now(), so tests can pin the time (see supabase/tests).

-- ---------------------------------------------------------------------------
-- Injectable clock (the course's ISystemClock / TestSystemClock)
-- ---------------------------------------------------------------------------

create schema if not exists app;

-- now(), unless a test has pinned the time with:
--   set local app.fixed_now = '2022-01-01T00:00:00Z';
create function app.now()
returns timestamptz
language sql stable
as $$
  select coalesce(nullif(current_setting('app.fixed_now', true), '')::timestamptz, now());
$$;

grant usage on schema app to authenticated;

-- ---------------------------------------------------------------------------
-- Columns: every audited table gets the same four
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column created_by       uuid,
  add column last_modified_by uuid,
  add column last_modified_at timestamptz;

alter table public.user_settings
  add column created_by       uuid,
  add column created_at       timestamptz not null default now(),
  add column last_modified_by uuid,
  add column last_modified_at timestamptz;
alter table public.user_settings drop column updated_at;  -- superseded by last_modified_at

alter table public.weigh_ins
  add column created_by       uuid,
  add column last_modified_by uuid,
  add column last_modified_at timestamptz;

-- groups.created_by already exists (it is the owner).
alter table public.groups
  add column last_modified_by uuid,
  add column last_modified_at timestamptz;

-- Backfill before the triggers exist, or they would undo it.
update public.profiles      set created_by = id      where created_by is null;
update public.user_settings set created_by = user_id where created_by is null;
update public.weigh_ins     set created_by = user_id where created_by is null;

-- ---------------------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------------------

create function app.set_audit_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at       := app.now();
    -- auth.uid() is null inside the sign-up trigger; keep what it passed.
    new.created_by       := coalesce(auth.uid(), new.created_by);
    new.last_modified_at := null;
    new.last_modified_by := null;
  else
    -- Creation fields are immutable.
    new.created_at       := old.created_at;
    new.created_by       := old.created_by;
    new.last_modified_at := app.now();
    new.last_modified_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger audit before insert or update on public.profiles
  for each row execute function app.set_audit_fields();
create trigger audit before insert or update on public.user_settings
  for each row execute function app.set_audit_fields();
create trigger audit before insert or update on public.weigh_ins
  for each row execute function app.set_audit_fields();
create trigger audit before insert or update on public.groups
  for each row execute function app.set_audit_fields();

-- Sign-up runs with no auth.uid(), so pass the new user's id explicitly.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, created_by)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
             nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
             'Friend'),
    new.id
  );
  insert into public.user_settings (user_id, created_by) values (new.id, new.id);
  return new;
end;
$$;
