create type public.friendship_status as enum ('pending', 'accepted', 'declined');
create type public.xp_event_kind as enum ('daily_word', 'echo_given', 'echo_received', 'friend_match', 'streak_week');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text check (char_length(display_name) <= 50),
  city text check (char_length(city) <= 80),
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  timezone text not null default 'UTC' check (char_length(timezone) <= 64),
  xp bigint not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_words (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  word text not null check (
    char_length(word) between 1 and 24
    and word !~ '[[:space:]]'
  ),
  normalized_word text generated always as (lower(word)) stored,
  timezone text not null check (char_length(timezone) <= 64),
  city text check (char_length(city) <= 80),
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  unique (user_id, local_date)
);

create table public.echoes (
  id bigint generated always as identity primary key,
  daily_word_id bigint not null references public.daily_words(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (daily_word_id, user_id)
);

create table public.friendships (
  id bigint generated always as identity primary key,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

create table public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind public.xp_event_kind not null,
  points integer not null check (points > 0),
  source_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, source_key)
);

create index daily_words_date_echo_feed_idx on public.daily_words (local_date desc, created_at desc);
create index daily_words_normalized_date_idx on public.daily_words (local_date, normalized_word);
create index echoes_word_created_idx on public.echoes (daily_word_id, created_at desc);
create index echoes_user_created_idx on public.echoes (user_id, created_at desc);
create index friendships_addressee_status_idx on public.friendships (addressee_id, status);
create index xp_events_user_created_idx on public.xp_events (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.daily_words enable row level security;
alter table public.echoes enable row level security;
alter table public.friendships enable row level security;
alter table public.xp_events enable row level security;

create policy "authenticated profiles are visible"
on public.profiles for select to authenticated using (true);

create policy "users update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "authenticated daily words are visible"
on public.daily_words for select to authenticated using (true);

create policy "users post their own daily word"
on public.daily_words for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "authenticated echo totals are visible"
on public.echoes for select to authenticated using (true);

create policy "users create their own echoes"
on public.echoes for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and not exists (
    select 1 from public.daily_words word
    where word.id = daily_word_id and word.user_id = (select auth.uid())
  )
);

create policy "friendship participants can read"
on public.friendships for select to authenticated
using ((select auth.uid()) in (requester_id, addressee_id));

create policy "users request friendships"
on public.friendships for insert to authenticated
with check ((select auth.uid()) = requester_id and status = 'pending');

create policy "addressees respond to friendships"
on public.friendships for update to authenticated
using ((select auth.uid()) = addressee_id)
with check ((select auth.uid()) = addressee_id and status in ('accepted', 'declined'));

create policy "users read their own xp history"
on public.xp_events for select to authenticated
using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select on public.profiles, public.daily_words, public.echoes, public.friendships, public.xp_events to authenticated;
grant insert on public.daily_words, public.echoes, public.friendships to authenticated;
grant update (display_name, city, country_code, timezone) on public.profiles to authenticated;
grant update (status) on public.friendships to authenticated;
grant usage on sequence public.daily_words_id_seq, public.echoes_id_seq, public.friendships_id_seq to authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

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
begin
  if target_user is null or event_points <= 0 then
    return;
  end if;

  insert into public.xp_events (user_id, kind, points, source_key)
  values (target_user, event_kind, event_points, event_source)
  on conflict (user_id, kind, source_key) do nothing;

  if found then
    update public.profiles
    set xp = xp + event_points,
        level = 1 + floor(sqrt((xp + event_points)::numeric / 100))::integer,
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
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'wurd_' || substr(replace(new.id::text, '-', ''), 1, 10),
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.handle_daily_word_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.award_xp(new.user_id, 'daily_word', 10, new.id::text);
  return new;
end;
$$;

revoke all on function private.handle_daily_word_xp() from public, anon, authenticated;

create trigger on_daily_word_created
after insert on public.daily_words
for each row execute function private.handle_daily_word_xp();

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
begin
  select user_id into word_owner from public.daily_words where id = new.daily_word_id;
  perform private.award_xp(word_owner, 'echo_received', 1, new.id::text);

  select timezone into giver_timezone from public.profiles where id = new.user_id;

  select count(*) into giver_echoes_today
  from public.echoes
  where user_id = new.user_id
    and (created_at at time zone coalesce(giver_timezone, 'UTC'))::date =
        (new.created_at at time zone coalesce(giver_timezone, 'UTC'))::date;

  if giver_echoes_today <= 3 then
    perform private.award_xp(new.user_id, 'echo_given', 1, new.id::text);
  end if;

  return new;
end;
$$;

revoke all on function private.handle_echo_xp() from public, anon, authenticated;

create trigger on_echo_created
after insert on public.echoes
for each row execute function private.handle_echo_xp();

alter publication supabase_realtime add table public.daily_words;
alter publication supabase_realtime add table public.echoes;
