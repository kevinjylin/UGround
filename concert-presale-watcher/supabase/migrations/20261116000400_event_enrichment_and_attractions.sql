-- Richer event rows, and artist watches matched by Ticketmaster attraction.

-- What a show looks like and costs, and who else is on the bill. Filled from
-- the source payload when it has them; a change in these alone never alerts.
alter table public.events
  add column if not exists image_url text,
  add column if not exists price_min numeric(10, 2),
  add column if not exists price_max numeric(10, 2),
  add column if not exists price_currency text check (price_currency is null or char_length(price_currency) = 3),
  -- Other acts on the bill, headliner excluded.
  add column if not exists lineup text[] not null default '{}';

-- Cross-source dedupe looks up a user's rows for one artist by key prefix
-- (artist::venue::day), so index the key for prefix matches within a user.
create index if not exists events_user_dedupe_prefix_idx
  on public.events (user_id, dedupe_key text_pattern_ops);

-- The Ticketmaster attraction an artist watch resolved to. Events are then
-- searched by attraction id instead of by keyword. checked_at records the
-- last lookup, so an artist Ticketmaster doesn't list is looked up again
-- now and then instead of on every poll.
alter table public.watch_artists
  add column if not exists ticketmaster_attraction_id text,
  add column if not exists ticketmaster_attraction_checked_at timestamptz;

-- Renaming a watch means a different artist, so look it up again.
create or replace function public.reset_watch_artist_attraction()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.name is distinct from old.name then
    new.ticketmaster_attraction_id := null;
    new.ticketmaster_attraction_checked_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists watch_artists_reset_attraction on public.watch_artists;
create trigger watch_artists_reset_attraction
before update of name on public.watch_artists
for each row
execute function public.reset_watch_artist_attraction();
