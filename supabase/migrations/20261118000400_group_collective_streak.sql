-- Collective streak: days in a row on which everyone in the group weighed in.
--
-- A member counts from the day they joined or their first weigh-in, whichever
-- is earlier, so a new member doesn't wipe out the group's history.
-- current_streak: the run ending today or yesterday (today isn't over yet).
-- missing_today:  members who haven't weighed in on `today` (caller's local date).

create function public.group_collective_streak(gid uuid, today date default null)
returns table (
  current_streak int,
  best_streak    int,
  best_from      date,
  best_to        date,
  missing_today  uuid[]
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  d date := coalesce(today, app.now()::date);
begin
  if not public.is_group_member(gid) then
    raise exception 'not a member of this group';
  end if;

  return query
  with members as (
    select m.user_id, m.joined_at::date as joined_on
    from public.group_members m
    where m.group_id = gid
  ),
  w as (
    select wi.user_id, wi.measured_on
    from public.weigh_ins wi
    join members mb on mb.user_id = wi.user_id
    where wi.measured_on <= d
  ),
  starts as (
    select mb.user_id,
           least(mb.joined_on, (select min(x.measured_on) from w x where x.user_id = mb.user_id)) as from_day
    from members mb
  ),
  days as (
    select g::date as day
    from generate_series((select min(s.from_day) from starts s), d, interval '1 day') g
  ),
  complete as (
    select dy.day
    from days dy
    where not exists (
      select 1 from starts s
      where s.from_day <= dy.day
        and not exists (select 1 from w x where x.user_id = s.user_id and x.measured_on = dy.day)
    )
  ),
  runs as (
    select min(c.day) as start_on, max(c.day) as end_on, count(*)::int as len
    from (select cd.day, cd.day - (row_number() over (order by cd.day))::int as island from complete cd) c
    group by c.island
  )
  select
    coalesce((select r.len from runs r where r.end_on >= d - 1), 0),
    coalesce((select max(r.len) from runs r), 0),
    (select r.start_on from runs r order by r.len desc, r.end_on desc limit 1),
    (select r.end_on from runs r order by r.len desc, r.end_on desc limit 1),
    coalesce(
      (select array_agg(mb.user_id) from members mb
       where not exists (select 1 from w x where x.user_id = mb.user_id and x.measured_on = d)),
      '{}'::uuid[]
    );
end;
$$;

revoke execute on function public.group_collective_streak(uuid, date) from public, anon;
grant  execute on function public.group_collective_streak(uuid, date) to authenticated;
