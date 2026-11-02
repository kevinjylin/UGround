-- Venue and area watching.

-- Set after a rule's first successful check. Until then, shows found for the
-- rule are saved without alerts, so following a busy area doesn't send a
-- burst of "new show" messages for everything already on sale.
alter table public.watch_rules
  add column if not exists baseline_at timestamptz;

-- Which venue or area rule found an event. Artist-watch events keep using
-- watch_artist_id. Rule deletion removes its events in app code, so an event
-- that an artist watch also covers survives.
alter table public.events
  add column if not exists watch_rule_id uuid references public.watch_rules(id) on delete set null;

create index if not exists events_watch_rule_idx
  on public.events (watch_rule_id)
  where watch_rule_id is not null;

create index if not exists watch_rules_venue_idx
  on public.watch_rules (venue_id)
  where venue_id is not null;

create index if not exists venues_ticketmaster_ref_idx
  on public.venues ((source_refs ->> 'ticketmaster'));

-- A venue job is shared by everyone who follows that venue, so it belongs to
-- no single user (and deleting one account must not delete it).
update public.poll_jobs
set user_id = null
where target_type = 'venue';

-- Only Ticketmaster can search by venue or area. Drop the jobs no source can run.
delete from public.poll_jobs
where target_type in ('venue', 'location')
  and source_slug <> 'ticketmaster';

-- These were deferred a day at a time while unsupported. Run them now.
update public.poll_jobs
set next_poll_at = now(),
    last_error = null,
    attempts = 0
where target_type in ('venue', 'location');
