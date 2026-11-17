-- Browser push subscriptions: one row per browser a user turned push on in.
-- The endpoint is unique to a browser profile, so subscribing again from the
-- same browser (even signed in as someone else) replaces the row.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  -- Short label such as "Chrome on macOS", derived from the user agent.
  user_agent_label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- The app reaches this table with the service role only.
revoke all on table public.push_subscriptions from anon, authenticated;
