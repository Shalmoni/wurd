-- Either participant can end an accepted friendship. Deleting the single
-- relationship row removes it for both users.
create policy "participants can end accepted friendships"
on public.friendships for delete to authenticated
using (
  status = 'accepted'::public.friendship_status
  and (select auth.uid()) in (requester_id, addressee_id)
);

grant delete on public.friendships to authenticated;

-- Friendship XP represents a current friendship, so remove it from both
-- profiles when that friendship ends. This also prevents XP farming by
-- repeatedly unfriending and reconnecting.
create or replace function private.remove_friendship_xp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'accepted'::public.friendship_status then
    return old;
  end if;

  delete from public.xp_events
  where kind = 'friend_match'::public.xp_event_kind
    and source_key = 'friendship:' || old.id::text
    and user_id in (old.requester_id, old.addressee_id);

  with totals as (
    select profile.id, coalesce(sum(event.points), 0)::bigint as xp
    from public.profiles profile
    left join public.xp_events event on event.user_id = profile.id
    where profile.id in (old.requester_id, old.addressee_id)
    group by profile.id
  )
  update public.profiles profile
  set xp = totals.xp,
      level = private.level_for_xp(totals.xp),
      updated_at = now()
  from totals
  where profile.id = totals.id;

  return old;
end;
$$;

revoke all on function private.remove_friendship_xp() from public, anon, authenticated;

drop trigger if exists remove_friendship_xp_after_delete on public.friendships;
create trigger remove_friendship_xp_after_delete
after delete on public.friendships
for each row execute function private.remove_friendship_xp();
