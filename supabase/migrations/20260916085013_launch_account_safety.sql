-- Additive release: no existing posts, accounts, or XP are rewritten.
create table private.account_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id), check (blocker_id <> blocked_id)
);
create index account_blocks_reverse_idx on private.account_blocks(blocked_id, blocker_id);
create table private.community_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  word_id bigint references public.daily_words(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now()
);
create index community_reports_reporter_created_idx on private.community_reports(reporter_id, created_at);
create index community_reports_word_idx on private.community_reports(word_id);
create table private.product_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 3 and 2000),
  created_at timestamptz not null default now()
);
create index product_feedback_user_created_idx on private.product_feedback(user_id, created_at);
alter table private.account_blocks enable row level security;
alter table private.community_reports enable row level security;
alter table private.product_feedback enable row level security;
revoke all on private.account_blocks, private.community_reports, private.product_feedback from public, anon, authenticated;

create function private.person_visible(other_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.profiles where id = auth.uid())
    and not exists(select 1 from private.account_blocks b where
      (b.blocker_id = auth.uid() and b.blocked_id = other_id)
      or (b.blocked_id = auth.uid() and b.blocker_id = other_id));
$$;
revoke all on function private.person_visible(uuid) from public, anon;
grant execute on function private.person_visible(uuid) to authenticated;

create policy "Respect blocks on profiles" on public.profiles as restrictive for select to authenticated using (private.person_visible(id));
create policy "Respect blocks on words" on public.daily_words as restrictive for select to authenticated using (private.person_visible(user_id));
create policy "Respect blocks on replies" on public.wurd_replies as restrictive for select to authenticated using (private.person_visible(user_id));

-- Triggers apply even to SECURITY DEFINER write RPCs; client-side hiding is not enforcement.
create function private.enforce_interaction_block() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a uuid; b uuid;
begin
  if tg_table_name = 'friendships' then
    a := new.requester_id; b := new.addressee_id;
  else
    a := new.user_id;
    select user_id into b from public.daily_words where id = new.daily_word_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(least(a::text,b::text) || greatest(a::text,b::text), 0));
  if exists(select 1 from private.account_blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a)) then
    raise exception 'This interaction is not available';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_interaction_block() from public, anon, authenticated;
create trigger enforce_echo_block before insert or update on public.echoes for each row execute function private.enforce_interaction_block();
create trigger enforce_reply_block before insert or update on public.wurd_replies for each row execute function private.enforce_interaction_block();
create trigger enforce_friendship_block before insert or update on public.friendships for each row execute function private.enforce_interaction_block();

create function private.account_tools(p_action text, p_target uuid default null, p_word bigint default null, p_text text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result jsonb;
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor) then raise exception 'Sign in to continue'; end if;
  perform pg_advisory_xact_lock(hashtextextended('account-tools:' || actor::text, 0));
  if p_action = 'block' then
    if p_target is null or p_target=actor or not exists(select 1 from public.profiles where id=p_target) then raise exception 'Account unavailable'; end if;
    perform pg_advisory_xact_lock(hashtextextended(least(actor::text,p_target::text) || greatest(actor::text,p_target::text), 0));
    insert into private.account_blocks(blocker_id,blocked_id) values(actor,p_target) on conflict do nothing;
    delete from public.friendships where (requester_id=actor and addressee_id=p_target) or (requester_id=p_target and addressee_id=actor);
  elsif p_action = 'unblock' then
    delete from private.account_blocks where blocker_id=actor and blocked_id=p_target;
  elsif p_action = 'blocks' then
    select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username) order by b.created_at desc),'[]') into result
    from private.account_blocks b join public.profiles p on p.id=b.blocked_id where b.blocker_id=actor;
    return result;
  elsif p_action = 'report' then
    if not exists(select 1 from public.daily_words where id=p_word and user_id<>actor and private.person_visible(user_id)) then raise exception 'Wurd unavailable'; end if;
    if (select count(*) from private.community_reports where reporter_id=actor and created_at>now()-interval '1 day') >= 20 then raise exception 'Report limit reached. Please try tomorrow.'; end if;
    insert into private.community_reports(reporter_id,word_id,reason) values(actor,p_word,btrim(p_text));
  elsif p_action = 'feedback' then
    if (select count(*) from private.product_feedback where user_id=actor and created_at>now()-interval '1 day') >= 10 then raise exception 'Feedback limit reached. Please try tomorrow.'; end if;
    insert into private.product_feedback(user_id,message) values(actor,btrim(p_text));
  elsif p_action = 'export' then
    return jsonb_build_object(
      'profile',(select to_jsonb(p) from public.profiles p where id=actor),
      'posts',(select coalesce(jsonb_agg(w),'[]') from public.daily_words w where user_id=actor),
      'replies',(select coalesce(jsonb_agg(r),'[]') from public.wurd_replies r where user_id=actor),
      'echoes',(select coalesce(jsonb_agg(e),'[]') from public.echoes e where user_id=actor),
      'xp',(select coalesce(jsonb_agg(x),'[]') from public.xp_events x where user_id=actor),
      'friendships',(select coalesce(jsonb_agg(f),'[]') from public.friendships f where requester_id=actor or addressee_id=actor),
      'game_answers',(select coalesce(jsonb_agg(a),'[]') from private.common_wurd_answers a where user_id=actor),
      'blocks',(select coalesce(jsonb_agg(b),'[]') from private.account_blocks b where blocker_id=actor),
      'feedback',(select coalesce(jsonb_agg(f),'[]') from private.product_feedback f where user_id=actor),
      'reports',(select coalesce(jsonb_agg(r),'[]') from private.community_reports r where reporter_id=actor)
    );
  else raise exception 'Unknown action';
  end if;
  return jsonb_build_object('ok',true);
end;
$$;
revoke all on function private.account_tools(text,uuid,bigint,text) from public,anon;
grant execute on function private.account_tools(text,uuid,bigint,text) to authenticated;
create function public.account_tools(p_action text, p_target uuid default null, p_word bigint default null, p_text text default null)
returns jsonb language sql security invoker set search_path = '' as $$ select private.account_tools(p_action,p_target,p_word,p_text); $$;
revoke all on function public.account_tools(text,uuid,bigint,text) from public,anon;
grant execute on function public.account_tools(text,uuid,bigint,text) to authenticated;

create function private.account_session_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.sessions where user_id=auth.uid() and id::text=auth.jwt()->>'session_id');
$$;
revoke all on function private.account_session_active() from public,anon;
grant execute on function private.account_session_active() to authenticated;
create function public.account_session_active() returns boolean language sql security invoker set search_path = '' as $$ select private.account_session_active(); $$;
revoke all on function public.account_session_active() from public,anon;
grant execute on function public.account_session_active() to authenticated;

-- New notification category is opt-in: existing devices keep their choices.
alter table public.push_subscriptions add column replies boolean not null default false;
alter table public.push_deliveries drop constraint push_deliveries_event_kind_check;
alter table public.push_deliveries add constraint push_deliveries_event_kind_check check (event_kind in ('friend_request','friend_word','wurd_reply'));

CREATE OR REPLACE FUNCTION private.feed_words(p_date date, p_limit integer DEFAULT 8, p_friends_only boolean DEFAULT false)
 RETURNS TABLE(id bigint, user_id uuid, username text, display_name text, avatar_url text, city text, country_code text, word text, emoji text, color text, word_style text, animation text, local_date date, created_at timestamp with time zone, echo_count bigint, reply_count bigint, replies jsonb, spoke_count bigint, echoed_by_me boolean, my_echo_strength smallint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with active_words as (
    select distinct on (candidate.user_id)
      candidate.*
    from public.daily_words candidate
    where private.person_visible(candidate.user_id)
      and candidate.replaced_at is null
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
    end,
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
    reply_stats.reply_count,
    reply_stats.replies,
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
    ),
    echo_stats.my_echo_strength > 0,
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
  cross join lateral (
    select count(*)::bigint as reply_count,
      coalesce(jsonb_agg(jsonb_build_object(
        'id', reply.id, 'daily_word_id', reply.daily_word_id,
        'user_id', reply.user_id, 'username', replier.username,
        'avatar_url', null, 'word', reply.word, 'created_at', reply.created_at
      ) order by reply.created_at, reply.id), '[]'::jsonb) as replies
    from public.wurd_replies reply
    join public.profiles replier on replier.id = reply.user_id
    where reply.daily_word_id = daily.id and private.person_visible(reply.user_id)
  ) reply_stats
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
  order by (echo_stats.echo_count * 2 + reply_stats.reply_count) desc, daily.created_at desc
  limit nullif(greatest(p_limit, 0), 0);
$function$
;
revoke all on function private.feed_words(date,integer,boolean) from public,anon;
grant execute on function private.feed_words(date,integer,boolean) to authenticated;
CREATE OR REPLACE FUNCTION public.feed_words(p_date date, p_limit integer DEFAULT 8, p_friends_only boolean DEFAULT false)
 RETURNS TABLE(id bigint, user_id uuid, username text, display_name text, avatar_url text, city text, country_code text, word text, emoji text, color text, word_style text, animation text, local_date date, created_at timestamp with time zone, echo_count bigint, reply_count bigint, replies jsonb, spoke_count bigint, echoed_by_me boolean, my_echo_strength smallint)
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$ select * from private.feed_words(p_date,p_limit,p_friends_only); $$;
CREATE OR REPLACE FUNCTION private.wurd_reply_thread(p_daily_word_id bigint)
 RETURNS TABLE(id bigint, daily_word_id bigint, user_id uuid, username text, avatar_url text, word text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    reply.id,
    reply.daily_word_id,
    reply.user_id,
    profile.username,
    case
      when profile.level >= 5
        and profile.avatar_url = profile.id::text || '/avatar.webp'
      then profile.avatar_url
      else null
    end,
    reply.word,
    reply.created_at
  from public.wurd_replies reply
  join public.profiles profile on profile.id = reply.user_id
  join public.daily_words daily on daily.id = reply.daily_word_id
  where (select auth.uid()) is not null
    and private.person_visible(daily.user_id) and private.person_visible(reply.user_id)
    and daily.id = p_daily_word_id
    and daily.replaced_at is null
    and daily.created_at > now() - interval '24 hours'
    and daily.created_at <= now()
  order by reply.created_at, reply.id;
$function$
;
revoke all on function private.wurd_reply_thread(bigint) from public,anon;
grant execute on function private.wurd_reply_thread(bigint) to authenticated;
CREATE OR REPLACE FUNCTION public.wurd_reply_thread(p_daily_word_id bigint)
 RETURNS TABLE(id bigint, daily_word_id bigint, user_id uuid, username text, avatar_url text, word text, created_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$ select * from private.wurd_reply_thread(p_daily_word_id); $$;
CREATE OR REPLACE FUNCTION private.my_history_page(p_before timestamp with time zone DEFAULT null, p_limit integer DEFAULT 20)
 RETURNS TABLE(id bigint, local_date date, word text, emoji text, color text, word_style text, animation text, city text, created_at timestamp with time zone, echo_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    and (p_before is null or daily.created_at < p_before)
  group by daily.id
  order by daily.local_date desc, daily.created_at desc
  limit least(greatest(p_limit, 1), 50);
$function$
;
revoke all on function private.my_history_page(timestamptz,integer) from public,anon;
grant execute on function private.my_history_page(timestamptz,integer) to authenticated;
CREATE OR REPLACE FUNCTION public.my_history_page(p_before timestamp with time zone DEFAULT null, p_limit integer DEFAULT 20)
 RETURNS TABLE(id bigint, local_date date, word text, emoji text, color text, word_style text, animation text, city text, created_at timestamp with time zone, echo_count bigint)
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$ select * from private.my_history_page(p_before,p_limit); $$;
revoke all on function public.my_history_page(timestamptz,integer) from public,anon;
grant execute on function public.my_history_page(timestamptz,integer) to authenticated;
