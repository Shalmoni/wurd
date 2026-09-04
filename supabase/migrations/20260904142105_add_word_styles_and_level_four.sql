alter table public.daily_words
add column word_style text not null default 'bold'
check (word_style in ('bold', 'serif'));

create or replace function private.level_for_xp(total_xp bigint)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when total_xp >= 600 then 4
    when total_xp >= 300 then 3
    when total_xp >= 100 then 2
    else 1
  end;
$$;

update public.profiles
set level = private.level_for_xp(xp),
    updated_at = now()
where level <> private.level_for_xp(xp);

drop function public.post_daily_word(text, text, text, public.word_color, text, text);

create function public.post_daily_word(
  p_word text,
  p_timezone text,
  p_emoji text default null,
  p_color public.word_color default 'mint',
  p_city text default null,
  p_country_code text default null,
  p_word_style text default 'bold'
) returns public.daily_words
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_level integer;
  actor_date date;
  inserted_word public.daily_words;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;
  if p_word is null or char_length(trim(p_word)) not between 1 and 20 or trim(p_word) ~ '[[:space:]]' then
    raise exception 'Use one word with no more than 20 characters';
  end if;

  begin
    actor_date := (now() at time zone p_timezone)::date;
  exception when invalid_parameter_value then
    raise exception 'Invalid timezone';
  end;

  select level into actor_level from public.profiles where id = actor;
  if p_word_style not in ('bold', 'serif') then
    raise exception 'Invalid word style';
  end if;
  if p_word_style <> 'bold' and actor_level < 2 then
    raise exception 'Additional word styles unlock at Level 2';
  end if;
  if p_emoji is not null and actor_level < 3 then
    raise exception 'Emoji unlocks at Level 3';
  end if;
  if p_color <> 'mint' and actor_level < 4 then
    raise exception 'Additional colors unlock at Level 4';
  end if;

  insert into public.daily_words (user_id, local_date, word, emoji, color, timezone, city, country_code, word_style)
  values (actor, actor_date, trim(p_word), nullif(p_emoji, ''), p_color, p_timezone, p_city, p_country_code, p_word_style)
  returning * into inserted_word;

  return inserted_word;
end;
$$;

revoke all on function public.post_daily_word(text, text, text, public.word_color, text, text, text) from public, anon;
grant execute on function public.post_daily_word(text, text, text, public.word_color, text, text, text) to authenticated;

drop function public.feed_words(date, integer, boolean);

create function public.feed_words(
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
  limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.feed_words(date, integer, boolean) from public, anon;
grant execute on function public.feed_words(date, integer, boolean) to authenticated;

drop function public.my_word_history(integer);

create function public.my_word_history(p_limit integer default 14)
returns table (
  id bigint,
  local_date date,
  word text,
  emoji text,
  color public.word_color,
  word_style text,
  city text,
  created_at timestamptz,
  echo_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    daily.id,
    daily.local_date,
    daily.word,
    daily.emoji,
    daily.color,
    daily.word_style,
    daily.city,
    daily.created_at,
    count(echo.id) as echo_count
  from public.daily_words daily
  left join public.echoes echo on echo.daily_word_id = daily.id
  where (select auth.uid()) is not null
    and daily.user_id = (select auth.uid())
  group by daily.id
  order by daily.local_date desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.my_word_history(integer) from public, anon;
grant execute on function public.my_word_history(integer) to authenticated;
