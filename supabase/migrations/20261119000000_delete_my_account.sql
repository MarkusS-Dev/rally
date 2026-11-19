-- Delete your own account (Google Play requires in-app account deletion).
--
-- Removes the auth user; everything else follows by ON DELETE CASCADE:
-- profile, settings, weigh-ins and group memberships.
--
-- Groups you own would cascade too (groups.created_by is the owner), so
-- first hand each one to the member who joined earliest. A group only
-- disappears if you were its last member.

-- The audit trigger keeps created_by immutable. Allow one exception: an
-- ownership hand-over, flagged for the current transaction only by
-- delete_my_account() below (clients can't set this themselves).
create or replace function app.set_audit_fields()
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
    -- Creation fields are immutable, except a group owner hand-over.
    new.created_at := old.created_at;
    if not (tg_table_name = 'groups' and coalesce(current_setting('app.transfer_owner', true), '') = 'on') then
      new.created_by := old.created_by;
    end if;
    new.last_modified_at := app.now();
    new.last_modified_by := auth.uid();
  end if;
  return new;
end;
$$;

create function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;

  perform set_config('app.transfer_owner', 'on', true);
  update public.groups g
  set created_by = (
    select m.user_id
    from public.group_members m
    where m.group_id = g.id and m.user_id <> me
    order by m.joined_at, m.user_id
    limit 1
  )
  where g.created_by = me
    and exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id <> me);
  perform set_config('app.transfer_owner', 'off', true);

  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant  execute on function public.delete_my_account() to authenticated;
