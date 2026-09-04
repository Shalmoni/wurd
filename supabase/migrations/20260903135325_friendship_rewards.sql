-- Award both people once when a friendship becomes accepted.
-- friend_match is the existing friendship-related XP event kind.
create or replace function private.award_friendship_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'accepted'::public.friendship_status then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'accepted'::public.friendship_status then
    return new;
  end if;

  perform private.award_xp(
    new.requester_id,
    'friend_match'::public.xp_event_kind,
    10,
    'friendship:' || new.id::text
  );
  perform private.award_xp(
    new.addressee_id,
    'friend_match'::public.xp_event_kind,
    10,
    'friendship:' || new.id::text
  );
  return new;
end;
$$;

revoke all on function private.award_friendship_xp() from public, anon, authenticated;

drop trigger if exists award_friendship_xp_after_accept on public.friendships;
create trigger award_friendship_xp_after_accept
after insert or update of status on public.friendships
for each row execute function private.award_friendship_xp();
