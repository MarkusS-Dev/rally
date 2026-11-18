-- Group rankings (current + records) and the group chart data.
--
-- The group decided weights are visible to group-mates, so these functions
-- return members' weigh-ins/changes to other members of the same group.
-- RLS on weigh_ins itself is unchanged: outside these functions you still
-- only see your own rows.

-- ---------------------------------------------------------------------------
-- Weigh-ins of everyone in a group (for the multi-line chart)
-- ---------------------------------------------------------------------------
create function public.group_weigh_ins(gid uuid, since date default null)
returns table (user_id uuid, measured_on date, weight_kg numeric)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_group_member(gid) then
    raise exception 'not a member of this group';
  end if;

  return query
  select w.user_id, w.measured_on, w.weight_kg
  from public.weigh_ins w
  join public.group_members m on m.user_id = w.user_id and m.group_id = gid
  where since is null or w.measured_on >= since
  order by w.user_id, w.measured_on;
end;
$$;

-- ---------------------------------------------------------------------------
-- All rankings in one call
--
-- category:
--   'day' | 'week' | 'month' | 'total'   change up to the latest weigh-in, from
--                                        the baseline at today-1 / -7 / -30 /
--                                        first weigh-in (ranked_by = 'both')
--   'best_day' | 'best_week' | 'best_month'
--                                        biggest drop ever between two weigh-ins
--                                        at most 1 / 7 / 30 days apart, one row
--                                        per person per metric (ranked_by =
--                                        'kg' or 'pct'; losses only)
-- ---------------------------------------------------------------------------
create function public.group_rankings(gid uuid)
returns table (
  category          text,
  ranked_by         text,
  user_id           uuid,
  display_name      text,
  current_weight_kg numeric,
  change_kg         numeric,
  pct_change        numeric,
  from_date         date,
  to_date           date
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  today date := app.now()::date;
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
  latest as (
    select distinct on (w.user_id) w.user_id, w.weight_kg, w.measured_on
    from public.weigh_ins w
    join members mb on mb.user_id = w.user_id
    order by w.user_id, w.measured_on desc
  ),
  periods (category, cutoff) as (
    values ('day'::text, today - 1), ('week', today - 7), ('month', today - 30), ('total', '-infinity'::date)
  ),
  current_changes as (
    select pr.category, mb.user_id, mb.display_name, l.weight_kg as now_kg, l.measured_on as to_date,
           base.weight_kg as base_kg, base.measured_on as from_date
    from members mb
    cross join periods pr
    join latest l on l.user_id = mb.user_id
    -- Baseline: latest weigh-in on/before the cutoff, else the earliest after it.
    join lateral (
      select w.weight_kg, w.measured_on
      from public.weigh_ins w
      where w.user_id = mb.user_id
      order by (w.measured_on <= pr.cutoff) desc,
               case when w.measured_on <= pr.cutoff then w.measured_on end desc nulls last,
               w.measured_on asc
      limit 1
    ) base on true
    where base.measured_on < l.measured_on
  ),
  pairs as (
    select a.user_id, a.measured_on as from_date, b.measured_on as to_date,
           a.weight_kg as base_kg, b.weight_kg as now_kg, b.measured_on - a.measured_on as gap
    from public.weigh_ins a
    join public.weigh_ins b
      on b.user_id = a.user_id
     and b.measured_on > a.measured_on
     and b.measured_on - a.measured_on <= 30
    where a.user_id in (select mb.user_id from members mb)
      and b.weight_kg < a.weight_kg           -- records are about losses
  ),
  record_windows (category, max_gap) as (
    values ('best_day'::text, 1), ('best_week', 7), ('best_month', 30)
  ),
  record_candidates as (
    select rw.category, p.*
    from record_windows rw
    join pairs p on p.gap <= rw.max_gap
  ),
  best_kg as (
    select distinct on (rc.category, rc.user_id) rc.*
    from record_candidates rc
    order by rc.category, rc.user_id, (rc.now_kg - rc.base_kg) asc, rc.to_date desc
  ),
  best_pct as (
    select distinct on (rc.category, rc.user_id) rc.*
    from record_candidates rc
    order by rc.category, rc.user_id, (rc.now_kg - rc.base_kg) / rc.base_kg asc, rc.to_date desc
  )
  select cc.category, 'both'::text, cc.user_id, cc.display_name, cc.now_kg,
         cc.now_kg - cc.base_kg, round((cc.now_kg - cc.base_kg) / cc.base_kg * 100, 1),
         cc.from_date, cc.to_date
  from current_changes cc
  union all
  select r.category, r.ranked_by, r.user_id, mb.display_name, l.weight_kg,
         r.now_kg - r.base_kg, round((r.now_kg - r.base_kg) / r.base_kg * 100, 1),
         r.from_date, r.to_date
  from (
    select bk.*, 'kg'::text as ranked_by from best_kg bk
    union all
    select bp.*, 'pct'::text from best_pct bp
  ) r
  join members mb on mb.user_id = r.user_id
  left join latest l on l.user_id = r.user_id;
end;
$$;

revoke execute on function public.group_weigh_ins(uuid, date) from public, anon;
revoke execute on function public.group_rankings(uuid)        from public, anon;
grant  execute on function public.group_weigh_ins(uuid, date) to authenticated;
grant  execute on function public.group_rankings(uuid)        to authenticated;
