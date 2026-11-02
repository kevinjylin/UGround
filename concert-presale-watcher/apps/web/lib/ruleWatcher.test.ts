import assert from "node:assert/strict";
import test from "node:test";

// env.ts reads process.env at import time, so set it before loading modules.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
process.env.TICKETMASTER_API_KEY = "tm-key";

const { encodeGeohash, pickVenueMatch, toTicketmasterDateTime } = await import("./sources/ticketmaster");
const { marketCenter } = await import("./locations");
const { runLocationJob, runVenueJob } = await import("./ruleWatcher");

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

type Call = { method: string; url: string; body: unknown };

const tmEvent = (id: string, headliner: string, status = "onsale") => ({
  id,
  name: `${headliner} live`,
  url: `https://tm.test/${id}`,
  dates: { start: { dateTime: "2027-03-14T01:00:00Z" }, status: { code: status } },
  sales: { public: { startDateTime: "2026-11-06T16:00:00Z" } },
  _embedded: {
    venues: [{ name: "Metro", city: { name: "Chicago" }, state: { stateCode: "IL" }, country: { countryCode: "US" } }],
    attractions: [{ name: headliner }],
  },
});

const storedEvent = (sourceEventId: string, fields: Record<string, unknown> = {}) => ({
  id: `stored-${sourceEventId}`,
  user_id: USER_A,
  source_slug: "ticketmaster",
  source_event_id: sourceEventId,
  watch_artist_id: null,
  watch_rule_id: "rule-area",
  artist_name: "Horsegirl",
  title: "Horsegirl live",
  venue: "Metro",
  city: "Chicago",
  state: "IL",
  country: "US",
  start_time: "2027-03-14T01:00:00.000Z",
  ticket_url: `https://tm.test/${sourceEventId}`,
  status: "onsale",
  on_sale_start: "2026-11-06T16:00:00.000Z",
  sale_windows: [
    { kind: "public", name: "Public sale", url: `https://tm.test/${sourceEventId}`, starts_at: "2026-11-06T16:00:00.000Z", ends_at: null },
  ],
  dedupe_key: "k",
  last_seen_at: "",
  created_at: "",
  updated_at: "",
  ...fields,
});

const areaRule = (fields: Record<string, unknown> = {}) => ({
  id: "rule-area",
  user_id: USER_A,
  kind: "location",
  artist_id: null,
  venue_id: null,
  label: "Chicago, IL",
  city: "Chicago",
  state: "IL",
  country: "US",
  latitude: 41.88,
  longitude: -87.63,
  radius_miles: 25,
  legacy_watch_artist_id: null,
  baseline_at: "2026-10-01T00:00:00Z",
  created_at: "",
  updated_at: "",
  ...fields,
});

const state = {
  calls: [] as Call[],
  rules: [] as unknown[],
  venue: null as unknown,
  stored: [] as unknown[],
  tmEvents: [] as unknown[],
  tmVenues: [] as unknown[],
};

const reset = (patch: Partial<typeof state>) => {
  Object.assign(state, { calls: [], rules: [], venue: null, stored: [], tmEvents: [], tmVenues: [] }, patch);
};

// Minimal stand-in for PostgREST and the Ticketmaster API.
globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = String(input);
  const method = init.method ?? "GET";
  const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
  state.calls.push({ method, url, body });
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

  if (url.startsWith("https://app.ticketmaster.com/discovery/v2/venues.json")) {
    return json({ _embedded: { venues: state.tmVenues } });
  }
  if (url.startsWith("https://app.ticketmaster.com/discovery/v2/events.json")) {
    return json({ _embedded: { events: state.tmEvents } });
  }
  if (url.includes("/watch_rules?") && method === "GET") return json(state.rules);
  if (url.includes("/venues?") && method === "GET") return json(state.venue ? [state.venue] : []);
  if (url.includes("/events?") && method === "GET") return json(state.stored);
  if (url.includes("/events?") && method === "POST") {
    // Echo the upserted rows back with ids, like return=representation.
    return json(
      (body as Array<Record<string, unknown>>).map((row) => ({ ...row, id: `saved-${row.user_id}-${row.source_event_id}` })),
    );
  }
  if (url.includes("/rpc/create_alert_with_deliveries")) {
    return json([{ alert_id: `alert-${state.calls.length}`, created: true }]);
  }
  if (method === "GET") return json([]);
  return new Response(null, { status: 204 });
}) as typeof fetch;

const job = (targetType: "venue" | "location", targetId: string) => ({
  id: "job-1",
  source_slug: "ticketmaster" as const,
  target_type: targetType,
  target_id: targetId,
  user_id: null,
  priority: 10,
  next_poll_at: "",
  cadence_seconds: 1800,
  lease_owner: null,
  lease_expires_at: null,
  attempts: 1,
});

const callsTo = (method: string, fragment: string) =>
  state.calls.filter((call) => call.method === method && call.url.includes(fragment));

test("geohash and Ticketmaster timestamps use the formats the API expects", () => {
  assert.equal(encodeGeohash(57.64911, 10.40744), "u4pruydqq");
  assert.equal(toTicketmasterDateTime(new Date("2026-11-01T12:34:56.789Z")), "2026-11-01T12:34:56Z");
});

test("market centers resolve listed cities and nothing else", () => {
  assert.deepEqual(marketCenter("Chicago", "IL"), { latitude: 41.88, longitude: -87.63 });
  assert.deepEqual(marketCenter("st louis", null), { latitude: 38.63, longitude: -90.2 });
  assert.equal(marketCenter("Chicago", "CA"), null);
  assert.equal(marketCenter("Fresno", "CA"), null);
});

test("venue matching prefers exact names, uses city to break ties, and won't guess", () => {
  const venue = (id: string, name: string, city: string) => ({
    id, name, city, state: null, country: "US", address: null, latitude: null, longitude: null,
  });
  const candidates = [
    venue("a", "Metro Smart Bar", "Chicago"),
    venue("b", "The Metro", "Sydney"),
    venue("c", "Metro", "Chicago"),
  ];
  assert.equal(pickVenueMatch("metro", "Chicago", candidates)?.id, "c");
  assert.equal(pickVenueMatch("Empty Bottle", "Chicago", candidates), null);
  assert.equal(pickVenueMatch("Metro Smart", null, candidates)?.id, "a");
});

test("an area's first check saves shows quietly and marks the rule baselined", async () => {
  reset({ rules: [areaRule({ baseline_at: null })], tmEvents: [tmEvent("e1", "Horsegirl"), tmEvent("e2", "Ratboys")] });

  const outcome = await runLocationJob(job("location", "rule-area"));

  assert.deepEqual(outcome, { kind: "done", saved: 2, alerts: 0 });
  const [tmCall] = callsTo("GET", "app.ticketmaster.com/discovery/v2/events.json");
  const params = new URL(tmCall!.url).searchParams;
  assert.equal(params.get("geoPoint"), encodeGeohash(41.88, -87.63));
  assert.equal(params.get("radius"), "25");
  assert.equal(params.get("unit"), "miles");
  assert.match(params.get("onsaleStartDateTime") ?? "", /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);

  const [upsert] = callsTo("POST", "/events?");
  const rows = upsert!.body as Array<Record<string, unknown>>;
  assert.deepEqual(rows.map((row) => [row.source_event_id, row.watch_rule_id, row.artist_name]), [
    ["e1", "rule-area", "Horsegirl"],
    ["e2", "rule-area", "Ratboys"],
  ]);
  assert.ok(rows.every((row) => !("watch_artist_id" in row)), "rule upserts must not touch watch_artist_id");
  assert.equal(callsTo("POST", "/rpc/create_alert_with_deliveries").length, 0);
  const [baseline] = callsTo("PATCH", "/watch_rules?id=eq.rule-area");
  assert.ok((baseline?.body as { baseline_at?: string }).baseline_at);
  assert.equal(callsTo("POST", "/snapshots").length, 1);
});

test("after the baseline, only new or changed shows are saved and alerted", async () => {
  reset({
    rules: [areaRule()],
    stored: [
      storedEvent("same"),
      storedEvent("artist-owned", { watch_artist_id: "w1", status: "offsale" }),
      storedEvent("cancelled"),
    ],
    tmEvents: [
      tmEvent("same", "Horsegirl"),
      tmEvent("artist-owned", "Horsegirl"),
      tmEvent("cancelled", "Horsegirl", "cancelled"),
      tmEvent("brand-new", "Wednesday"),
    ],
  });

  const outcome = await runLocationJob(job("location", "rule-area"));

  const [upsert] = callsTo("POST", "/events?");
  assert.deepEqual(
    (upsert!.body as Array<{ source_event_id: string }>).map((row) => row.source_event_id),
    ["cancelled", "brand-new"],
  );
  const alertTypes = callsTo("POST", "/rpc/create_alert_with_deliveries").map(
    (call) => (call.body as { p_alert_type: string }).p_alert_type,
  );
  assert.deepEqual(alertTypes.sort(), ["new_event", "status_changed"]);
  assert.deepEqual(outcome, { kind: "done", saved: 2, alerts: 2 });
  assert.equal(callsTo("PATCH", "/watch_rules?").length, 0);
});

test("a venue is fetched once and saved for each follower", async () => {
  const venueRule = (id: string, userId: string) => ({
    ...areaRule({ id, user_id: userId, kind: "venue", venue_id: "venue-1", label: "Metro", latitude: null, longitude: null, radius_miles: null }),
  });
  reset({
    // A follower from before, and one who just added the venue.
    rules: [venueRule("rule-a", USER_A), { ...venueRule("rule-b", USER_B), baseline_at: null }],
    venue: { id: "venue-1", name: "Metro", city: "Chicago", state: "IL", country: "US", latitude: null, longitude: null, source_refs: {} },
    tmVenues: [
      { id: "tm-smartbar", name: "Smart Bar", city: { name: "Chicago" } },
      { id: "tm-metro", name: "Metro", city: { name: "Chicago" }, location: { latitude: "41.94", longitude: "-87.65" } },
    ],
    tmEvents: [tmEvent("e1", "Horsegirl")],
  });

  const outcome = await runVenueJob(job("venue", "venue-1"));

  // The typed venue was matched once and remembered for next time.
  const [refPatch] = callsTo("PATCH", "/venues?id=eq.venue-1");
  assert.deepEqual((refPatch?.body as { source_refs: unknown }).source_refs, { ticketmaster: "tm-metro" });
  const eventCalls = callsTo("GET", "app.ticketmaster.com/discovery/v2/events.json");
  assert.equal(eventCalls.length, 1);
  assert.equal(new URL(eventCalls[0]!.url).searchParams.get("venueId"), "tm-metro");

  const savedFor = callsTo("POST", "/events?").flatMap((call) =>
    (call.body as Array<{ user_id: string; watch_rule_id: string }>).map((row) => [row.user_id, row.watch_rule_id]),
  );
  assert.deepEqual(savedFor, [
    [USER_A, "rule-a"],
    [USER_B, "rule-b"],
  ]);
  // Only the established follower is alerted; the new one's first check is quiet.
  const alerted = callsTo("POST", "/rpc/create_alert_with_deliveries").map(
    (call) => (call.body as { p_user_id: string }).p_user_id,
  );
  assert.deepEqual(alerted, [USER_A]);
  assert.equal(callsTo("PATCH", "/watch_rules?id=eq.rule-b").length, 1);
  assert.deepEqual(outcome, { kind: "done", saved: 2, alerts: 1 });
});

test("jobs whose rule or followers are gone report it instead of fetching", async () => {
  reset({ rules: [] });
  assert.equal((await runVenueJob(job("venue", "venue-1"))).kind, "gone");
  assert.equal((await runLocationJob(job("location", "rule-area"))).kind, "gone");
  assert.equal(callsTo("GET", "app.ticketmaster.com").length, 0);
});

test("a venue Ticketmaster doesn't list is deferred, not failed", async () => {
  reset({
    rules: [areaRule({ kind: "venue", venue_id: "venue-1" })],
    venue: { id: "venue-1", name: "Basement Show", city: "Chicago", state: "IL", country: "US", latitude: null, longitude: null, source_refs: {} },
    tmVenues: [{ id: "tm-metro", name: "Metro", city: { name: "Chicago" } }],
  });
  const outcome = await runVenueJob(job("venue", "venue-1"));
  assert.equal(outcome.kind, "unresolved");
});
