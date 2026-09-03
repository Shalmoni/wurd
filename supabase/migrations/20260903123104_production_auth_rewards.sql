-- Production rules for WURD accounts, rewards, and anonymous echoes.

create type public.word_color as enum ('mint', 'blue', 'coral');

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists streak_days integer not null default 0 check (streak_days >= 0),
  add column if not exists longest_streak integer not null default 0 check (longest_streak >= 0),
  add column if not exists last_word_date date;

alter table public.profiles drop constraint if exists profiles_level_check;
alter table public.profiles
  add constraint profiles_level_check check (level between 1 and 3);

alter table public.daily_words drop constraint if exists daily_words_word_check;
alter table public.daily_words
  add constraint daily_words_word_check check (
    char_length(word) between 1 and 20
    and word !~ '[[:space:]]'
  ),
  add column if not exists emoji text check (emoji is null or char_length(emoji) between 1 and 16),
  add column if not exists color public.word_color not null default 'mint';

drop policy if exists "authenticated echo totals are visible" on public.echoes;
create policy "users read their own echoes"
on public.echoes for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users remove their own echoes"
on public.echoes for delete to authenticated
using ((select auth.uid()) = user_id);

grant delete on public.echoes to authenticated;
grant update (username, display_name, city, country_code, timezone, avatar_url) on public.profiles to authenticated;

create or replace function private.level_for_xp(total_xp bigint)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when total_xp >= 300 then 3
    when total_xp >= 100 then 2
    else 1
  end;
$$;

revoke all on function private.level_for_xp(bigint) from public, anon, authenticated;

create or replace function private.multiplier_for_user(target_user uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when streak_days >= 60 then 1.5
    when streak_days >= 30 then 1.4
    when streak_days >= 14 then 1.3
    when streak_days >= 7 then 1.2
    when streak_days >= 3 then 1.1
    else 1.0
  end
  from public.profiles
  where id = target_user;
$$;

revoke all on function private.multiplier_for_user(uuid) from public, anon, authenticated;

create or replace function private.award_xp(
  target_user uuid,
  event_kind public.xp_event_kind,
  event_points integer,
  event_source text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  awarded_points integer;
begin
  if target_user is null or event_points <= 0 then
    return;
  end if;

  awarded_points := greatest(1, round(event_points * coalesce(private.multiplier_for_user(target_user), 1.0))::integer);

  insert into public.xp_events (user_id, kind, points, source_key)
  values (target_user, event_kind, awarded_points, event_source)
  on conflict (user_id, kind, source_key) do nothing;

  if found then
    update public.profiles
    set xp = xp + awarded_points,
        level = private.level_for_xp(xp + awarded_points),
        updated_at = now()
    where id = target_user;
  end if;
end;
$$;

revoke all on function private.award_xp(uuid, public.xp_event_kind, integer, text) from public, anon, authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    'wurd_' || substr(replace(new.id::text, '-', ''), 1, 10),
    nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), ''),
    nullif(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'), '')
  );
  return new;
end;
$$;

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

  perform private.award_xp(new.user_id, 'daily_word', 10, new.id::text);
  return new;
end;
$$;

create or replace function private.handle_echo_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  word_owner uuid;
  giver_echoes_today integer;
  giver_timezone text;
  unique_source text;
begin
  select user_id into word_owner from public.daily_words where id = new.daily_word_id;
  unique_source := new.daily_word_id::text || ':' || new.user_id::text;

  -- Every unique received echo is worth 8 base XP.
  perform private.award_xp(word_owner, 'echo_received', 8, unique_source);

  select timezone into giver_timezone from public.profiles where id = new.user_id;
  select count(*) into giver_echoes_today
  from public.echoes
  where user_id = new.user_id
    and (created_at at time zone coalesce(giver_timezone, 'UTC'))::date =
        (new.created_at at time zone coalesce(giver_timezone, 'UTC'))::date;

  if giver_echoes_today <= 8 then
    perform private.award_xp(new.user_id, 'echo_given', 1, unique_source);
  end if;

  return new;
end;
$$;

revoke insert on public.daily_words, public.echoes from authenticated;

create or replace function public.post_daily_word(
  p_word text,
  p_timezone text,
  p_emoji text default null,
  p_color public.word_color default 'mint',
  p_city text default null,
  p_country_code text default null
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
  if p_emoji is not null and actor_level < 2 then
    raise exception 'Emoji unlocks at Level 2';
  end if;
  if p_color <> 'mint' and actor_level < 3 then
    raise exception 'Additional colors unlock at Level 3';
  end if;

  insert into public.daily_words (user_id, local_date, word, emoji, color, timezone, city, country_code)
  values (actor, actor_date, trim(p_word), nullif(p_emoji, ''), p_color, p_timezone, p_city, p_country_code)
  returning * into inserted_word;

  return inserted_word;
end;
$$;

revoke all on function public.post_daily_word(text, text, text, public.word_color, text, text) from public, anon;
grant execute on function public.post_daily_word(text, text, text, public.word_color, text, text) to authenticated;

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
  where id = p_daily_word_id and user_id <> actor
  on conflict (daily_word_id, user_id) do nothing;
end;
$$;

revoke all on function public.echo_word(bigint) from public, anon;
grant execute on function public.echo_word(bigint) to authenticated;

create or replace function public.un_echo_word(p_daily_word_id bigint)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.echoes
  where daily_word_id = p_daily_word_id and user_id = (select auth.uid());
$$;

revoke all on function public.un_echo_word(bigint) from public, anon;
grant execute on function public.un_echo_word(bigint) to authenticated;

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
    daily.local_date,
    daily.created_at,
    count(echo.id) as echo_count,
    count(*) over () as spoke_count,
    bool_or(echo.user_id = (select auth.uid())) as echoed_by_me
  from public.daily_words daily
  join public.profiles profile on profile.id = daily.user_id
  left join public.echoes echo on echo.daily_word_id = daily.id
  where (select auth.uid()) is not null
    and daily.local_date = p_date
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

create or replace function public.my_word_history(p_limit integer default 14)
returns table (
  id bigint,
  local_date date,
  word text,
  emoji text,
  color public.word_color,
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
