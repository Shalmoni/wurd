-- Echoes are a 1-3 strength instead of a binary reaction. Existing echoes
-- become the middle (2 / Okay) echo everywhere, including totals and XP.
alter table public.echoes
  add column strength smallint not null default 2,
  add constraint echoes_strength_check check (strength between 1 and 3);

-- The echo recipient earns exactly the selected strength. Updating a rating
-- updates the same XP event instead of creating a second reward.
create or replace function private.handle_echo_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  word_owner uuid;
  unique_source text;
  recalculated_xp bigint;
begin
  select user_id into word_owner
  from public.daily_words
  where id = coalesce(new.daily_word_id, old.daily_word_id);

  if word_owner is null then
    return new;
  end if;

  unique_source := coalesce(new.daily_word_id, old.daily_word_id)::text
    || ':' || coalesce(new.user_id, old.user_id)::text;

  if tg_op = 'DELETE' then
    delete from public.xp_events
    where user_id = word_owner
      and kind = 'echo_received'::public.xp_event_kind
      and source_key = unique_source;
  else
    insert into public.xp_events (user_id, kind, points, source_key)
    values (word_owner, 'echo_received', new.strength, unique_source)
    on conflict (user_id, kind, source_key)
    do update set points = excluded.points;
  end if;

  select coalesce(sum(event.points), 0)::bigint
  into recalculated_xp
  from public.xp_events event
  where event.user_id = word_owner;

  update public.profiles
  set xp = recalculated_xp,
      level = private.level_for_xp(recalculated_xp),
      updated_at = now()
  where id = word_owner;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists on_echo_created on public.echoes;
create trigger on_echo_created
after insert or update of strength or delete on public.echoes
for each row execute function private.handle_echo_xp();

-- Rebuild historical recipient events so early event-key formats cannot leave
-- duplicate XP behind. One echoer always maps to one reward for one Wurd.
delete from public.xp_events
where kind = 'echo_received'::public.xp_event_kind;

insert into public.xp_events (user_id, kind, points, source_key, created_at)
select
  word.user_id,
  'echo_received'::public.xp_event_kind,
  echo.strength,
  echo.daily_word_id::text || ':' || echo.user_id::text,
  echo.created_at
from public.echoes echo
join public.daily_words word on word.id = echo.daily_word_id;

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

create or replace function public.set_echo_strength(
  p_daily_word_id bigint,
  p_strength smallint
) returns void
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
  if p_strength is null or p_strength not between 1 and 3 then
    raise exception 'Echo strength must be between 1 and 3';
  end if;

  insert into public.echoes (daily_word_id, user_id, strength)
  select word.id, actor, p_strength
  from public.daily_words word
  where word.id = p_daily_word_id
    and word.user_id <> actor
    and word.replaced_at is null
    and word.created_at > now() - interval '24 hours'
    and word.created_at <= now()
  on conflict (daily_word_id, user_id)
  do update set strength = excluded.strength;

  if not found then
    raise exception 'This Wurd is not available to echo';
  end if;
end;
$$;

revoke all on function public.set_echo_strength(bigint, smallint) from public, anon;
grant execute on function public.set_echo_strength(bigint, smallint) to authenticated;

-- Keep old clients working: their binary echo is treated as the default 2.
create or replace function public.echo_word(p_daily_word_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.set_echo_strength(p_daily_word_id, 2::smallint);
end;
$$;

revoke all on function public.echo_word(bigint) from public, anon;
grant execute on function public.echo_word(bigint) to authenticated;

-- Echo writes go through the validated RPCs above.
revoke insert, update on public.echoes from authenticated;

drop function if exists public.feed_words(date, integer, boolean);

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
  color text,
  word_style text,
  animation text,
  local_date date,
  created_at timestamptz,
  echo_count bigint,
  spoke_count bigint,
  echoed_by_me boolean,
  my_echo_strength smallint
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
    case
      when profile.level >= 5
        and profile.avatar_url = profile.id::text || '/avatar.webp'
      then profile.avatar_url
      else null
    end as avatar_url,
    daily.city,
    daily.country_code,
    daily.word,
    daily.emoji,
    daily.color,
    daily.word_style,
    daily.animation,
    daily.local_date,
    daily.created_at,
    echo_stats.echo_count,
    (
      select count(distinct recent.user_id)
      from active_words recent
      where not p_friends_only
        or recent.user_id = (select auth.uid())
        or exists (
          select 1 from public.friendships recent_friendship
          where recent_friendship.status = 'accepted'
            and (
              (recent_friendship.requester_id = (select auth.uid()) and recent_friendship.addressee_id = recent.user_id)
              or (recent_friendship.addressee_id = (select auth.uid()) and recent_friendship.requester_id = recent.user_id)
            )
        )
    ) as spoke_count,
    echo_stats.my_echo_strength > 0 as echoed_by_me,
    echo_stats.my_echo_strength
  from active_words daily
  join public.profiles profile on profile.id = daily.user_id
  cross join lateral (
    select
      coalesce(sum(echo.strength), 0)::bigint as echo_count,
      coalesce(max(echo.strength) filter (where echo.user_id = (select auth.uid())), 0)::smallint as my_echo_strength
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

drop function if exists public.my_word_history(integer);

create function public.my_word_history(p_limit integer default 14)
returns table (
  id bigint,
  local_date date,
  word text,
  emoji text,
  color text,
  word_style text,
  animation text,
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
    daily.animation,
    daily.city,
    daily.created_at,
    coalesce(sum(echo.strength), 0)::bigint as echo_count
  from public.daily_words daily
  left join public.echoes echo on echo.daily_word_id = daily.id
  where (select auth.uid()) is not null
    and daily.user_id = (select auth.uid())
  group by daily.id
  order by daily.local_date desc, daily.created_at desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke all on function public.my_word_history(integer) from public, anon;
grant execute on function public.my_word_history(integer) to authenticated;
