-- Run against the migrated database. All test data and cursor changes roll back.
begin;
do $$
declare
  users uuid[];
  state jsonb;
  current_id text;
  test_round text := 'test-' || gen_random_uuid()::text;
  old_xp bigint;
  blocked boolean;
begin
  select array_agg(id) into users from (select id from public.profiles order by created_at limit 3) p;
  assert array_length(users, 1) = 3, 'Need three existing profiles for rollback-only role tests';
  assert not has_function_privilege('anon', 'public.common_wurd_state()', 'EXECUTE'), 'Anonymous RPC access';
  assert not has_function_privilege('anon', 'private.common_wurd_state()', 'EXECUTE'), 'Anonymous internal access';
  assert not has_table_privilege('authenticated', 'private.common_wurd_answers', 'SELECT,INSERT,UPDATE,DELETE'), 'Direct answer access';
  assert not has_table_privilege('authenticated', 'private.common_wurd_progress', 'UPDATE'), 'Cursor bypass';
  assert not exists(select 1 from pg_proc where oid in ('public.common_wurd_state()'::regprocedure, 'public.submit_common_wurd(text,text)'::regprocedure, 'public.acknowledge_common_wurd(text)'::regprocedure) and prosecdef), 'Public wrapper is privileged';

  perform set_config('request.jwt.claim.sub', '', true);
  blocked := false;
  begin perform private.common_wurd_state(); exception when invalid_authorization_specification then blocked := true; end;
  assert blocked, 'Missing identity accepted';

  perform set_config('request.jwt.claim.sub', users[1]::text, true);
  perform private.settle_common_wurd_xp();
  select xp into old_xp from public.profiles where id = users[1];
  -- Work only on current-round rows in this rollback-only transaction.
  select id into current_id from private.common_wurd_rounds where starts_at <= clock_timestamp() and ends_at > clock_timestamp();
  insert into private.common_wurd_progress values(users[1], current_id) on conflict(user_id) do update set round_id = excluded.round_id;
  delete from private.common_wurd_answers where round_id = current_id and user_id = any(users);
  perform set_config('role', 'authenticated', true);
  state := public.submit_common_wurd(current_id, ' TABLE ');
  assert state->>'my_answer' = 'table', 'Normalization or non-category answer rejected';
  assert state->'results' = '[]'::jsonb, 'Early answer leak';
  assert (state->>'points')::int = 0, 'Unrevealed points leak';
  state := public.submit_common_wurd(current_id, 'table');
  blocked := false;
  begin perform public.submit_common_wurd(current_id, 'orange'); exception when unique_violation then blocked := true; end;
  assert blocked, 'Editing accepted';
  blocked := false;
  begin perform public.submit_common_wurd(current_id, 'two words'); exception when invalid_parameter_value then blocked := true; end;
  assert blocked, 'Multiple words accepted';
  blocked := false;
  begin perform public.acknowledge_common_wurd(current_id); exception when raise_exception then blocked := true; end;
  assert blocked, 'Round skipped before reveal';
  perform set_config('role', 'none', true);
  assert (select count(*) from private.common_wurd_answers where round_id = current_id and user_id = users[1]) = 1, 'Duplicate submission';
  assert (select xp from public.profiles where id = users[1]) = old_xp, 'XP awarded before reveal';

  perform set_config('request.jwt.claim.sub', users[2]::text, true);
  insert into private.common_wurd_progress values(users[2], current_id) on conflict(user_id) do update set round_id = excluded.round_id;
  state := public.common_wurd_state();
  assert state->>'my_answer' is null and state->'results' = '[]'::jsonb, 'Other player answer leaked';

  insert into private.common_wurd_rounds(id, prompt, starts_at, ends_at) values(test_round, 'Name a color.', clock_timestamp() - interval '13 hours', clock_timestamp() - interval '1 hour');
  insert into private.common_wurd_answers(round_id, user_id, answer) values(test_round, users[1], 'red'), (test_round, users[2], 'red'), (test_round, users[3], 'blue');
  update private.common_wurd_progress set round_id = test_round where user_id in (users[1],users[2]);
  state := public.common_wurd_state();
  assert (state->>'ended')::boolean, 'Past round not revealed';
  assert state->'results'->0->>'answer' = 'red' and (state->'results'->0->>'count')::int = 2, 'Result sorting/count wrong';
  assert (state->>'points')::int = 2 and (state->>'answer_count')::int = 3, 'Group-size score wrong';
  assert (public.common_wurd_state()->'round'->>'id') = test_round, 'Reload skipped pending results';
  state := public.acknowledge_common_wurd(test_round);
  assert state->'round'->>'id' = current_id, 'Could not enter next round after results';
  perform set_config('request.jwt.claim.sub', users[3]::text, true);
  insert into private.common_wurd_progress values(users[3], test_round) on conflict(user_id) do update set round_id = excluded.round_id;
  delete from private.common_wurd_answers where round_id = test_round and user_id = users[3];
  blocked := false;
  begin perform public.submit_common_wurd(test_round, 'green'); exception when invalid_parameter_value then blocked := true; end;
  assert blocked, 'Late submission accepted';
end;
$$;
rollback;
