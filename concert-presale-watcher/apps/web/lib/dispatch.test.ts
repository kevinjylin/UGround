import assert from "node:assert/strict";
import test from "node:test";

// env.ts reads process.env at import time, so set it before loading the route.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
process.env.TICKETMASTER_API_KEY = "tm-key";
process.env.CRON_SECRET = "cron-secret";

const USER = "11111111-1111-1111-1111-111111111111";
const WATCH_ARTIST = "22222222-2222-2222-2222-222222222222";

const job = (id: string, source: string, targetType: string, targetId: string) => ({
  id,
  source_slug: source,
  target_type: targetType,
  target_id: targetId,
  user_id: USER,
  priority: 10,
  next_poll_at: new Date().toISOString(),
  cadence_seconds: 1800,
  lease_owner: null,
  lease_expires_at: null,
  attempts: 1,
});

type Call = { method: string; url: string; prefer: string | null; body: unknown };

const state = {
  queue: [] as ReturnType<typeof job>[],
  ticketmasterStatus: 200,
  calls: [] as Call[],
};

// Minimal stand-in for PostgREST and the Ticketmaster API.
globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = String(input);
  const method = init.method ?? "GET";
  const headers = new Headers(init.headers);
  state.calls.push({
    method,
    url,
    prefer: headers.get("Prefer"),
    body: typeof init.body === "string" ? JSON.parse(init.body) : null,
  });
  const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status });

  if (url.startsWith("https://app.ticketmaster.com/")) {
    return state.ticketmasterStatus === 200
      ? json({ _embedded: { events: [] } })
      : json({ fault: { faultstring: "Invalid ApiKey" } }, state.ticketmasterStatus);
  }
  if (url.includes("/rpc/claim_poll_jobs")) {
    const next = state.queue.shift();
    return json(next ? [next] : []);
  }
  if (url.includes("/watch_rules?") && method === "GET") {
    return json([
      {
        id: "rule-1",
        user_id: USER,
        kind: "artist",
        artist_id: "artist-1",
        venue_id: null,
        legacy_watch_artist_id: WATCH_ARTIST,
      },
    ]);
  }
  if (url.includes("/watch_artists?") && method === "GET") {
    return json([
      {
        id: WATCH_ARTIST,
        user_id: USER,
        name: "Phoebe Bridgers",
        spotify_id: null,
        city: null,
        state: null,
        country: "US",
        created_at: "",
        updated_at: "",
      },
    ]);
  }
  if (method === "GET") return json([]);
  return new Response(null, { status: 204 });
}) as typeof fetch;

const dispatch = async (query = "") => {
  const { POST } = await import("../app/api/internal/dispatch/route");
  const response = await POST(
    new Request(`https://app.test/api/internal/dispatch${query}`, {
      method: "POST",
      headers: { Authorization: "Bearer cron-secret" },
    }),
  );
  return { status: response.status, body: await response.json() };
};

const patchesTo = (path: string) =>
  state.calls.filter((call) => call.method === "PATCH" && call.url.includes(path));

test("dispatcher runs artist jobs, skips unrunnable ones, and drains the queue", async () => {
  state.calls = [];
  state.ticketmasterStatus = 200;
  state.queue = [
    job("venue-job", "ticketmaster", "venue", "venue-1"),
    job("axs-job", "axs", "legacy_user", `${USER}:${WATCH_ARTIST}`),
    job("tm-job", "ticketmaster", "legacy_user", `${USER}:${WATCH_ARTIST}`),
  ];

  const { status, body } = await dispatch("?sync=1");

  assert.equal(status, 200);
  assert.equal(body.drained, true);
  assert.equal(body.synced, 1);
  assert.deepEqual(
    body.results.map((result: { id: string; status: string }) => [result.id, result.status]),
    [
      ["venue-job", "skipped"],
      ["axs-job", "skipped"],
      ["tm-job", "succeeded"],
    ],
  );

  // Sync only adds missing jobs and targets the legacy artist the dispatcher can run.
  const sync = state.calls.find(
    (call) => call.method === "POST" && call.url.includes("/poll_jobs?on_conflict="),
  );
  assert.ok(sync?.prefer?.includes("resolution=ignore-duplicates"));
  assert.ok(
    (sync?.body as Array<{ source_slug: string; target_type: string; target_id: string }>).some(
      (row) =>
        row.source_slug === "ticketmaster" &&
        row.target_type === "legacy_user" &&
        row.target_id === `${USER}:${WATCH_ARTIST}`,
    ),
  );

  // Skipped jobs are pushed out about a day instead of retried within the hour.
  for (const id of ["venue-job", "axs-job"]) {
    const [patch] = patchesTo(`/poll_jobs?id=eq.${id}`);
    const nextPollAt = new Date((patch?.body as { next_poll_at: string }).next_poll_at).getTime();
    assert.ok(nextPollAt - Date.now() > 23 * 3600 * 1000, `${id} should be deferred a day`);
  }

  // Ticketmaster was called and its health recorded as a success.
  assert.ok(state.calls.some((call) => call.url.startsWith("https://app.ticketmaster.com/")));
  const [health] = patchesTo("/source_health?source_slug=eq.ticketmaster");
  assert.ok((health?.body as { last_success_at?: string }).last_success_at);
});

test("a Ticketmaster error fails the job instead of reporting success", async () => {
  state.calls = [];
  state.ticketmasterStatus = 401;
  state.queue = [job("tm-job", "ticketmaster", "legacy_user", `${USER}:${WATCH_ARTIST}`)];

  const { body } = await dispatch();

  assert.equal(body.synced, null);
  assert.equal(body.failed, 1);
  assert.match(body.results[0].error, /Ticketmaster request failed \(401\)/);
  const [health] = patchesTo("/source_health?source_slug=eq.ticketmaster");
  assert.match((health?.body as { last_error: string }).last_error, /401/);
});
