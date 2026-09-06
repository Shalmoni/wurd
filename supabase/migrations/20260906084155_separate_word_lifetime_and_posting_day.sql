alter table public.daily_words
add column replaced_at timestamptz;

-- Existing production data can legitimately contain two rows from the same
-- user inside the rolling 24-hour window: yesterday's late Wurd and today's
-- newer Wurd. Mark the older row as replaced at the time the newer row was
-- posted, but only when their lifetimes would otherwise overlap.
with word_successors as (
  select
    id,
    created_at,
    lead(created_at) over (
      partition by user_id
      order by created_at, id
    ) as next_created_at
  from public.daily_words
)
update public.daily_words daily
set replaced_at = successor.next_created_at
from word_successors successor
where daily.id = successor.id
  and successor.next_created_at is not null
  and successor.next_created_at < successor.created_at + interval '24 hours';

create index daily_words_active_user_created_idx
on public.daily_words (user_id, created_at desc)
where replaced_at is null;

create or replace function public.post_daily_word(
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

  -- Serialize posting for this user. The calendar-day uniqueness constraint is
  -- still the source of truth for once-per-local-day eligibility.
  select level into actor_level
  from public.profiles
  where id = actor
  for update;

  if exists (
    select 1 from public.daily_words
    where user_id = actor and local_date = actor_date
  ) then
    raise exception 'You already posted a Wurd today';
  end if;

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

  -- Replacing happens only in the same transaction that successfully creates
  -- the new Wurd. Expired/history rows remain intact.
  update public.daily_words
  set replaced_at = now()
  where user_id = actor
    and replaced_at is null
    and created_at > now() - interval '24 hours';

  insert into public.daily_words (user_id, local_date, word, emoji, color, timezone, city, country_code, word_style)
  values (actor, actor_date, trim(p_word), nullif(p_emoji, ''), p_color, p_timezone, p_city, p_country_code, p_word_style)
  returning * into inserted_word;

  return inserted_word;
end;
$$;

revoke all on function public.post_daily_word(text, text, text, public.word_color, text, text, text) from public, anon;
grant execute on function public.post_daily_word(text, text, text, public.word_color, text, text, text) to authenticated;

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
  with active_words as (
    select distinct on (candidate.user_id)
      candidate.*
    from public.daily_words candidate
    where candidate.replaced_at is null
      and candidate.created_at > now() - interval '24 hours'
      and candidate.created_at <= now()
    order by candidate.user_id, candidate.created_at desc, candidate.id desc
  )
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
    echo_stats.echo_count,
    (
      select count(distinct recent.user_id)
      from active_words recent
      where true
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
    echo_stats.echoed_by_me
  from active_words daily
  join public.profiles profile on profile.id = daily.user_id
  cross join lateral (
    select
      count(*) as echo_count,
      coalesce(bool_or(echo.user_id = (select auth.uid())), false) as echoed_by_me
    from public.echoes echo
    where echo.daily_word_id = daily.id
  ) echo_stats
  where (select auth.uid()) is not null
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
  order by echo_stats.echo_count desc, daily.created_at desc
  limit nullif(greatest(p_limit, 0), 0);
$$;

revoke all on function public.feed_words(date, integer, boolean) from public, anon;
grant execute on function public.feed_words(date, integer, boolean) to authenticated;

create or replace function public.echo_word(p_daily_word_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  insert into public.echoes (daily_word_id, user_id)
  select p_daily_word_id, actor
  from public.daily_words
  where id = p_daily_word_id
    and user_id <> actor
    and replaced_at is null
    and created_at > now() - interval '24 hours'
    and created_at <= now()
  on conflict (daily_word_id, user_id) do nothing;
end;
$$;

revoke all on function public.echo_word(bigint) from public, anon;
grant execute on function public.echo_word(bigint) to authenticated;
