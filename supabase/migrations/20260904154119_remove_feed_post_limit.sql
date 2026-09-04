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
  limit nullif(greatest(p_limit, 0), 0);
$$;

revoke all on function public.feed_words(date, integer, boolean) from public, anon;
grant execute on function public.feed_words(date, integer, boolean) to authenticated;
