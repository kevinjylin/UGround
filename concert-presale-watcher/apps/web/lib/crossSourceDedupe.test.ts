import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

const {
  alertTypesForReplacement,
  decideCrossSource,
  isSameShow,
  listCrossSourceCandidates,
  replaceCrossSourceRow,
  resolveCrossSource,
  venuesMatch,
} = await import("./crossSourceDedupe");

type Call = { method: string; url: string; body: unknown };
const state = { calls: [] as Call[], rows: [] as unknown[] };

globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = String(input);
  const method = init.method ?? "GET";
  const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
  state.calls.push({ method, url, body });
  if (method === "GET") return new Response(JSON.stringify(state.rows), { status: 200 });
  if (method === "PATCH") return new Response(JSON.stringify({ id: "row-1", ...body }), { status: 200 });
  return new Response(null, { status: 204 });
}) as typeof fetch;

const row = (sourceSlug: string, fields: Record<string, unknown> = {}) => ({
  id: `${sourceSlug}-row`,
  user_id: "user-1",
  source_slug: sourceSlug,
  source_event_id: `${sourceSlug}-1`,
  watch_artist_id: "wa-1",
  watch_rule_id: null,
  artist_name: "Air",
  title: "Air",
  venue: "The Fillmore",
  city: "San Francisco",
  state: "CA",
  country: "US",
  start_time: "2027-03-15T04:00:00.000Z",
  ticket_url: null,
  status: "scheduled",
  on_sale_start: null,
  sale_windows: [],
  dedupe_key: "air::the-fillmore::2027-03-14",
  last_seen_at: "",
  created_at: "",
  updated_at: "2026-11-01T00:00:00Z",
  ...fields,
}) as never;

const normalized = (sourceSlug: string, fields: Record<string, unknown> = {}) => ({
  user_id: "user-1",
  source_slug: sourceSlug,
  source_event_id: `${sourceSlug}-1`,
  watch_artist_id: "wa-1",
  artist_name: "Air",
  title: "Air live",
  venue: "Fillmore Auditorium",
  city: "San Francisco",
  state: "CA",
  country: "US",
  start_time: "2027-03-15T04:00:00.000Z",
  ticket_url: "https://tm.test/1",
  status: "onsale",
  on_sale_start: "2026-11-20T18:00:00.000Z",
  sale_windows: [],
  lineup: ["Opener"],
  dedupe_key: "air::fillmore-auditorium::2027-03-14",
  raw_json: {},
  ...fields,
}) as never;

test("venue names from different sources match when one's words are in the other's", () => {
  assert.ok(venuesMatch("The Fillmore", "Fillmore Auditorium"));
  assert.ok(venuesMatch("Brooklyn Steel", "Brooklyn Steel - NY"));
  assert.ok(venuesMatch("Orpheum Theatre", "The Orpheum Theater"));
  assert.ok(venuesMatch("Mötley Hall", "Motley Hall"));
  assert.ok(!venuesMatch("The Fillmore", "The Independent"));
  assert.ok(!venuesMatch("Metro", ""));
});

test("same show: same artist and day (or within 12 hours), and a matching venue", () => {
  const tm = row("ticketmaster");
  assert.ok(isSameShow(normalized("songkick"), tm));
  // A Songkick date-only listing (midnight UTC) still matches on the day.
  assert.ok(isSameShow(normalized("songkick", { start_time: "2027-03-14T00:00:00.000Z" }), tm));
  // An old row keyed by UTC day is caught by the clock.
  assert.ok(isSameShow(normalized("songkick", { dedupe_key: "air::fillmore-auditorium::2027-03-15" }), tm));
  // The next night of a run is a different show.
  assert.ok(
    !isSameShow(
      normalized("songkick", { start_time: "2027-03-16T04:00:00.000Z", dedupe_key: "air::fillmore::2027-03-15" }),
      tm,
    ),
  );
  assert.ok(!isSameShow(normalized("songkick", { venue: "The Independent" }), tm));
  assert.ok(!isSameShow(normalized("songkick", { dedupe_key: "air-supply::fillmore::2027-03-14" }), tm));
  // Without a venue on one side, the city decides.
  assert.ok(isSameShow(normalized("bandsintown", { venue: null }), tm));
  assert.ok(!isSameShow(normalized("bandsintown", { venue: null, city: "Oakland" }), tm));
});

test("decisions: skip for an equal or higher source, replace a lower one, save when none", () => {
  assert.deepEqual(decideCrossSource(normalized("ticketmaster"), []), { action: "save" });

  const fromSongkick = decideCrossSource(normalized("songkick"), [row("ticketmaster")]);
  assert.equal(fromSongkick.action, "skip");

  const fromBandsintown = decideCrossSource(normalized("bandsintown"), [row("songkick")]);
  assert.equal(fromBandsintown.action, "skip");

  const fromTicketmaster = decideCrossSource(normalized("ticketmaster"), [row("songkick"), row("manual")]);
  assert.equal(fromTicketmaster.action, "replace");
  assert.equal(fromTicketmaster.action === "replace" && fromTicketmaster.existing.source_slug, "songkick");

  // Rows from the event's own source aren't cross-source duplicates.
  assert.deepEqual(decideCrossSource(normalized("songkick"), [row("songkick")]), { action: "save" });
  // Nor are different shows.
  assert.deepEqual(decideCrossSource(normalized("ticketmaster"), [row("songkick", { venue: "The Independent" })]), {
    action: "save",
  });
});

test("candidates are one user's rows for the artist around the date, from other sources", async () => {
  state.calls = [];
  state.rows = [row("ticketmaster")];
  const decision = await resolveCrossSource(normalized("songkick"));
  assert.equal(decision.action, "skip");
  const url = decodeURIComponent(state.calls[0]!.url);
  assert.match(url, /user_id=eq\.user-1/);
  assert.match(url, /source_slug=neq\.songkick/);
  assert.match(url, /dedupe_key=like\.air::\*/);
  assert.match(url, /start_time=gte\.2027-03-13T16:00:00\.000Z/);
  assert.match(url, /start_time=lte\.2027-03-16T16:00:00\.000Z/);

  state.calls = [];
  await listCrossSourceCandidates(normalized("songkick", { start_time: null, dedupe_key: "air::x::unknown-day" }));
  assert.match(decodeURIComponent(state.calls[0]!.url), /dedupe_key=eq\.air::x::unknown-day/);
});

test("replacing rewrites the lower row in place as the new source's", async () => {
  state.calls = [];
  const saved = await replaceCrossSourceRow(row("songkick"), normalized("ticketmaster"));
  const [patch] = state.calls;
  assert.equal(patch?.method, "PATCH");
  assert.match(patch!.url, /\/events\?select=\*&id=eq\.songkick-row$/);
  const body = patch!.body as Record<string, unknown>;
  assert.equal(body.source_slug, "ticketmaster");
  assert.equal(body.source_event_id, "ticketmaster-1");
  assert.deepEqual(body.lineup, ["Opener"]);
  assert.ok(!("user_state" in body) && !("watch_rule_id" in body));
  assert.equal(saved.id, "row-1");
});

test("a replacement doesn't announce a new show or a source's link and status quirks", () => {
  assert.deepEqual(
    alertTypesForReplacement(
      ["new_event", "status_changed", "ticket_url_changed", "presale_announced", "public_sale_announced"],
      { status: "onsale" },
    ),
    ["presale_announced", "public_sale_announced"],
  );
  assert.deepEqual(alertTypesForReplacement(["status_changed"], { status: "cancelled" }), ["status_changed"]);
});
