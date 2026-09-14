-- No lasting changes to users, answers, balances, or levels.
begin;
do $$
declare
  users uuid[];
  player uuid;
  round_id text := 'xp-test-' || gen_random_uuid()::text;
  solo_id text := 'xp-solo-' || gen_random_uuid()::text;
  state jsonb;
  baselines jsonb;
begin
  perform private.settle_common_wurd_xp();
  select array_agg(id) into users from (select id from public.profiles order by id limit 4) p;
  assert array_length(users,1) = 4, 'Need four existing profiles for rollback-only tests';
  select jsonb_object_agg(id::text,xp) into baselines from public.profiles where id = any(users);
  assert not has_function_privilege('authenticated','private.settle_common_wurd_xp()','EXECUTE'), 'Client can settle directly';
  assert not has_function_privilege('anon','private.settle_common_wurd_xp()','EXECUTE'), 'Anonymous settlement access';

  insert into private.common_wurd_rounds(id,prompt,starts_at,ends_at)
    values(round_id,'Test matches',clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour');
  insert into private.common_wurd_answers(round_id,user_id,answer)
    values(round_id,users[1],'orange'),(round_id,users[2],'orange'),(round_id,users[3],'orange'),(round_id,users[4],'blue');
  perform private.settle_common_wurd_xp();
  assert not exists(select 1 from public.xp_events where source_key = 'common_wurd:' || round_id), 'Open round paid XP';

  update private.common_wurd_rounds set ends_at = clock_timestamp()-interval '1 second' where id = round_id;
  perform private.settle_common_wurd_xp();
  foreach player in array users loop
    assert (select points from public.xp_events where user_id = player and kind = 'common_wurd' and source_key = 'common_wurd:' || round_id)
      = case when player = users[4] then 1 else 3 end, 'Match count was not exact (including self)';
    assert (select xp from public.profiles where id = player)
      = (baselines->>player::text)::bigint + case when player = users[4] then 1 else 3 end, 'Profile XP incorrect';
    assert (select level = private.level_for_xp(xp) from public.profiles where id = player), 'Level out of sync';
  end loop;
  perform private.settle_common_wurd_xp();
  -- Even replaying an unsettled marker cannot duplicate the ledger event.
  update private.common_wurd_rounds set xp_settled_at = null where id = round_id;
  perform private.settle_common_wurd_xp();
  assert (select count(*) from public.xp_events where source_key = 'common_wurd:' || round_id) = 4, 'Duplicate rewards';
  assert (select xp from public.profiles where id = users[1]) = (baselines->>users[1]::text)::bigint+3, 'Replay doubled profile XP';

  perform set_config('request.jwt.claim.sub',users[1]::text,true);
  insert into private.common_wurd_progress(user_id,round_id) values(users[1],round_id)
    on conflict(user_id) do update set round_id = excluded.round_id;
  state := public.common_wurd_state();
  assert (state->>'xp_awarded')::int = 3 and (state->>'points')::int = 3, 'Result reward differs from ledger';
  assert (state->>'profile_xp')::bigint = (baselines->>users[1]::text)::bigint+3, 'Client XP sync incorrect';

  -- Another completed round awards independently, even with the same answer.
  insert into private.common_wurd_rounds(id,prompt,starts_at,ends_at)
    values(solo_id,'Test solo',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour');
  insert into private.common_wurd_answers(round_id,user_id,answer) values(solo_id,users[1],'orange');
  perform private.settle_common_wurd_xp();
  assert (select xp from public.profiles where id = users[1]) = (baselines->>users[1]::text)::bigint+4, 'Separate round/solo XP incorrect';
end;
$$;
rollback;
