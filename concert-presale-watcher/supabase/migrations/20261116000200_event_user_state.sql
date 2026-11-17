-- Per-show actions and the paged show feed.

-- What the user did with a show in their feed. Events rows are already per
-- user, so the state lives on the row. Poll upserts don't send this column,
-- so a re-check leaves it alone.
alter table public.events
  add column if not exists user_state text
    check (user_state in ('interested', 'going', 'hidden'));

-- The feed reads one user's shows by date.
create index if not exists events_user_start_idx
  on public.events (user_id, start_time);

create index if not exists events_user_state_idx
  on public.events (user_id, user_state)
  where user_state is not null;

-- Latest alert per show, for the "Recent change" sort and "Changed today".
create index if not exists alerts_event_created_idx
  on public.alerts (event_id, created_at desc);

-- Which part of the feed a show belongs to. A show stays upcoming until six
-- hours after it starts, and a show with no date stays upcoming.
create or replace function public.feed_view_of(p_start_time timestamptz, p_user_state text)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when p_user_state = 'hidden' then 'hidden'
    when p_start_time is not null and p_start_time < now() - interval '6 hours' then 'past'
    else 'upcoming'
  end;
$$;

-- One user's shows in a view ('upcoming', 'past', 'hidden', or 'all'),
-- narrowed by a search over artist, venue and city, and by what found the
-- show: p_source 'artist' (any artist watch, or the one in p_source_id) or
-- 'rule' (the venue or area watch in p_source_id).
create or replace function public.feed_events_base(
  p_user_id uuid,
  p_view text,
  p_query text,
  p_source text,
  p_source_id uuid
)
returns setof public.events
language sql
stable
security invoker
set search_path = ''
as $$
  with pattern as (
    select case
      when nullif(btrim(p_query), '') is null then null
      else '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    end as value
  )
  select e.*
  from public.events e, pattern
  -- events.user_id is text in databases that predate Supabase Auth and uuid
  -- in fresh ones, so compare as text. On a text column the cast is a no-op
  -- and the (user_id, ...) indexes still apply.
  where e.user_id::text = p_user_id::text
    and (p_view = 'all' or public.feed_view_of(e.start_time, e.user_state) = p_view)
    and (
      pattern.value is null
      or e.artist_name ilike pattern.value
      or e.venue ilike pattern.value
      or e.city ilike pattern.value
    )
    and (
      p_source is null
      or (p_source = 'artist' and e.watch_artist_id is not null
          and (p_source_id is null or e.watch_artist_id = p_source_id))
      or (p_source = 'rule' and e.watch_rule_id = p_source_id)
    );
$$;

-- A page of the feed. p_filter is the status tab: 'all', 'onsale',
-- 'scheduled', 'changed_today' (an alert in the last day) or 'saved'
-- (interested or going). p_sort is 'recent_change' (latest alert, else when
-- the show was first saved), 'date_soonest' (newest first in the past view)
-- or 'artist_az'.
create or replace function public.list_feed_events(
  p_user_id uuid,
  p_view text default 'upcoming',
  p_filter text default 'all',
  p_query text default null,
  p_source text default null,
  p_source_id uuid default null,
  p_sort text default 'recent_change',
  p_limit integer default 50,
  p_offset integer default 0
)
returns setof public.events
language sql
stable
security invoker
set search_path = ''
as $$
  select e.*
  from public.feed_events_base(p_user_id, p_view, p_query, p_source, p_source_id) e
  left join lateral (
    select max(a.created_at) as last_alert_at
    from public.alerts a
    where a.event_id = e.id
  ) latest on true
  where case p_filter
    when 'all' then true
    when 'onsale' then e.status = 'onsale'
    when 'scheduled' then e.status = 'scheduled'
    when 'saved' then e.user_state in ('interested', 'going')
    when 'changed_today' then latest.last_alert_at >= now() - interval '1 day'
    else false
  end
  order by
    case when p_sort = 'recent_change' then greatest(e.created_at, latest.last_alert_at) end desc nulls last,
    case when p_sort = 'date_soonest' and p_view <> 'past' then e.start_time end asc nulls last,
    case when p_sort = 'date_soonest' and p_view = 'past' then e.start_time end desc nulls last,
    e.artist_name,
    e.title,
    e.id
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Counts for the feed's tabs and view switch under the same search and
-- source filter, plus the unfiltered upcoming and on-sale totals for the
-- page headline.
create or replace function public.feed_event_counts(
  p_user_id uuid,
  p_view text default 'upcoming',
  p_query text default null,
  p_source text default null,
  p_source_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with matched as (
    select
      e.status,
      e.user_state,
      public.feed_view_of(e.start_time, e.user_state) as feed_view,
      exists (
        select 1
        from public.alerts a
        where a.event_id = e.id
          and a.created_at >= now() - interval '1 day'
      ) as changed_today
    from public.feed_events_base(p_user_id, 'all', p_query, p_source, p_source_id) e
  ),
  totals as (
    select
      count(*) as upcoming_total,
      count(*) filter (where e.status = 'onsale') as onsale_total
    from public.feed_events_base(p_user_id, 'upcoming', null, null, null) e
  )
  select jsonb_build_object(
    'all', count(*) filter (where m.feed_view = p_view),
    'onsale', count(*) filter (where m.feed_view = p_view and m.status = 'onsale'),
    'scheduled', count(*) filter (where m.feed_view = p_view and m.status = 'scheduled'),
    'changed_today', count(*) filter (where m.feed_view = p_view and m.changed_today),
    'saved', count(*) filter (where m.feed_view = p_view and m.user_state in ('interested', 'going')),
    'upcoming', count(*) filter (where m.feed_view = 'upcoming'),
    'past', count(*) filter (where m.feed_view = 'past'),
    'hidden', count(*) filter (where m.feed_view = 'hidden'),
    'upcoming_total', (select upcoming_total from totals),
    'onsale_total', (select onsale_total from totals)
  )
  from matched m;
$$;

revoke all on function public.feed_view_of(timestamptz, text) from public, anon, authenticated;
revoke all on function public.feed_events_base(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.list_feed_events(uuid, text, text, text, text, uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.feed_event_counts(uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.feed_view_of(timestamptz, text) to service_role;
grant execute on function public.feed_events_base(uuid, text, text, text, uuid) to service_role;
grant execute on function public.list_feed_events(uuid, text, text, text, text, uuid, text, integer, integer) to service_role;
grant execute on function public.feed_event_counts(uuid, text, text, text, uuid) to service_role;
