import assert from "node:assert/strict";
import test from "node:test";

// env.ts reads process.env at import time, so set it before loading anything.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
process.env.TICKETMASTER_API_KEY = "tm-key";
process.env.ALERT_SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.APP_URL = "https://www.uground.test";
process.env.RESEND_API_KEY = "re-key";
process.env.ALERT_FROM_EMAIL = "alerts@uground.test";

const USER = "11111111-1111-1111-1111-111111111111";
const WATCH_ARTIST = "22222222-2222-2222-2222-222222222222";

const { encryptSecret, createUnsubscribeToken, verifyUnsubscribeToken } = await import("./notificationCrypto");

type Call = { method: string; url: string; body: unknown; headers: Headers };

const state = {
  calls: [] as Call[],
  baselineSources: [] as string[],
  preferences: null as Record<string, unknown> | null,
  userState: null as string | null,
  /** The user's rows for the same show saved from another source. */
  otherSourceRows: [] as Array<Record<string, unknown>>,
};

const tmEvent = {
  id: "tm-1",
  name: "Phoebe Bridgers",
  url: "https://www.ticketmaster.com/event/tm-1",
  dates: { start: { dateTime: "2027-03-07T02:00:00Z", localDate: "2027-03-06" }, timezone: "America/Chicago", status: { code: "onsale" } },
  sales: { public: { startDateTime: "2027-01-10T16:00:00Z" } },
  _embedded: {
    venues: [{ name: "Metro", city: { name: "Chicago" }, state: { stateCode: "IL" }, country: { countryCode: "US" } }],
    attractions: [{ name: "Phoebe Bridgers" }],
  },
};

const savedEvent = () => ({
  id: "event-1",
  user_id: USER,
  source_slug: "ticketmaster",
  source_event_id: "tm-1",
  watch_artist_id: WATCH_ARTIST,
  watch_rule_id: null,
  artist_name: "Phoebe Bridgers",
  title: "Phoebe Bridgers",
  venue: "Metro",
  city: "Chicago",
  state: "IL",
  country: "US",
  start_time: "2027-03-07T02:00:00Z",
  ticket_url: tmEvent.url,
  status: "onsale",
  on_sale_start: "2027-01-10T16:00:00Z",
  sale_windows: [],
  user_state: state.userState,
  dedupe_key: "k",
  last_seen_at: "",
  created_at: "",
  updated_at: "",
});

globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = String(input);
  const method = init.method ?? "GET";
  const headers = new Headers(init.headers);
  state.calls.push({ method, url, headers, body: typeof init.body === "string" ? JSON.parse(init.body) : null });
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

  if (url.startsWith("https://app.ticketmaster.com/")) return json({ _embedded: { events: [tmEvent] } });
  if (url.startsWith("https://api.resend.com/")) return json({ id: "email-1" });
  if (url.includes("/watch_rules?select=id,baseline_sources")) {
    return json([{ id: "rule-1", baseline_sources: state.baselineSources }]);
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
        ticketmaster_attraction_id: "K8vZ9171",
        created_at: "",
        updated_at: "",
      },
    ]);
  }
  if (url.includes("/events?select=*&on_conflict") && method === "POST") return json(savedEvent());
  if (url.includes("/events?select=*&user_id=") && url.includes("source_slug=neq.")) {
    return json(state.otherSourceRows);
  }
  if (url.includes("/events?select=*&id=eq.") && method === "PATCH") {
    return json({ ...savedEvent(), id: "event-songkick" });
  }
  if (url.includes("/notification_settings?") && method === "GET") {
    return json([
      {
        user_id: USER,
        email_encrypted: encryptSecret("fan@example.com"),
        email_enabled: true,
        email_confirmed_at: "2026-01-01T00:00:00Z",
        discord_webhook_encrypted: null,
        phone_encrypted: null,
        discord_enabled: false,
        sms_enabled: false,
        sms_confirmed_at: null,
      },
    ]);
  }
  if (url.includes("/notification_preferences?") && method === "GET") {
    return json(state.preferences ? [{ user_id: USER, ...state.preferences }] : []);
  }
  if (url.includes("/rpc/create_alert_with_deliveries")) return json([{ alert_id: "alert-1", created: true }]);
  if (url.includes("/snapshots?select=*") && method === "POST") return json({ id: "snap-1" });
  // The venue's zone, read from the stored Ticketmaster payload.
  if (url.includes("/snapshots?select=tz:")) {
    return json([{ tz: "America/Chicago", local_date: "2027-03-06", date_time: "2027-03-07T02:00:00Z" }]);
  }
  if (method === "GET") return json([]);
  return new Response(null, { status: 204 });
}) as typeof fetch;

const { runPollForArtist, persistAndDeliverAlert, isQuietSource } = await import("./poller");
const { configuredAdapterSlugs } = await import("./poller");
const { runnableArtistSources, artistCadenceSeconds } = await import("./pollCadence");

const rpcCalls = (name: string) => state.calls.filter((call) => call.url.includes(`/rpc/${name}`));
const emails = () => state.calls.filter((call) => call.url.startsWith("https://api.resend.com/"));
const deliveryPatches = () =>
  state.calls.filter((call) => call.method === "PATCH" && call.url.includes("/notification_deliveries?"));

const reset = () => {
  state.calls = [];
  state.preferences = null;
  state.userState = null;
  state.otherSourceRows = [];
};

const otherSourceRow = (sourceSlug: string) => ({
  ...savedEvent(),
  id: "event-songkick",
  source_slug: sourceSlug,
  source_event_id: "other-1",
  status: "scheduled",
  on_sale_start: null,
  dedupe_key: "phoebe-bridgers::metro::2027-03-06",
});

test("a show already saved from a lower source is upgraded in place, not announced again", async () => {
  reset();
  state.baselineSources = ["ticketmaster"];
  state.otherSourceRows = [otherSourceRow("songkick")];
  const outcome = await runPollForArtist(WATCH_ARTIST, USER, ["ticketmaster"]);
  assert.equal(outcome?.result.newEvents, 0);
  const [patch] = state.calls.filter((call) => call.method === "PATCH" && call.url.includes("/events?select=*&id=eq."));
  assert.ok(patch?.url.includes("id=eq.event-songkick"));
  assert.equal((patch?.body as { source_slug: string }).source_slug, "ticketmaster");
  assert.ok(!state.calls.some((call) => call.method === "POST" && call.url.includes("/events?select=*&on_conflict")));
  // The better source knows the on-sale date the first one didn't, so that
  // is announced; the show itself and its new ticket link are not.
  assert.deepEqual(
    rpcCalls("create_alert_with_deliveries").map((call) => (call.body as { p_alert_type: string }).p_alert_type),
    ["public_sale_announced"],
  );
});

test("an artist's first check on a source saves shows without alerting, then marks the baseline", async () => {
  reset();
  state.baselineSources = [];
  const outcome = await runPollForArtist(WATCH_ARTIST, USER, ["ticketmaster"]);
  assert.deepEqual(outcome?.quietSources, ["ticketmaster"]);
  assert.equal(outcome?.result.alertsCreated, 0);
  assert.ok(state.calls.some((call) => call.method === "POST" && call.url.includes("/events?select=*&on_conflict")));
  assert.equal(rpcCalls("create_alert_with_deliveries").length, 0);
  const [mark] = rpcCalls("mark_artist_source_baselined");
  assert.deepEqual(mark?.body, { p_rule_id: "rule-1", p_source: "ticketmaster" });
});

test("after the baseline, a new show alerts and the email is readable with an unsubscribe header", async () => {
  reset();
  state.baselineSources = ["ticketmaster"];
  state.preferences = { time_zone: "America/Los_Angeles", reminder_lead_minutes: 60, channel_alert_types: {} };
  const outcome = await runPollForArtist(WATCH_ARTIST, USER, ["ticketmaster"]);
  assert.equal(outcome?.result.alertsCreated, 1);
  assert.equal(rpcCalls("mark_artist_source_baselined").length, 0);
  const [create] = rpcCalls("create_alert_with_deliveries");
  assert.deepEqual((create?.body as { p_channels: string[] }).p_channels, ["email"]);

  const [email] = emails();
  const body = email?.body as { subject: string; text: string; html: string; headers: Record<string, string> };
  assert.equal(body.subject, "New show: Phoebe Bridgers in Chicago");
  assert.match(body.text, /Show: Sat, Mar 6, 2027, 8:00 PM CST/);
  assert.match(body.headers["List-Unsubscribe"] ?? "", /^<https:\/\/www\.uground\.test\/api\/notification-settings\/unsubscribe\?token=/);
  assert.equal(body.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  // A sale three days or more out keeps the default 12 hour cadence.
  assert.equal(outcome?.cadenceSeconds, 12 * 3600);
});

test("a channel the user limited to other alert types isn't given this one", async () => {
  reset();
  state.baselineSources = ["ticketmaster"];
  state.preferences = { channel_alert_types: { email: ["presale_opened", "sale_opens_soon"] } };
  await runPollForArtist(WATCH_ARTIST, USER, ["ticketmaster"]);
  const [create] = rpcCalls("create_alert_with_deliveries");
  assert.deepEqual((create?.body as { p_channels: string[] }).p_channels, []);
  assert.equal(emails().length, 0);
});

test("shows the user hid never alert", async () => {
  reset();
  state.userState = "hidden";
  const sent = await persistAndDeliverAlert("status_changed", null, savedEvent() as never);
  assert.equal(sent, false);
  assert.equal(rpcCalls("create_alert_with_deliveries").length, 0);
});

test("quiet hours hold the delivery until they end instead of sending", async () => {
  reset();
  state.baselineSources = ["ticketmaster"];
  // Quiet all day except one minute, so "now" is always inside.
  const nowMinutes = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
  state.preferences = {
    time_zone: "UTC",
    quiet_hours_enabled: true,
    quiet_hours_start: (nowMinutes + 1438) % 1440,
    quiet_hours_end: (nowMinutes + 2) % 1440,
  };
  await runPollForArtist(WATCH_ARTIST, USER, ["ticketmaster"]);
  assert.equal(emails().length, 0);
  const [hold] = deliveryPatches();
  const body = hold?.body as { status: string; held_reason: string; next_attempt_at: string };
  assert.equal(body.status, "pending");
  assert.equal(body.held_reason, "quiet_hours");
  const wait = new Date(body.next_attempt_at).getTime() - Date.now();
  assert.ok(wait > 0 && wait <= 2 * 60_000, "held until quiet hours end");
});

test("with the daily digest on, the email waits for the digest", async () => {
  reset();
  state.baselineSources = ["ticketmaster"];
  state.preferences = { email_digest: true };
  await runPollForArtist(WATCH_ARTIST, USER, ["ticketmaster"]);
  assert.equal(emails().length, 0);
  const [hold] = deliveryPatches();
  assert.equal((hold?.body as { held_reason: string }).held_reason, "digest");
});

test("legacy artists with no rule row keep alerting", () => {
  assert.equal(isQuietSource(null, "ticketmaster"), false);
  assert.equal(isQuietSource({ id: "r", baseline_sources: ["songkick"] }, "ticketmaster"), true);
  assert.equal(isQuietSource({ id: "r", baseline_sources: ["ticketmaster"] }, "ticketmaster"), false);
});

test("poll jobs are only built for sources that can run, on a quota-safe cadence", () => {
  assert.deepEqual(runnableArtistSources(), configuredAdapterSlugs());
  assert.deepEqual(runnableArtistSources(), ["ticketmaster"]);
  const now = new Date("2026-11-16T00:00:00Z");
  assert.equal(artistCadenceSeconds(["2026-11-18T00:00:00Z"], now), 3 * 3600);
  assert.equal(artistCadenceSeconds(["2026-11-25T00:00:00Z", null], now), 12 * 3600);
  // A sale that already started doesn't speed things up.
  assert.equal(artistCadenceSeconds(["2026-11-15T00:00:00Z"], now), 12 * 3600);
});

test("unsubscribe tokens verify for their user and reject tampering", async () => {
  const token = createUnsubscribeToken(USER);
  assert.equal(verifyUnsubscribeToken(token), USER);
  assert.equal(verifyUnsubscribeToken(token.replace(USER, "33333333-3333-3333-3333-333333333333")), null);
  assert.equal(verifyUnsubscribeToken(`${token}x`), null);
  assert.equal(verifyUnsubscribeToken("garbage"), null);

  reset();
  const { GET, POST } = await import("../app/api/notification-settings/unsubscribe/route");
  const ok = await GET(new Request(`https://www.uground.test/api/notification-settings/unsubscribe?token=${token}`));
  assert.equal(ok.status, 200);
  assert.match(await ok.text(), /Email alerts are off/);
  const [patch] = state.calls.filter((call) => call.method === "PATCH" && call.url.includes("/notification_settings?"));
  assert.ok(patch?.url.includes(`user_id=eq.${USER}`));
  assert.deepEqual(patch?.body, { email_enabled: false });

  const bad = await POST(new Request("https://www.uground.test/api/notification-settings/unsubscribe?token=nope"));
  assert.equal(bad.status, 400);
});
