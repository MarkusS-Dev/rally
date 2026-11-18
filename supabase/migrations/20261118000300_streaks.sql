-- Weigh-in streaks: consecutive days with a weigh-in.
--
--   current_streak  the run ending today or yesterday (you have until the end
--                   of today to keep it going), else 0
--   best_streak     the longest run ever, with its dates
--
-- `today` is the caller's local date (the server runs on UTC); it only
-- affects what counts as "still going".

create function public.group_streaks(gid uuid, today date default null)
returns table (
  user_id        uuid,
  display_name   text,
  current_streak int,
  best_streak    int,
  best_from      date,
  best_to        date
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  d date := coalesce(today, app.now()::date);
begin
  if not public.is_group_member(gid) then
    raise exception 'not a member of this group';
  end if;

  return query
  with members as (
    select m.user_id, p.display_name
    from public.group_members m
    join public.profiles p on p.id = m.user_id
    where m.group_id = gid
  ),
  -- Gaps and islands: consecutive dates share (date - row_number).
  runs as (
    select x.user_id, min(x.measured_on) as start_on, max(x.measured_on) as end_on, count(*)::int as len
    from (
      select w.user_id, w.measured_on,
             w.measured_on - (row_number() over (partition by w.user_id order by w.measured_on))::int as island
      from public.weigh_ins w
      join members mb on mb.user_id = w.user_id
      where w.measured_on <= d
    ) x
    group by x.user_id, x.island
  ),
  best as (
    select distinct on (r.user_id) r.user_id, r.len, r.start_on, r.end_on
    from runs r
    order by r.user_id, r.len desc, r.end_on desc
  ),
  cur as (
    select r.user_id, r.len
    from runs r
    where r.end_on >= d - 1
  )
  select mb.user_id, mb.display_name,
         coalesce(c.len, 0), coalesce(b.len, 0), b.start_on, b.end_on
  from members mb
  left join cur c on c.user_id = mb.user_id
  left join best b on b.user_id = mb.user_id;
end;
$$;

create function public.my_streak(today date default null)
returns table (current_streak int, best_streak int, best_from date, best_to date)
language sql stable security definer set search_path = ''
as $$
  with runs as (
    select min(x.measured_on) as start_on, max(x.measured_on) as end_on, count(*)::int as len
    from (
      select w.measured_on,
             w.measured_on - (row_number() over (order by w.measured_on))::int as island
      from public.weigh_ins w
      where w.user_id = auth.uid()
        and w.measured_on <= coalesce(today, app.now()::date)
    ) x
    group by x.island
  )
  select
    coalesce((select r.len from runs r where r.end_on >= coalesce(today, app.now()::date) - 1), 0),
    coalesce((select max(r.len) from runs r), 0),
    (select r.start_on from runs r order by r.len desc, r.end_on desc limit 1),
    (select r.end_on from runs r order by r.len desc, r.end_on desc limit 1);
$$;

revoke execute on function public.group_streaks(uuid, date) from public, anon;
revoke execute on function public.my_streak(date) from public, anon;
grant execute on function public.group_streaks(uuid, date) to authenticated;
grant execute on function public.my_streak(date) to authenticated;
