-- Lifetime XP remains cumulative. Levels are derived from these thresholds;
-- the client displays only progress within the current level.
create or replace function private.level_for_xp(total_xp bigint)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when total_xp >= 5200 then 10
    when total_xp >= 4000 then 9
    when total_xp >= 3000 then 8
    when total_xp >= 2200 then 7
    when total_xp >= 1500 then 6
    when total_xp >= 1000 then 5
    when total_xp >= 600 then 4
    when total_xp >= 300 then 3
    when total_xp >= 100 then 2
    else 1
  end;
$$;

revoke all on function private.level_for_xp(bigint) from public, anon, authenticated;

update public.profiles
set level = private.level_for_xp(xp),
    updated_at = now()
where level <> private.level_for_xp(xp);
