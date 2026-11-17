# UGround

Watch-and-alert site for artists.

This repo is now set up as:

- `apps/web`: Next.js dashboard + API routes
- `apps/worker`: polling worker (calls `POST /api/poll` on an interval)
- `supabase/migrations`: versioned production schema and scheduler changes
- `database/schema.sql`: bootstrap-only legacy schema

## MVP flow

1. Add artists to your watchlist (manual or Spotify artist ID import).
2. Poll Ticketmaster + Eventbrite for each followed artist.
3. Normalize to one `events` table and snapshot raw source payloads.
4. Detect changes (`new_event`, `status_changed`, `ticket_url_changed`, `on_sale_moved_earlier`).
5. Send alerts to Discord/email/SMS when configured.

## Database setup (Supabase Postgres)

1. Create a Supabase project.
2. Link the Supabase CLI and apply `supabase/migrations` in timestamp order.
3. Copy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` into `apps/web/.env.local`.
4. Run [`database/supabase-auth-cutover.sql`](./database/supabase-auth-cutover.sql) only when migrating an existing custom-auth database with no users to preserve.

## Environment

Copy examples:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/worker/.env.example apps/worker/.env
```

Set whichever integrations you want:

- Ticketmaster: `TICKETMASTER_API_KEY`
- Eventbrite: `EVENTBRITE_PRIVATE_TOKEN`
- Spotify import: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- Email alerts: `RESEND_API_KEY`, `ALERT_FROM_EMAIL`
- SMS alerts: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_PHONE`
- Per-user alert destinations: users enter Discord webhooks, email addresses, and phone numbers in the dashboard.
- Alert settings encryption: `ALERT_SETTINGS_ENCRYPTION_KEY` (generate with `openssl rand -base64 32`)
- Supabase Auth: enable Email and Google in the Supabase dashboard. Google client id/secret live in Supabase, not this app.
- Canonical links: `APP_URL=https://www.uground.app`
- Detailed health checks: `INTERNAL_HEALTH_SECRET`
- Partner feeds: `SONGKICK_API_KEY`, `BANDSINTOWN_APP_ID`
- Browser push: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, optional `VAPID_SUBJECT` (for example `mailto:you@yourdomain`). Generate the keys with `npx web-push generate-vapid-keys`. Without them the push channel shows as unavailable.
- Dispatcher interval: `DISPATCH_INTERVAL_MINUTES` (default `1440`). Set it to how often `/api/internal/dispatch` is called, so sale reminders and the daily digest are timed correctly.
- Connect Spotify: add `<APP_URL>/api/integrations/spotify/callback` to the Redirect URIs of the Spotify app. For local use Spotify only accepts `http://127.0.0.1:3000/...`, not `localhost`. While the Spotify app is in development mode, only accounts added under User Management can connect.

Optional poll protection:

- Set `POLL_SECRET` in web and worker.
- Set `CRON_SECRET` in Vercel if you use the built-in scheduled poll.

Supabase Auth redirect URLs:

- Local: `http://localhost:3000/auth/callback`
- Production: `https://<your-vercel-domain>/auth/callback`
- Google Cloud OAuth should use Supabase's callback URL: `https://<your-project>.supabase.co/auth/v1/callback`

## Run

From `concert-presale-watcher`:

```bash
npm ci
npm run dev
```

Then run worker in another shell:

```bash
npm run dev --workspace=@apps/worker
```

Open `http://localhost:3000`.

## API routes

- `GET/POST /api/watchlist`
- `PATCH/DELETE /api/watchlist/:id` (PATCH changes an artist's location and radius)
- `GET/POST /api/watch-rules`
- `DELETE /api/watch-rules/:id`
- `GET/PUT /api/profile` (saved home location)
- `POST /api/watchlist/import-spotify`
- `POST /api/integrations/spotify/import-preview`
- `POST /api/integrations/spotify/import` (a playlist, or `account: true` after Connect Spotify)
- `GET /api/integrations/spotify/start`, `GET /api/integrations/spotify/callback`, `GET /api/integrations/spotify/account-artists`
- `GET /api/events` (paged feed: `view`, `filter`, `sort`, `q`, `source`, `limit`, `offset`, `counts=1`)
- `PATCH /api/events/:id` (interested, going, hidden)
- `GET /api/events/:id/calendar` (.ics download)
- `GET /api/alerts`
- `GET /api/search/venues` (Ticketmaster venue search for venue watches)
- `GET /api/source-status`
- `GET/PUT /api/notification-settings`
- `POST /api/notification-settings/test-discord`
- `POST /api/notification-settings/send-email-confirmation`
- `GET /api/notification-settings/confirm-email`
- `POST /api/notification-settings/send-sms-confirmation`
- `POST /api/notification-settings/confirm-sms`
- `GET/POST /api/notification-settings/unsubscribe` (public, signed link in every alert email)
- `GET /api/push/public-key`, `POST /api/push/subscribe`, `POST /api/push/unsubscribe`, `POST /api/push/status`, `POST /api/push/test`
- `POST /api/poll` (authenticated refresh queue)
- `POST /api/internal/dispatch` (secret-protected worker)
- `GET /api/cron/poll` (compatibility dispatcher)
- `GET /api/health`
- `GET /api/account/export`
- `DELETE /api/account`

## Deploy To Vercel

1. Import this repo into Vercel.
2. Set the Vercel project **Root Directory** to `concert-presale-watcher/apps/web`.
3. Add environment variables in Vercel Project Settings:
   - Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - Optional integrations: Ticketmaster/Songkick/Bandsintown/Spotify/Resend/Twilio/CRON_SECRET
   - Required canonical origin: `APP_URL`
   - Required for user alert destinations: `ALERT_SETTINGS_ENCRYPTION_KEY`
4. Deploy.

Notes:

- Supabase Auth protects the site and API with a `/login` page.
- Apply every file in `supabase/migrations` before deploying code that depends on it. The feed, the event save path and adding artists all use columns and functions from the `20261116` migrations and fail without them.
- Optional per-minute scheduler: set `app.settings.dispatch_url` and `app.settings.cron_secret` in Supabase, run `20260609000200_schedule_dispatch.sql`, and set `DISPATCH_INTERVAL_MINUTES=1`. It calls `/api/internal/dispatch` every minute. Each watch still polls its source every 12 hours, or every 3 hours while a followed show has a sale in the next 3 days, which keeps Ticketmaster use inside its daily quota. Jobs are only created for sources that have credentials.
- GitHub Actions `poll.yml` runs once daily at 03:17 UTC (8:17 PM PDT / 7:17 PM PST) and supports manual runs as a fallback to the primary Supabase scheduler. It calls the dispatcher repeatedly until the response reports `drained: true`; the first call passes `?sync=1`, which adds queue jobs for any followed artist that has none. Set the repository's `CRON_SECRET` secret to match the deployed app; the optional `POLL_URL` repository variable must point to the POST dispatcher endpoint.
- A separately deployed worker can consume the same queue with `WORKER_POLL_URL=https://<your-domain>/api/internal/dispatch`, `POLL_SECRET`, and `POLL_INTERVAL_MINUTES`.

## Notes

- User refreshes enqueue bounded work and never receive infrastructure secrets.
- If alert provider keys or user destinations are missing, alerts are still stored in DB.
- Artist watches match by Ticketmaster attraction, with a strict name match as the fallback. An artist's city searches a radius around it (50 miles by default) for the US markets in `lib/locations.ts`.
- The first check of a newly followed artist saves its shows without alerting, and runs inline when one artist is added. Later checks alert on new and changed shows.
- A show found by more than one source is saved once, preferring Ticketmaster.
- Each dispatch run also sends sale reminders ("opens soon" and "open now") from the stored sale windows, and the daily email digest for users who chose it.
- Venue and area watches use Ticketmaster only. A venue job is shared by everyone who follows that venue. An area tracks shows within a radius of a listed city whose public on-sale is still ahead. A rule's first check saves shows without alerts; later checks alert on new and changed shows.
- Eventbrite, AXS, and DICE remain disabled until approved partner access or a documented public-page terms review is complete.
