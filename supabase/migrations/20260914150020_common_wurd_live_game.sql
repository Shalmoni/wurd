-- Private game data: clients can only use the three authenticated RPC wrappers.
-- No XP/profile mutation, realtime publication, or cron is needed for reveal.
create table private.common_wurd_rounds (
  id text primary key,
  prompt text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at > starts_at)
);
create index common_wurd_round_times on private.common_wurd_rounds (starts_at, ends_at);
create table private.common_wurd_answers (
  round_id text not null references private.common_wurd_rounds(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  answer text not null check (length(answer) between 1 and 30),
  created_at timestamptz not null default clock_timestamp(),
  primary key (round_id, user_id)
);
create index common_wurd_answers_user on private.common_wurd_answers (user_id, round_id);
create table private.common_wurd_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  round_id text not null references private.common_wurd_rounds(id)
);
create index common_wurd_progress_round on private.common_wurd_progress (round_id);
alter table private.common_wurd_rounds enable row level security;
alter table private.common_wurd_answers enable row level security;
alter table private.common_wurd_progress enable row level security;
revoke all on private.common_wurd_rounds, private.common_wurd_answers, private.common_wurd_progress from public, anon, authenticated;

-- Deliberately privileged implementations live outside the exposed public schema.
-- auth.uid() is checked on every entry; no client-supplied user ID is accepted.
create function private.common_wurd_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
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
  insert into private.common_wurd_progress(user_id, round_id)
    select v_user, id from private.common_wurd_rounds where starts_at <= v_now and ends_at > v_now order by starts_at desc limit 1
    on conflict (user_id) do nothing;
  select r.* into v_round from private.common_wurd_rounds r
    join private.common_wurd_progress p on p.round_id = r.id where p.user_id = v_user;
  if v_round.id is null then return jsonb_build_object('server_now', v_now, 'round', null); end if;
  select answer into v_answer from private.common_wurd_answers where round_id = v_round.id and user_id = v_user;
  select count(*) into v_count from private.common_wurd_answers where round_id = v_round.id;
  -- Never load other players' answers into the response before expiration.
  if v_now >= v_round.ends_at then
    select coalesce(jsonb_agg(row_data order by count desc, answer), '[]'::jsonb) into v_rows from (
      select a.answer, count(*) as count,
        jsonb_build_object('answer', a.answer, 'count', count(*), 'usernames', jsonb_agg(p.username order by p.username)) as row_data
      from private.common_wurd_answers a join public.profiles p on p.id = a.user_id
      where a.round_id = v_round.id group by a.answer
    ) grouped;
    select count(*) into v_points from private.common_wurd_answers where round_id = v_round.id and answer = v_answer;
  end if;
  select count(*) into v_total_points
    from private.common_wurd_answers mine
    join private.common_wurd_rounds r on r.id = mine.round_id and r.ends_at <= v_now
    join private.common_wurd_answers matches on matches.round_id = mine.round_id and matches.answer = mine.answer
    where mine.user_id = v_user;
  return jsonb_build_object('server_now', v_now,
    'round', jsonb_build_object('id', v_round.id, 'prompt', v_round.prompt, 'starts_at', v_round.starts_at, 'ends_at', v_round.ends_at),
    'ended', v_now >= v_round.ends_at, 'my_answer', v_answer, 'answer_count', v_count,
    'results', v_rows, 'points', v_points, 'total_points', v_total_points);
end;
$$;

create function private.submit_common_wurd(p_round_id text, p_answer text) returns jsonb
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
  -- Serialize submissions/acknowledgements per person, including multiple devices.
  select round_id into v_progress from private.common_wurd_progress where user_id = v_user for update;
  if v_progress is distinct from p_round_id then raise exception 'Open the current round before answering.'; end if;
  select * into v_round from private.common_wurd_rounds where id = p_round_id;
  select answer into v_existing from private.common_wurd_answers where round_id = p_round_id and user_id = v_user;
  if v_existing is not null then
    if v_existing = v_answer then return private.common_wurd_state(); end if;
    raise exception 'Your answer is already locked.' using errcode = '23505';
  end if;
  if v_round.id is null or clock_timestamp() < v_round.starts_at or clock_timestamp() >= v_round.ends_at then
    raise exception 'This round has ended. Your answer was not submitted.' using errcode = '22023';
  end if;
  insert into private.common_wurd_answers(round_id, user_id, answer) values (p_round_id, v_user, v_answer);
  return private.common_wurd_state();
end;
$$;

create function private.acknowledge_common_wurd(p_round_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_current text;
  v_next text;
begin
  if v_user is null or not exists(select 1 from public.profiles where id = v_user) then
    raise exception 'Sign in to play.' using errcode = '28000';
  end if;
  select round_id into v_current from private.common_wurd_progress where user_id = v_user for update;
  if v_current is distinct from p_round_id then return private.common_wurd_state(); end if;
  if not exists(select 1 from private.common_wurd_rounds where id = p_round_id and ends_at <= clock_timestamp()) then
    raise exception 'Results are not ready yet.';
  end if;
  select id into v_next from private.common_wurd_rounds where starts_at <= clock_timestamp() and ends_at > clock_timestamp() order by starts_at desc limit 1;
  if v_next is null then raise exception 'The next round is not available yet.'; end if;
  update private.common_wurd_progress set round_id = v_next where user_id = v_user;
  return private.common_wurd_state();
end;
$$;

create function public.common_wurd_state() returns jsonb language sql security invoker set search_path = '' as $$ select private.common_wurd_state(); $$;
create function public.submit_common_wurd(p_round_id text, p_answer text) returns jsonb language sql security invoker set search_path = '' as $$ select private.submit_common_wurd(p_round_id, p_answer); $$;
create function public.acknowledge_common_wurd(p_round_id text) returns jsonb language sql security invoker set search_path = '' as $$ select private.acknowledge_common_wurd(p_round_id); $$;
revoke all on function private.common_wurd_state(), private.submit_common_wurd(text,text), private.acknowledge_common_wurd(text) from public, anon, authenticated;
revoke all on function public.common_wurd_state(), public.submit_common_wurd(text,text), public.acknowledge_common_wurd(text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.common_wurd_state(), private.submit_common_wurd(text,text), private.acknowledge_common_wurd(text) to authenticated;
grant execute on function public.common_wurd_state(), public.submit_common_wurd(text,text), public.acknowledge_common_wurd(text) to authenticated;

-- Fixed day order shared with lib/category-schedule.ts. Seed real clock boundaries,
-- not times relative to deployment. Two rounds per day for the first 100 days.
with prompts(day_offset, prompt) as (values
  (0, 'Name something you wouldn’t lend a stranger.'),
  (1, 'Name a quality of a good friend.'),
  (2, 'Name something you find on a beach.'),
  (3, 'Name somewhere people go on vacation.'),
  (4, 'Name something people lie about.'),
  (5, 'Name something you forget to charge.'),
  (6, 'Name something you take when leaving home.'),
  (7, 'Name somewhere you go on a date.'),
  (8, 'Name a fairy-tale character.'),
  (9, 'Name something people fear.'),
  (10, 'Name somewhere you wouldn’t want to get stuck.'),
  (11, 'Name something worth waiting for.'),
  (12, 'Name something you take to the beach.'),
  (13, 'Name a kitchen appliance.'),
  (14, 'Name a wild animal.'),
  (15, 'Name a board game.'),
  (16, 'Name a spice.'),
  (17, 'Name an accessory.'),
  (18, 'Name an animal.'),
  (19, 'Name something you see in the sky.'),
  (20, 'Name a bird.'),
  (21, 'Name a type of shoe.'),
  (22, 'Name something you shouldn’t touch.'),
  (23, 'Name an island.'),
  (24, 'Name something that ruins a date.'),
  (25, 'Name something round.'),
  (26, 'Name something you wear in winter.'),
  (27, 'Name a tree.'),
  (28, 'Name something red.'),
  (29, 'Name a city.'),
  (30, 'Name a musical instrument.'),
  (31, 'Name a superhero.'),
  (32, 'Name a job.'),
  (33, 'Name something you’d save from a fire.'),
  (34, 'Name a cartoon character.'),
  (35, 'Name something in a bedroom.'),
  (36, 'Name something sticky.'),
  (37, 'Name something loud.'),
  (38, 'Name a dessert.'),
  (39, 'Name a cheese.'),
  (40, 'Name a pet.'),
  (41, 'Name something you’d want on a deserted island.'),
  (42, 'Name something people argue about.'),
  (43, 'Name a planet.'),
  (44, 'Name an ice cream flavor.'),
  (45, 'Name something soft.'),
  (46, 'Name something you do before bed.'),
  (47, 'Name something you wear on your head.'),
  (48, 'Name something you pack for a trip.'),
  (49, 'Name a drink.'),
  (50, 'Name something you wear in summer.'),
  (51, 'Name a snack.'),
  (52, 'Name a farm animal.'),
  (53, 'Name something you do at a party.'),
  (54, 'Name something you take camping.'),
  (55, 'Name an insect.'),
  (56, 'Name a music genre.'),
  (57, 'Name a movie villain.'),
  (58, 'Name something green.'),
  (59, 'Name a fruit.'),
  (60, 'Name a hobby.'),
  (61, 'Name a video game.'),
  (62, 'Name a vegetable.'),
  (63, 'Name something yellow.'),
  (64, 'Name something that feels like home.'),
  (65, 'Name something you do when you’re bored.'),
  (66, 'Name something you always lose.'),
  (67, 'Name a continent.'),
  (68, 'Name something you do when you can’t sleep.'),
  (69, 'Name something you clean every day.'),
  (70, 'Name somewhere you have to be quiet.'),
  (71, 'Name a sport.'),
  (72, 'Name something that helps you relax.'),
  (73, 'Name something you do first thing in the morning.'),
  (74, 'Name something that makes people cry.'),
  (75, 'Name a pizza topping.'),
  (76, 'Name something you keep in a drawer.'),
  (77, 'Name a flower.'),
  (78, 'Name a sauce.'),
  (79, 'Name somewhere children love going.'),
  (80, 'Name something that makes someone attractive.'),
  (81, 'Name somewhere you wait in line.'),
  (82, 'Name something in a bathroom.'),
  (83, 'Name a country.'),
  (84, 'Name something you keep in your pocket.'),
  (85, 'Name something fragile.'),
  (86, 'Name a toy.'),
  (87, 'Name something that smells good.'),
  (88, 'Name something you put in a sandwich.'),
  (89, 'Name a breakfast food.'),
  (90, 'Name something that makes people smile.'),
  (91, 'Name something you’d buy if you became rich.'),
  (92, 'Name a color.'),
  (93, 'Name something people wish they had more of.'),
  (94, 'Name a nut.'),
  (95, 'Name something expensive.'),
  (96, 'Name a feeling.'),
  (97, 'Name a sea creature.'),
  (98, 'Name something you hang on a wall.'),
  (99, 'Name a piece of furniture.')
), slots as (
  select day_offset, prompt, slot,
    date '2026-09-14' + day_offset + time '03:00' + slot * interval '12 hours' as local_start
  from prompts cross join generate_series(0,1) slot
)
insert into private.common_wurd_rounds(id, prompt, starts_at, ends_at)
select to_char(local_start, 'YYYY-MM-DD-HH24'), prompt,
  local_start at time zone 'Asia/Jerusalem',
  (local_start + interval '12 hours') at time zone 'Asia/Jerusalem'
from slots;
