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

  -- Every unique received echo is worth 4 base XP. Giving an echo awards no XP.
  perform private.award_xp(word_owner, 'echo_received', 4, unique_source);
  return new;
end;
$$;

create or replace function private.award_friendship_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'accepted'::public.friendship_status then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'accepted'::public.friendship_status then
    return new;
  end if;

  perform private.award_xp(
    new.requester_id,
    'friend_match'::public.xp_event_kind,
    5,
    'friendship:' || new.id::text
  );
  perform private.award_xp(
    new.addressee_id,
    'friend_match'::public.xp_event_kind,
    5,
    'friendship:' || new.id::text
  );
  return new;
end;
$$;

update public.xp_events
set points = case
  when kind = 'echo_received'::public.xp_event_kind then 4
  when kind = 'friend_match'::public.xp_event_kind then 5
  else points
end
where kind in (
  'echo_received'::public.xp_event_kind,
  'friend_match'::public.xp_event_kind
);

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

create or replace function public.feed_words(
  p_date date,
  p_limit integer default 8,
  p_friends_only boolean default false
) returns table (
  id bigint,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  city text,
  country_code text,
  word text,
  emoji text,
  color public.word_color,
  word_style text,
  local_date date,
  created_at timestamptz,
  echo_count bigint,
  spoke_count bigint,
  echoed_by_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    daily.id,
    daily.user_id,
    profile.username,
    profile.display_name,
    profile.avatar_url,
    daily.city,
    daily.country_code,
    daily.word,
    daily.emoji,
    daily.color,
    daily.word_style,
    daily.local_date,
    daily.created_at,
    count(echo.id) as echo_count,
    (
      select count(distinct recent.user_id)
      from public.daily_words recent
      where recent.created_at > now() - interval '24 hours'
        and recent.created_at <= now()
        and (
          not p_friends_only
          or recent.user_id = (select auth.uid())
          or exists (
            select 1 from public.friendships recent_friendship
            where recent_friendship.status = 'accepted'
              and (
                (recent_friendship.requester_id = (select auth.uid()) and recent_friendship.addressee_id = recent.user_id)
                or (recent_friendship.addressee_id = (select auth.uid()) and recent_friendship.requester_id = recent.user_id)
              )
          )
        )
    ) as spoke_count,
    bool_or(echo.user_id = (select auth.uid())) as echoed_by_me
  from public.daily_words daily
  join public.profiles profile on profile.id = daily.user_id
  left join public.echoes echo on echo.daily_word_id = daily.id
  where (select auth.uid()) is not null
    and daily.created_at > now() - interval '24 hours'
    and daily.created_at <= now()
    and (
      not p_friends_only
      or daily.user_id = (select auth.uid())
      or exists (
        select 1 from public.friendships friendship
        where friendship.status = 'accepted'
          and (
            (friendship.requester_id = (select auth.uid()) and friendship.addressee_id = daily.user_id)
            or (friendship.addressee_id = (select auth.uid()) and friendship.requester_id = daily.user_id)
          )
      )
    )
  group by daily.id, profile.id
  order by count(echo.id) desc, daily.created_at desc
  limit least(greatest(p_limit, 1), 500);
$$;

revoke all on function public.feed_words(date, integer, boolean) from public, anon;
grant execute on function public.feed_words(date, integer, boolean) to authenticated;
