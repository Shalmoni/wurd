alter table private.common_wurd_rounds add column xp_settled_at timestamptz;

-- Internal only. Runs as the calling trusted function / cron owner, never as
-- a client-callable definer. One immutable XP event per participant per round.
create function private.settle_common_wurd_xp() returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_round record;
  v_award record;
  v_awards integer := 0;
begin
  for v_round in
    select id from private.common_wurd_rounds
    where ends_at <= clock_timestamp() and xp_settled_at is null
    order by starts_at, id for update
  loop
    for v_award in
      select a.user_id, count(*) over (partition by a.answer)::integer as points
      from private.common_wurd_answers a where a.round_id = v_round.id
      order by a.user_id
    loop
      -- The existing ledger remains the single source of truth for XP.
      -- Profile locks also serialize this with echo/friend XP recalculations.
      perform 1 from public.profiles where id = v_award.user_id for update;
      insert into public.xp_events(user_id, kind, points, source_key)
      values(v_award.user_id, 'common_wurd', v_award.points, 'common_wurd:' || v_round.id)
      on conflict(user_id, kind, source_key) do nothing;
      if found then
        update public.profiles set xp = xp + v_award.points,
          level = private.level_for_xp(xp + v_award.points), updated_at = clock_timestamp()
        where id = v_award.user_id;
        v_awards := v_awards + 1;
      end if;
    end loop;
    update private.common_wurd_rounds set xp_settled_at = clock_timestamp() where id = v_round.id;
  end loop;
  return v_awards;
end;
$$;
revoke all on function private.settle_common_wurd_xp() from public, anon, authenticated;

-- Settle immediately on a game read as well as in the background. The public
-- API shape stays compatible while old installed clients update.
create or replace function private.common_wurd_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz;
  v_round private.common_wurd_rounds%rowtype;
  v_answer text;
  v_rows jsonb := '[]'::jsonb;
  v_count bigint;
  v_points bigint := 0;
  v_total_points bigint := 0;
begin
  if v_user is null or not exists(select 1 from public.profiles where id = v_user) then
    raise exception 'Sign in to play.' using errcode = '28000';
  end if;
  perform private.settle_common_wurd_xp();
  v_now := clock_timestamp();
  insert into private.common_wurd_progress(user_id, round_id)
    select v_user, id from private.common_wurd_rounds where starts_at <= v_now and ends_at > v_now order by starts_at desc limit 1
    on conflict (user_id) do nothing;
  select r.* into v_round from private.common_wurd_rounds r
    join private.common_wurd_progress p on p.round_id = r.id where p.user_id = v_user;
  if v_round.id is null then return jsonb_build_object('server_now', v_now, 'round', null); end if;
  select answer into v_answer from private.common_wurd_answers where round_id = v_round.id and user_id = v_user;
  select count(*) into v_count from private.common_wurd_answers where round_id = v_round.id;
  if v_now >= v_round.ends_at then
    select coalesce(jsonb_agg(row_data order by count desc, answer), '[]'::jsonb) into v_rows from (
      select a.answer, count(*) as count,
        jsonb_build_object('answer', a.answer, 'count', count(*), 'usernames', jsonb_agg(p.username order by p.username)) as row_data
      from private.common_wurd_answers a join public.profiles p on p.id = a.user_id
      where a.round_id = v_round.id group by a.answer
    ) grouped;
    select coalesce(sum(points),0) into v_points from public.xp_events
      where user_id = v_user and kind = 'common_wurd' and source_key = 'common_wurd:' || v_round.id;
  end if;
  select coalesce(sum(points),0) into v_total_points from public.xp_events where user_id = v_user and kind = 'common_wurd';
  return jsonb_build_object('server_now', v_now,
    'round', jsonb_build_object('id', v_round.id, 'prompt', v_round.prompt, 'starts_at', v_round.starts_at, 'ends_at', v_round.ends_at),
    'ended', v_now >= v_round.ends_at, 'my_answer', v_answer, 'answer_count', v_count,
    'results', v_rows, 'points', v_points, 'total_points', v_total_points,
    'xp_awarded', v_points, 'total_game_xp', v_total_points,
    'profile_xp', (select xp from public.profiles where id = v_user));
end;
$$;

create or replace function private.submit_common_wurd(p_round_id text, p_answer text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_round private.common_wurd_rounds%rowtype;
  v_progress text;
  v_existing text;
  v_answer text := lower(btrim(replace(normalize(p_answer), '’', '''')));
begin
  if v_user is null or not exists(select 1 from public.profiles where id = v_user) then
    raise exception 'Sign in to play.' using errcode = '28000';
  end if;
  if v_answer is null or length(v_answer) > 30 or v_answer !~ '^[[:alpha:]]+([''-][[:alpha:]]+)*$' then
    raise exception 'Enter one word, up to 30 letters.' using errcode = '22023';
  end if;
  perform private.common_wurd_state();
  select round_id into v_progress from private.common_wurd_progress where user_id = v_user for update;
  if v_progress is distinct from p_round_id then raise exception 'Open the current round before answering.'; end if;
  -- Settlement cannot race with an in-flight, valid last-second submission.
  select * into v_round from private.common_wurd_rounds where id = p_round_id for update;
  select answer into v_existing from private.common_wurd_answers where round_id = p_round_id and user_id = v_user;
  if v_existing is not null then
    if v_existing = v_answer then return private.common_wurd_state(); end if;
    raise exception 'Your answer is already locked.' using errcode = '23505';
  end if;
  if v_round.id is null or v_round.xp_settled_at is not null or clock_timestamp() < v_round.starts_at or clock_timestamp() >= v_round.ends_at then
    raise exception 'This round has ended. Your answer was not submitted.' using errcode = '22023';
  end if;
  insert into private.common_wurd_answers(round_id, user_id, answer) values (p_round_id, v_user, v_answer);
  return private.common_wurd_state();
end;
$$;

-- Recalculation triggers must lock before reading the ledger, otherwise an
-- echo edit or unfriend could overwrite a simultaneous game XP award.
create or replace function private.handle_echo_xp() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  word_owner uuid;
  unique_source text;
  recalculated_xp bigint;
begin
  select user_id into word_owner from public.daily_words
    where id = coalesce(new.daily_word_id, old.daily_word_id);
  if word_owner is null then return new; end if;
  perform 1 from public.profiles where id = word_owner for update;
  unique_source := coalesce(new.daily_word_id, old.daily_word_id)::text
    || ':' || coalesce(new.user_id, old.user_id)::text;
  if tg_op = 'DELETE' then
    delete from public.xp_events where user_id = word_owner
      and kind = 'echo_received'::public.xp_event_kind and source_key = unique_source;
  else
    insert into public.xp_events(user_id, kind, points, source_key)
    values(word_owner, 'echo_received', new.strength, unique_source)
    on conflict(user_id, kind, source_key) do update set points = excluded.points;
  end if;
  select coalesce(sum(points),0)::bigint into recalculated_xp
    from public.xp_events where user_id = word_owner;
  update public.profiles set xp = recalculated_xp,
    level = private.level_for_xp(recalculated_xp), updated_at = now() where id = word_owner;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function private.remove_friendship_xp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status <> 'accepted'::public.friendship_status then return old; end if;
  perform 1 from public.profiles where id in (old.requester_id, old.addressee_id) order by id for update;
  delete from public.xp_events where kind = 'friend_match'::public.xp_event_kind
    and source_key = 'friendship:' || old.id::text and user_id in (old.requester_id, old.addressee_id);
  with totals as (
    select profile.id, coalesce(sum(event.points),0)::bigint as xp
    from public.profiles profile left join public.xp_events event on event.user_id = profile.id
    where profile.id in (old.requester_id, old.addressee_id) group by profile.id
  )
  update public.profiles profile set xp = totals.xp,
    level = private.level_for_xp(totals.xp), updated_at = now()
  from totals where profile.id = totals.id;
  return old;
end;
$$;

-- Rewards also arrive for players who do not reopen the app after the reveal.
create extension if not exists pg_cron;
select cron.schedule('common-wurd-xp-reveal', '* * * * *', 'select private.settle_common_wurd_xp();');
select private.settle_common_wurd_xp();
