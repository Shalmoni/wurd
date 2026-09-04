create or replace function private.handle_daily_word_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set streak_days = case
        when last_word_date = new.local_date - 1 then streak_days + 1
        when last_word_date = new.local_date then streak_days
        else 1
      end,
      longest_streak = greatest(
        longest_streak,
        case
          when last_word_date = new.local_date - 1 then streak_days + 1
          when last_word_date = new.local_date then streak_days
          else 1
        end
      ),
      last_word_date = new.local_date,
      updated_at = now()
  where id = new.user_id;

  perform private.award_xp(new.user_id, 'daily_word', 5, new.id::text);
  return new;
end;
$$;

update public.xp_events
set points = 5
where kind = 'daily_word'::public.xp_event_kind;

with totals as (
  select profile.id, coalesce(sum(event.points), 0)::bigint as xp
  from public.profiles profile
  left join public.xp_events event on event.user_id = profile.id
  group by profile.id
)
update public.profiles profile
set xp = totals.xp,
    level = private.level_for_xp(totals.xp),
    updated_at = now()
from totals
where profile.id = totals.id;
