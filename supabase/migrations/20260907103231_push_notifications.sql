create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  friend_requests boolean not null default true,
  friend_words boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "users read their own push devices"
on public.push_subscriptions for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users register their own push devices"
on public.push_subscriptions for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "users update their own push devices"
on public.push_subscriptions for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users remove their own push devices"
on public.push_subscriptions for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant usage on sequence public.push_subscriptions_id_seq to authenticated;

-- Delivery records are server-only. Their unique key makes notification sends
-- idempotent when a slow phone retries the same successful action.
create table public.push_deliveries (
  id bigint generated always as identity primary key,
  event_kind text not null check (event_kind in ('friend_request', 'friend_word')),
  source_id bigint not null,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id bigint not null references public.push_subscriptions(id) on delete cascade,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (event_kind, source_id, subscription_id)
);

create index push_deliveries_recipient_created_idx
on public.push_deliveries (recipient_id, created_at desc);

alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from public, anon, authenticated;

create or replace function private.touch_push_subscription()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.last_seen_at := now();
  return new;
end;
$$;

revoke all on function private.touch_push_subscription() from public, anon, authenticated;

create trigger touch_push_subscription_before_update
before update on public.push_subscriptions
for each row execute function private.touch_push_subscription();
