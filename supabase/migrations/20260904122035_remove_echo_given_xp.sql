create or replace function private.handle_echo_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  word_owner uuid;
  unique_source text;
begin
  select user_id into word_owner from public.daily_words where id = new.daily_word_id;
  unique_source := new.daily_word_id::text || ':' || new.user_id::text;

  -- Every unique received echo is worth 8 base XP. Giving an echo awards no XP.
  perform private.award_xp(word_owner, 'echo_received', 8, unique_source);
  return new;
end;
$$;

with removed as (
  select user_id, sum(points)::bigint as points
  from public.xp_events
  where kind = 'echo_given'
  group by user_id
)
update public.profiles profile
set xp = greatest(0, profile.xp - removed.points),
    level = private.level_for_xp(greatest(0, profile.xp - removed.points)),
    updated_at = now()
from removed
where profile.id = removed.user_id;

delete from public.xp_events where kind = 'echo_given';
