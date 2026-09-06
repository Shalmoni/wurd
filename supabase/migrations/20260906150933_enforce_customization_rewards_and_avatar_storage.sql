-- V2 customization rewards are enforced here, not only hidden in the client.
-- Apply after the Wurd lifecycle and ten-level migrations.

drop function if exists public.feed_words(date, integer, boolean);
drop function if exists public.my_word_history(integer);
drop function if exists public.post_daily_word(text, text, text, public.word_color, text, text, text);

alter table public.daily_words
  alter column color drop default,
  alter column color type text using color::text,
  alter column color set default 'mint';

alter table public.daily_words
  drop constraint if exists daily_words_color_check,
  add constraint daily_words_color_check check (
    color in (
      'mint', 'blue', 'violet', 'coral', 'yellow', 'lime',
      'green', 'cyan', 'deepBlue', 'magenta', 'pink', 'red'
    )
  ),
  drop constraint if exists daily_words_word_style_check,
  add constraint daily_words_word_style_check check (
    word_style in ('bold', 'serif', 'rounded', 'mono', 'slab', 'hand')
  ),
  add column animation text not null default 'still',
  add constraint daily_words_animation_check check (
    animation in ('still', 'pulse', 'float', 'shimmer')
  );

create or replace function private.is_single_emoji(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- One flag, one keycap, one pictograph, or one joined pictograph sequence.
  -- Variation selectors and skin-tone modifiers are part of the same emoji.
  select p_value is not null
    and octet_length(p_value) <= 64
    and p_value !~ '[[:space:]]'
    and (
      p_value ~ '^[🇦-🇿]{2}$'
      or p_value ~ '^[#*0-9]️?⃣$'
      or p_value ~ '^[©®‼⁉™ℹ↔-↙↩↪⌚⌛⏩-⏳⏸-⏺Ⓜ▪▫▶◀◻-◾☀-⛿✀-➿🀀-🫿](️|[🏻-🏿])?(‍[©®‼⁉™ℹ↔-↙↩↪⌚⌛⏩-⏳⏸-⏺Ⓜ▪▫▶◀◻-◾☀-⛿✀-➿🀀-🫿](️|[🏻-🏿])?)*$'
    );
$$;

revoke all on function private.is_single_emoji(text) from public, anon, authenticated;

-- Google profile images are not automatically used. A Wurd profile photo is
-- an explicit Level 5 choice made inside the app.
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
    null
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

update public.profiles
set avatar_url = null,
    updated_at = now()
where avatar_url ~ '^https?://';

create or replace function public.post_daily_word(
  p_word text,
  p_timezone text,
  p_emoji text default null,
  p_color text default 'mint',
  p_city text default null,
  p_country_code text default null,
  p_word_style text default 'bold',
  p_animation text default 'still'
) returns public.daily_words
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_level integer;
  actor_date date;
  clean_emoji text := nullif(trim(p_emoji), '');
  inserted_word public.daily_words;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;
  if p_word is null or char_length(trim(p_word)) not between 1 and 20 or trim(p_word) ~ '[[:space:]]' then
    raise exception 'Use one Wurd with no more than 20 characters';
  end if;

  begin
    actor_date := (now() at time zone p_timezone)::date;
  exception when invalid_parameter_value then
    raise exception 'Invalid timezone';
  end;

  select private.level_for_xp(profile.xp)
  into actor_level
  from public.profiles profile
  where profile.id = actor
  for update;

  if actor_level is null then
    raise exception 'Profile not found';
  end if;

  if exists (
    select 1 from public.daily_words
    where user_id = actor and local_date = actor_date
  ) then
    raise exception 'You already posted a Wurd today';
  end if;

  if p_word_style not in ('bold', 'serif', 'rounded', 'mono', 'slab', 'hand') then
    raise exception 'Invalid Wurd font';
  end if;
  if p_word_style in ('serif', 'rounded') and actor_level < 2 then
    raise exception 'These fonts unlock at Level 2';
  end if;
  if p_word_style in ('mono', 'slab', 'hand') and actor_level < 6 then
    raise exception 'These fonts unlock at Level 6';
  end if;

  if clean_emoji is not null and actor_level < 3 then
    raise exception 'Emoji unlocks at Level 3';
  end if;
  if clean_emoji is not null and actor_level < 8
    and clean_emoji not in ('🙂', '🔥', '✨', '❤️', '🌱', '💭') then
    raise exception 'This emoji unlocks at Level 8';
  end if;
  if clean_emoji is not null and not private.is_single_emoji(clean_emoji) then
    raise exception 'Use one emoji at the end of your Wurd';
  end if;

  if p_color not in (
    'mint', 'blue', 'violet', 'coral', 'yellow', 'lime',
    'green', 'cyan', 'deepBlue', 'magenta', 'pink', 'red'
  ) then
    raise exception 'Invalid Wurd color';
  end if;
  if p_color <> 'mint' and actor_level < 4 then
    raise exception 'More colors unlock at Level 4';
  end if;
  if p_color not in ('mint', 'blue', 'violet', 'coral') and actor_level < 7 then
    raise exception 'This color unlocks at Level 7';
  end if;

  if p_animation not in ('still', 'pulse', 'float', 'shimmer') then
    raise exception 'Invalid Wurd animation';
  end if;
  if p_animation <> 'still' and actor_level < 9 then
    raise exception 'Wurd animations unlock at Level 9';
  end if;

  update public.daily_words
  set replaced_at = now()
  where user_id = actor
    and replaced_at is null
    and created_at > now() - interval '24 hours';

  insert into public.daily_words (
    user_id, local_date, word, emoji, color, timezone,
    city, country_code, word_style, animation
  ) values (
    actor, actor_date, trim(p_word), clean_emoji, p_color, p_timezone,
    p_city, p_country_code, p_word_style, p_animation
  )
  returning * into inserted_word;

  return inserted_word;
end;
$$;

revoke all on function public.post_daily_word(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.post_daily_word(text, text, text, text, text, text, text, text) to authenticated;

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
  color text,
  word_style text,
  animation text,
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

create or replace function public.my_word_history(p_limit integer default 14)
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
    count(echo.id) as echo_count
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

-- Profile photos are public feed assets, but uploads are tightly restricted:
-- one small WebP object per authenticated user, in that user's own folder.
insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'avatars', 'avatars', true, 262144, array['image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users insert their avatar" on storage.objects;
create policy "users insert their avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and name = (select auth.uid())::text || '/avatar.webp'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid()) and profile.level >= 5
  )
);

drop policy if exists "users read their avatar object" on storage.objects;
create policy "users read their avatar object"
on storage.objects for select
to authenticated
using (
  bucket_id = 'avatars'
  and name = (select auth.uid())::text || '/avatar.webp'
);

drop policy if exists "users update their avatar" on storage.objects;
create policy "users update their avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and name = (select auth.uid())::text || '/avatar.webp'
)
with check (
  bucket_id = 'avatars'
  and name = (select auth.uid())::text || '/avatar.webp'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles profile
    where profile.id = (select auth.uid()) and profile.level >= 5
  )
);

drop policy if exists "users delete their avatar" on storage.objects;
create policy "users delete their avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and name = (select auth.uid())::text || '/avatar.webp'
);

create or replace function public.set_profile_avatar(p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_level integer;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  select private.level_for_xp(profile.xp)
  into actor_level
  from public.profiles profile
  where profile.id = actor;

  if actor_level < 5 then
    raise exception 'Profile photos unlock at Level 5';
  end if;

  if p_path is not null and p_path <> actor::text || '/avatar.webp' then
    raise exception 'Invalid profile photo path';
  end if;

  if p_path is not null and not exists (
    select 1 from storage.objects object
    where object.bucket_id = 'avatars'
      and object.name = p_path
      and object.owner_id = actor::text
  ) then
    raise exception 'Profile photo upload not found';
  end if;

  update public.profiles
  set avatar_url = p_path,
      updated_at = now()
  where id = actor;

  return p_path;
end;
$$;

revoke all on function public.set_profile_avatar(text) from public, anon;
grant execute on function public.set_profile_avatar(text) to authenticated;

-- Profile edits remain owner-scoped by RLS. Avatar changes must go through the
-- level-checked function above rather than a direct column update.
revoke all on public.profiles from anon;
revoke insert, update, delete, truncate, references, trigger on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (username, display_name, city, country_code, timezone) on public.profiles to authenticated;

revoke all on public.daily_words from anon;
revoke insert, update, delete, truncate, references, trigger on public.daily_words from authenticated;
grant select on public.daily_words to authenticated;
