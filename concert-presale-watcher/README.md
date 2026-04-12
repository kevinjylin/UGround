# Concert Presale Watcher (MVP)

Watch-and-alert site for artists.

This repo is now set up as:
- `apps/web`: Next.js dashboard + API routes
- `apps/worker`: polling worker (calls `POST /api/poll` on an interval)
- `database/schema.sql`: Postgres schema for artists/events/snapshots/alerts

## MVP flow

1. Add artists to your watchlist (manual or Spotify artist ID import).
2. Poll Ticketmaster + Eventbrite for each followed artist.
3. Normalize to one `events` table and snapshot raw source payloads.
4. Detect changes (`new_event`, `status_changed`, `ticket_url_changed`, `on_sale_moved_earlier`).
5. Send alerts to Discord/email/SMS when configured.

## Database setup (Supabase Postgres)

1. Create a Supabase project.
2. Run [`database/schema.sql`](./database/schema.sql) in SQL editor.
3. Copy `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` into `apps/web/.env.local`.

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
- Email alerts: `RESEND_API_KEY`, `ALERT_FROM_EMAIL`, `ALERT_TO_EMAIL`
- SMS alerts: Twilio vars
- Discord alerts: `DISCORD_WEBHOOK_URL`

Optional poll protection:
- Set `POLL_SECRET` in web and worker.
- Set `CRON_SECRET` in Vercel if you use the built-in scheduled poll.

Login gate (recommended for Vercel):
- `AUTH_SECRET`: random secret for Auth.js session signing
- `NEXTAUTH_URL`: your app URL (for local: `http://localhost:3000`)
- `AUTH_USERNAME`: credentials username
- `AUTH_PASSWORD`: credentials password
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret

Google OAuth callback URLs:
- Local: `http://localhost:3000/api/auth/callback/google`
- Production: `https://<your-vercel-domain>/api/auth/callback/google`

## Run

From repo root:

```bash
npm install
npm run dev
```

Then run worker in another shell:

```bash
npm run dev --workspace=@apps/worker
```

Open `http://localhost:3000`.

## API routes

- `GET/POST /api/watchlist`
- `DELETE /api/watchlist/:id`
- `POST /api/watchlist/import-spotify`
- `GET /api/events`
- `GET /api/alerts`
- `POST /api/poll`
- `GET /api/cron/poll`
- `GET /api/health`

## Deploy To Vercel

1. Import this repo into Vercel.
2. Set the Vercel project **Root Directory** to `concert-presale-watcher/apps/web`.
3. Add environment variables in Vercel Project Settings:
   - Required: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - Recommended auth: `AUTH_SECRET`, `NEXTAUTH_URL`, `AUTH_USERNAME`, `AUTH_PASSWORD`
   - Optional Google sign-in: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - Optional integrations: Ticketmaster/Eventbrite/Spotify/Discord/Resend/Twilio/POLL_SECRET/CRON_SECRET
4. Deploy.

Notes:
- If auth vars are set, Auth.js protects the site and API with a `/login` page.
- `/api/poll` still works for your worker/cron when it sends `x-poll-secret` matching `POLL_SECRET`.
- Vercel runs `GET /api/cron/poll` once daily via `apps/web/vercel.json`. Set `CRON_SECRET` so Vercel sends the matching `Authorization: Bearer ...` header; it can be the same value as `POLL_SECRET`.
- For more frequent checks, deploy `apps/worker` separately with `WORKER_POLL_URL=https://<your-vercel-domain>/api/poll`, `POLL_SECRET`, and `POLL_INTERVAL_MINUTES`.

## Notes

- Poll endpoint is admin-style for now (no user auth in MVP).
- If alert channel keys are missing, alerts are still stored in DB.
- Start with one city + a constrained artist list before widening coverage.
