-- Leaderboard v2
--   * Period: 'week' (last 7 days), 'month' (last 30 days) or 'total' (since joining).
--   * Shows each member's current weight and the change in kg and %, as the
--     group decided weights are visible to group-mates. Weigh-in history itself
--     stays owner-only (RLS on weigh_ins is unchanged).
--   * Uses app.now() so tests can pin "today".

drop function public.group_leaderboard(uuid);

create function public.group_leaderboard(gid uuid, period text default 'total')
returns table (
  user_id           uuid,
  display_name      text,
  current_weight_kg numeric,  -- latest weigh-in; null if none yet
  change_kg         numeric,  -- negative = lost weight; null = not enough data
  pct_change        numeric,
  last_weighed_on   date,
  weigh_in_count    bigint    -- weigh-ins within the period
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  today date := app.now()::date;
begin
  if not public.is_group_member(gid) then
    raise exception 'not a member of this group';
  end if;
  if period not in ('week', 'month', 'total') then
    raise exception 'invalid period';
  end if;

  return query
  with members as (
    select
      m.user_id,
      p.display_name,
      case period
        when 'week'  then today - 7
        when 'month' then today - 30
        else m.joined_at::date
      end as cutoff
    from public.group_members m
    join public.profiles p on p.id = m.user_id
    where m.group_id = gid
  )
  select
    mb.user_id,
    mb.display_name,
    latest.weight_kg,
    case when base.measured_on < latest.measured_on
         then latest.weight_kg - base.weight_kg end,
    case when base.measured_on < latest.measured_on
         then round((latest.weight_kg - base.weight_kg) / base.weight_kg * 100, 1) end,
    latest.measured_on,
    (select count(*) from public.weigh_ins w
      where w.user_id = mb.user_id and w.measured_on > mb.cutoff)
  from members mb
  -- Baseline: the latest weigh-in on or before the cutoff, otherwise the
  -- earliest one after it.
  left join lateral (
    select w.weight_kg, w.measured_on
    from public.weigh_ins w
    where w.user_id = mb.user_id
    order by (w.measured_on <= mb.cutoff) desc,
             case when w.measured_on <= mb.cutoff then w.measured_on end desc nulls last,
             w.measured_on asc
    limit 1
  ) base on true
  left join lateral (
    select w.weight_kg, w.measured_on
    from public.weigh_ins w
    where w.user_id = mb.user_id
    order by w.measured_on desc
    limit 1
  ) latest on true
  order by 5 asc nulls last, 2;   -- most % lost first
end;
$$;

revoke execute on function public.group_leaderboard(uuid, text) from public, anon;
grant  execute on function public.group_leaderboard(uuid, text) to authenticated;

-- The daily reminder now lives on each phone, not in the database.
comment on column public.user_settings.reminder_time is
  'Unused since 2026-11-18: reminders are stored on the device.';
