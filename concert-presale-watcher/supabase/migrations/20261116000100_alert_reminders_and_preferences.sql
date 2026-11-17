-- Sale-window reminders, quiet artist baselines, alert preferences, push as
-- a delivery channel, and a poll cadence that fits source quotas.

-- 1. Two reminder alert types driven by a stored sale window's starts_at.
alter table public.alerts drop constraint if exists alerts_alert_type_check;
alter table public.alerts add constraint alerts_alert_type_check check (
  alert_type in (
    'new_event',
    'status_changed',
    'ticket_url_changed',
    'on_sale_moved_earlier',
    'presale_announced',
    'presale_opened',
    'public_sale_announced',
    'public_sale_opened',
    'sale_opens_soon',
    'sale_open_now'
  )
);

-- 2. Browser push joins discord, email, and sms. A delivery can be held for
--    quiet hours (it goes out at next_attempt_at) or for the daily email
--    digest (the dispatcher sends it with the user's other held emails).
alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_channel_check;
alter table public.notification_deliveries
  add constraint notification_deliveries_channel_check
  check (channel in ('discord', 'email', 'sms', 'push'));

alter table public.notification_deliveries
  add column if not exists held_reason text
  check (held_reason in ('quiet_hours', 'digest'));

create index if not exists notification_deliveries_digest_idx
  on public.notification_deliveries (alert_id)
  where held_reason = 'digest' and status = 'pending';

-- 3. Artist watches get a quiet first check per source, like venue and area
--    watches. Each source an artist rule has been checked with once is listed
--    here; until a source is listed, its results are saved without alerts.
alter table public.watch_rules
  add column if not exists baseline_sources text[] not null default '{}';

-- Artist rules that were already checked keep alerting: count a source as
-- baselined when it found shows for the rule or its job has run cleanly.
update public.watch_rules r
set baseline_sources = coalesce((
      select array_agg(distinct s.source_slug)
      from (
        select e.source_slug
        from public.events e
        where e.watch_artist_id = r.legacy_watch_artist_id
        union
        select j.source_slug
        from public.poll_jobs j
        where j.target_type = 'legacy_user'
          and j.target_id = r.user_id::text || ':' || r.legacy_watch_artist_id::text
          and j.attempts > 0
          and j.last_error is null
      ) s
    ), '{}'),
    baseline_at = coalesce(r.baseline_at, case
      when exists (
        select 1 from public.events e where e.watch_artist_id = r.legacy_watch_artist_id
      ) then now()
    end)
where r.kind = 'artist'
  and r.legacy_watch_artist_id is not null
  and r.baseline_sources = '{}';

create or replace function public.mark_artist_source_baselined(
  p_rule_id uuid,
  p_source text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.watch_rules
  set baseline_sources = case
        when p_source = any(baseline_sources) then baseline_sources
        else array_append(baseline_sources, p_source)
      end,
      baseline_at = coalesce(baseline_at, now())
  where id = p_rule_id;
$$;

-- 4. Alert preferences. One row per user; a missing row means the defaults.
--    channel_alert_types maps a channel to the alert types it gets, for
--    example {"sms": ["presale_opened", "sale_opens_soon"]}. A channel left
--    out gets every type. Quiet hours are minutes after local midnight.
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  time_zone text,
  reminder_lead_minutes integer not null default 60
    check (reminder_lead_minutes between 5 and 2880),
  quiet_hours_enabled boolean not null default false,
  quiet_hours_start smallint not null default 1320
    check (quiet_hours_start between 0 and 1439),
  quiet_hours_end smallint not null default 480
    check (quiet_hours_end between 0 and 1439),
  email_digest boolean not null default false,
  channel_alert_types jsonb not null default '{}'::jsonb
    check (jsonb_typeof(channel_alert_types) = 'object'),
  digest_last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;
revoke all on table public.notification_preferences from anon, authenticated;

-- 5. Reminder candidates: sale windows starting in [p_from, p_to] on shows
--    that are still ahead and that the user hasn't hidden. user_state is read
--    through to_jsonb so this works before or after that column exists.
create or replace function public.list_sale_window_reminders(
  p_from timestamptz,
  p_to timestamptz,
  p_limit integer default 500
)
returns table (event_id uuid, user_id text, sale_window jsonb, starts_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  -- events.user_id is text in databases that predate Supabase Auth, and some
  -- old rows hold ids that aren't UUIDs. Those have no account to alert, so
  -- they are left out here instead of being cast.
  select e.id, e.user_id::text, w.value, (w.value ->> 'starts_at')::timestamptz
  from public.events e
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(e.sale_windows) = 'array' then e.sale_windows else '[]'::jsonb end
  ) as w(value)
  where e.sale_windows <> '[]'::jsonb
    and e.user_id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and coalesce(w.value ->> 'starts_at', '') <> ''
    and (w.value ->> 'starts_at')::timestamptz between p_from and p_to
    and coalesce(to_jsonb(e) ->> 'user_state', '') <> 'hidden'
    and e.status <> 'cancelled'
    and (e.start_time is null or e.start_time > now())
  order by 4
  limit least(greatest(p_limit, 1), 2000);
$$;

revoke all on function public.mark_artist_source_baselined(uuid, text) from public, anon, authenticated;
revoke all on function public.list_sale_window_reminders(timestamptz, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.mark_artist_source_baselined(uuid, text) to service_role;
grant execute on function public.list_sale_window_reminders(timestamptz, timestamptz, integer) to service_role;

-- 6. Poll cadence. Jobs used to run every 30 minutes for six sources, which
--    at a per-minute dispatcher would exceed Ticketmaster's 5000 calls a day.
--    The app now sets 12 hours by default and 3 hours while a followed show
--    has a sale window in the next three days. AXS and DICE have no runner.
delete from public.poll_jobs where source_slug in ('axs', 'dice');

update public.poll_jobs
set cadence_seconds = 43200
where cadence_seconds < 43200;
