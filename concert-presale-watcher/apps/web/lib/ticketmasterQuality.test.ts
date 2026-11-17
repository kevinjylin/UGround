import assert from "node:assert/strict";
import test from "node:test";

// env.ts reads process.env at import time, so set it before loading modules.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://db.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
process.env.TICKETMASTER_API_KEY = "tm-key";

const tm = await import("./sources/ticketmaster");
const { songkickLineup } = await import("./sources/songkick");
const { bandsintownLineup } = await import("./sources/bandsintown");
const { buildDedupeKey } = await import("./utils");
const { differs } = await import("./ruleWatcher");

const {
  encodeGeohash,
  extractTicketmasterEnrichment,
  fetchTicketmasterAreaEvents,
  fetchTicketmasterEvents,
  fetchTicketmasterVenueEvents,
  isStrictArtistMatch,
  pickAttractionMatch,
  ticketmasterPaging,
} = tm;

ticketmasterPaging.minIntervalMs = 0;

type Call = { method: string; url: string; body: unknown };

const state = {
  calls: [] as Call[],
  attractions: [] as unknown[],
  /** Events for a request, given its query params. */
  events: (() => ({ _embedded: { events: [] } })) as (params: URLSearchParams) => unknown,
};

const reset = (patch: Partial<typeof state> = {}) => {
  Object.assign(state, { calls: [], attractions: [], events: () => ({ _embedded: { events: [] } }) }, patch);
};

globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = String(input);
  const method = init.method ?? "GET";
  state.calls.push({ method, url, body: typeof init.body === "string" ? JSON.parse(init.body) : null });
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
  if (url.startsWith("https://app.ticketmaster.com/discovery/v2/attractions.json")) {
    return json({ _embedded: { attractions: state.attractions } });
  }
  if (url.startsWith("https://app.ticketmaster.com/discovery/v2/events.json")) {
    return json(state.events(new URL(url).searchParams));
  }
  if (method === "GET") return json([]);
  return new Response(null, { status: 204 });
}) as typeof fetch;

const tmCalls = (path: string) =>
  state.calls.filter((call) => call.url.startsWith(`https://app.ticketmaster.com/discovery/v2/${path}`));
const paramsOf = (call: Call | undefined) => new URL(call!.url).searchParams;

const artist = (fields: Record<string, unknown> = {}) => ({
  id: "wa-1",
  user_id: "user-1",
  name: "Air",
  spotify_id: null,
  city: null,
  state: null,
  country: "US",
  created_at: "",
  updated_at: "",
  ...fields,
});

const attraction = (id: string, name: string, fields: Record<string, unknown> = {}) => ({
  id,
  name,
  classifications: [{ segment: { name: "Music" } }],
  upcomingEvents: { _total: 1 },
  ...fields,
});

const event = (id: string, attractions: string[], fields: Record<string, unknown> = {}) => ({
  id,
  name: `${attractions[0] ?? "Someone"} live`,
  url: `https://tm.test/${id}`,
  dates: { start: { dateTime: "2027-03-15T03:00:00Z", localDate: "2027-03-14" }, status: { code: "onsale" } },
  _embedded: {
    venues: [{ name: "The Fillmore", city: { name: "San Francisco" }, state: { stateCode: "CA" }, country: { countryCode: "US" } }],
    attractions: attractions.map((name) => ({ name })),
  },
  ...fields,
});

// ---------------------------------------------------------------------------
// Attraction matching
// ---------------------------------------------------------------------------

test("attraction matching takes exact normalized names only and won't guess", () => {
  const candidates = [
    attraction("supply", "Air Supply", { upcomingEvents: { _total: 90 } }),
    attraction("tribute", "Air - A Tribute"),
    attraction("air", "AIR"),
  ];
  assert.equal(pickAttractionMatch("Air", candidates)?.id, "air");
  assert.equal(pickAttractionMatch("Moon Safari", candidates), null);
  // "The", "&", case and accents don't matter.
  assert.equal(pickAttractionMatch("Beyonce", [attraction("b", "Beyoncé")])?.id, "b");
  assert.equal(pickAttractionMatch("Mumford and Sons", [attraction("m", "Mumford & Sons")])?.id, "m");
  assert.equal(pickAttractionMatch("Killers", [attraction("k", "The Killers")])?.id, "k");
});

test("attraction matching prefers music, then the busier act, and accepts aliases", () => {
  const sports = attraction("heat-team", "Heat", { classifications: [{ segment: { name: "Sports" } }], upcomingEvents: { _total: 40 } });
  const band = attraction("heat-band", "Heat", { upcomingEvents: { _total: 2 } });
  assert.equal(pickAttractionMatch("Heat", [sports, band])?.id, "heat-band");
  const quiet = attraction("q", "Wednesday", { upcomingEvents: { _total: 0 } });
  const busy = attraction("b", "Wednesday", { upcomingEvents: { _total: 12 } });
  assert.equal(pickAttractionMatch("Wednesday", [quiet, busy])?.id, "b");
  assert.equal(pickAttractionMatch("Ye", [attraction("kw", "Kanye West", { aliases: ["ye"] })])?.id, "kw");
  // An exact name beats an alias.
  assert.equal(
    pickAttractionMatch("Ye", [attraction("kw", "Kanye West", { aliases: ["ye"] }), attraction("ye", "Ye")])?.id,
    "ye",
  );
});

test("a first poll resolves the attraction, saves it, and searches by attraction id", async () => {
  reset({
    attractions: [attraction("supply", "Air Supply"), attraction("K8vZ917Kew0", "Air")],
    events: () => ({ _embedded: { events: [event("e1", ["Air", "Nouvelle Vague"])] }, page: { totalPages: 1, number: 0 } }),
  });
  const now = new Date("2026-11-16T00:00:00Z");

  const events = await fetchTicketmasterEvents(artist(), now);

  assert.equal(paramsOf(tmCalls("attractions.json")[0]).get("classificationName"), "music");
  const [save] = state.calls.filter((call) => call.method === "PATCH" && call.url.includes("/watch_artists?id=eq.wa-1"));
  assert.deepEqual(save?.body, { ticketmaster_attraction_id: "K8vZ917Kew0", ticketmaster_attraction_checked_at: now.toISOString() });
  const params = paramsOf(tmCalls("events.json")[0]);
  assert.equal(params.get("attractionId"), "K8vZ917Kew0");
  assert.equal(params.get("keyword"), null);
  assert.deepEqual(events.map((e) => e.source_event_id), ["e1"]);
});

test("a saved attraction id is used without another lookup", async () => {
  reset({ events: () => ({ _embedded: { events: [event("e1", ["Opener", "Air"])] } }) });
  const events = await fetchTicketmasterEvents(artist({ ticketmaster_attraction_id: "K8vZ917Kew0" }));
  assert.equal(tmCalls("attractions.json").length, 0);
  assert.equal(state.calls.filter((call) => call.method === "PATCH").length, 0);
  assert.equal(paramsOf(tmCalls("events.json")[0]).get("attractionId"), "K8vZ917Kew0");
  // Attraction search is exact, so a show where Air supports still counts.
  assert.equal(events.length, 1);
});

test("with no attraction, keyword results must bill the artist by exactly that name", async () => {
  reset({
    attractions: [attraction("supply", "Air Supply")],
    events: () => ({
      _embedded: {
        events: [
          event("supply", ["Air Supply"]),
          event("tribute", ["Moon Safari: an Air Tribute"]),
          event("real", ["Air"]),
          event("support", ["Phoenix", "AIR"]),
          event("untagged", [], { name: "Air" }),
          event("untagged-tour", [], { name: "Air: Moon Safari Tour" }),
        ],
      },
    }),
  });
  const now = new Date("2026-11-16T00:00:00Z");
  const events = await fetchTicketmasterEvents(artist(), now);

  const [save] = state.calls.filter((call) => call.method === "PATCH");
  assert.deepEqual(save?.body, { ticketmaster_attraction_id: null, ticketmaster_attraction_checked_at: now.toISOString() });
  assert.equal(paramsOf(tmCalls("events.json")[0]).get("keyword"), "Air");
  assert.deepEqual(events.map((e) => e.source_event_id), ["real", "support", "untagged"]);
});

test("an artist Ticketmaster didn't list is looked up again only after a week", async () => {
  const now = new Date("2026-11-16T00:00:00Z");
  reset();
  await fetchTicketmasterEvents(artist({ ticketmaster_attraction_checked_at: "2026-11-12T00:00:00Z" }), now);
  assert.equal(tmCalls("attractions.json").length, 0);
  assert.equal(paramsOf(tmCalls("events.json")[0]).get("keyword"), "Air");

  reset();
  await fetchTicketmasterEvents(artist({ ticketmaster_attraction_checked_at: "2026-11-01T00:00:00Z" }), now);
  assert.equal(tmCalls("attractions.json").length, 1);
});

test("isStrictArtistMatch ignores names that only contain the artist", () => {
  assert.equal(isStrictArtistMatch("Air", event("x", ["Air Supply"])), false);
  assert.equal(isStrictArtistMatch("Air", event("x", ["The Air"])), true);
});

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

test("an artist's listed city searches a radius around it, across state lines", async () => {
  reset({
    events: () => ({
      _embedded: {
        events: [
          event("hammond", ["Air"], {
            _embedded: { venues: [{ name: "Horseshoe", city: { name: "Hammond" }, state: { stateCode: "IN" } }], attractions: [{ name: "Air" }] },
          }),
        ],
      },
    }),
  });
  const events = await fetchTicketmasterEvents(
    artist({ ticketmaster_attraction_id: "a1", city: "Chicago", state: "Illinois", radius_miles: 30 }),
  );
  const params = paramsOf(tmCalls("events.json")[0]);
  assert.equal(params.get("geoPoint"), encodeGeohash(41.88, -87.63));
  assert.equal(params.get("radius"), "30");
  assert.equal(params.get("unit"), "miles");
  assert.equal(params.get("city"), null);
  assert.equal(params.get("stateCode"), null);
  assert.equal(params.get("countryCode"), "US");
  assert.deepEqual(events.map((e) => e.source_event_id), ["hammond"]);
});

test("a null radius means 50 miles", async () => {
  reset();
  await fetchTicketmasterEvents(artist({ ticketmaster_attraction_id: "a1", city: "Chicago", state: "IL", radius_miles: null }));
  assert.equal(paramsOf(tmCalls("events.json")[0]).get("radius"), "50");
});

test("a city without known coordinates keeps the exact city and state filters", async () => {
  reset();
  await fetchTicketmasterEvents(artist({ ticketmaster_attraction_id: "a1", city: "Fresno", state: "CA" }));
  const params = paramsOf(tmCalls("events.json")[0]);
  assert.equal(params.get("city"), "Fresno");
  assert.equal(params.get("stateCode"), "CA");
  assert.equal(params.get("geoPoint"), null);
});

test("state-only and country-only watches keep filtering, and fall back without location", async () => {
  reset();
  await fetchTicketmasterEvents(artist({ ticketmaster_attraction_id: "a1", state: "TX" }));
  const [first, fallback] = tmCalls("events.json");
  assert.equal(paramsOf(first).get("stateCode"), "TX");
  assert.equal(paramsOf(first).get("countryCode"), "US");
  assert.equal(paramsOf(fallback).get("stateCode"), null);

  reset({ events: (params) => ({ _embedded: { events: params.get("countryCode") ? [] : [event("ca", ["Air"])] } }) });
  // The fallback's results are still held to the watch's state.
  const events = await fetchTicketmasterEvents(artist({ ticketmaster_attraction_id: "a1", state: "TX" }));
  assert.equal(events.length, 0);

  reset();
  await fetchTicketmasterEvents(artist({ ticketmaster_attraction_id: "a1", country: "GB" }));
  assert.equal(paramsOf(tmCalls("events.json")[0]).get("countryCode"), "GB");
});

// ---------------------------------------------------------------------------
// Paging
// ---------------------------------------------------------------------------

const pagedEvents = (total: number) => (params: URLSearchParams) => {
  const size = Number(params.get("size"));
  const page = Number(params.get("page"));
  const ids = Array.from({ length: total }, (_, i) => `e${i}`).slice(page * size, page * size + size);
  return {
    _embedded: { events: ids.map((id) => event(id, ["Band"])) },
    page: { size, number: page, totalElements: total, totalPages: Math.ceil(total / size) },
  };
};

test("venue checks follow pages until the results run out", async () => {
  reset({ events: pagedEvents(450) });
  const events = await fetchTicketmasterVenueEvents("venue-1");
  assert.deepEqual(tmCalls("events.json").map((call) => paramsOf(call).get("page")), ["0", "1", "2"]);
  assert.equal(events.length, 450);
});

test("paging stops at Ticketmaster's deep-paging limit", async () => {
  reset({ events: pagedEvents(5000) });
  const events = await fetchTicketmasterAreaEvents({ latitude: 41.88, longitude: -87.63, radiusMiles: 25 });
  // 200 per page, and size * page must stay under 1000.
  assert.equal(tmCalls("events.json").length, 5);
  assert.equal(events.length, 1000);
});

test("paging stops at the job's page cap and time budget", async () => {
  const saved = { ...ticketmasterPaging };
  try {
    reset({ events: pagedEvents(5000) });
    ticketmasterPaging.maxPages = 2;
    await fetchTicketmasterVenueEvents("venue-1");
    assert.equal(tmCalls("events.json").length, 2);

    reset({ events: pagedEvents(5000) });
    ticketmasterPaging.maxPages = 5;
    ticketmasterPaging.maxElapsedMs = -1;
    await fetchTicketmasterVenueEvents("venue-1");
    assert.equal(tmCalls("events.json").length, 1);
  } finally {
    Object.assign(ticketmasterPaging, saved);
  }
});

test("a later page failing keeps the earlier pages; a first page failing throws", async () => {
  reset({
    events: (params) => (params.get("page") === "1" ? { fault: "boom" } : pagedEvents(450)(params)),
  });
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("events.json") && new URL(url).searchParams.get("page") === "1") {
      return new Response("nope", { status: 400 });
    }
    return original(input, init);
  }) as typeof fetch;
  try {
    const events = await fetchTicketmasterVenueEvents("venue-1");
    assert.equal(events.length, 200);
    globalThis.fetch = (async () => new Response("nope", { status: 400 })) as typeof fetch;
    await assert.rejects(fetchTicketmasterVenueEvents("venue-1"));
  } finally {
    globalThis.fetch = original;
  }
});

// ---------------------------------------------------------------------------
// Enrichment
// ---------------------------------------------------------------------------

test("enrichment picks a card-sized own image, one price range, and the supporting acts", () => {
  const enrichment = extractTicketmasterEnrichment({
    images: [
      { url: "https://img.test/fallback.jpg", ratio: "16_9", width: 640, height: 360, fallback: true },
      { url: "https://img.test/4x3.jpg", ratio: "4_3", width: 305, height: 225, fallback: false },
      { url: "https://img.test/16x9-small.jpg", ratio: "16_9", width: 205, height: 115, fallback: false },
      { url: "https://img.test/16x9-card.jpg", ratio: "16_9", width: 1024, height: 576, fallback: false },
      { url: "https://img.test/16x9-huge.jpg", ratio: "16_9", width: 2048, height: 1152, fallback: false },
    ],
    priceRanges: [
      { type: "standard", currency: "USD", min: 35.5, max: 89 },
      { type: "standard including fees", currency: "USD", min: 42, max: 105 },
      { type: "standard", currency: "CAD", min: 10, max: 500 },
    ],
    _embedded: { attractions: [{ name: "Air" }, { name: "Nouvelle Vague" }, { name: "AIR" }, { name: "Phoenix" }] },
  });
  assert.deepEqual(enrichment, {
    image_url: "https://img.test/16x9-card.jpg",
    price_min: 35.5,
    price_max: 105,
    price_currency: "USD",
    lineup: ["Nouvelle Vague", "Phoenix"],
  });
});

test("enrichment is empty when the payload has none, and fallbacks aren't used", () => {
  assert.deepEqual(extractTicketmasterEnrichment({}), {
    image_url: null,
    price_min: null,
    price_max: null,
    price_currency: null,
    lineup: [],
  });
  assert.equal(
    extractTicketmasterEnrichment({ images: [{ url: "https://img.test/f.jpg", fallback: true }] }).image_url,
    null,
  );
  // Without a wide-enough image, take the widest of the best ratio.
  assert.equal(
    extractTicketmasterEnrichment({
      images: [
        { url: "https://img.test/a.jpg", ratio: "3_2", width: 305 },
        { url: "https://img.test/b.jpg", ratio: "3_2", width: 500 },
      ],
    }).image_url,
    "https://img.test/b.jpg",
  );
});

test("saved Ticketmaster events carry the enrichment and a local-date dedupe key", async () => {
  reset({
    events: () => ({
      _embedded: {
        events: [
          event("e1", ["Air", "Opener"], {
            images: [{ url: "https://img.test/x.jpg", ratio: "16_9", width: 640 }],
            priceRanges: [{ type: "standard", currency: "usd", min: 20, max: 40 }],
          }),
        ],
      },
    }),
  });
  const [saved] = await fetchTicketmasterVenueEvents("venue-1");
  assert.equal(saved?.image_url, "https://img.test/x.jpg");
  assert.equal(saved?.price_currency, "USD");
  assert.deepEqual(saved?.lineup, ["Opener"]);
  // 03:00Z on the 15th is the evening of the 14th in San Francisco.
  assert.equal(saved?.dedupe_key, "air::the-fillmore::2027-03-14");
});

test("Songkick and Bandsintown lineups drop headliners and the followed artist", () => {
  assert.deepEqual(
    songkickLineup(
      {
        id: 1,
        displayName: "x",
        performance: [
          { billing: "support", billingIndex: 3, artist: { displayName: "Third" } },
          { billing: "headline", billingIndex: 1, artist: { displayName: "Air" } },
          { billing: "support", billingIndex: 2, artist: { displayName: "Second" } },
        ],
      },
      "Air",
    ),
    ["Second", "Third"],
  );
  assert.deepEqual(bandsintownLineup({ id: "1", lineup: ["Phoenix", "Air", "Opener"] }, "Air"), ["Opener"]);
});

test("dedupe keys use the source's local date and fold accents", () => {
  assert.equal(buildDedupeKey("Beyoncé", "Venue", "2027-03-15T03:00:00.000Z", "2027-03-14"), "beyonce::venue::2027-03-14");
  // Bandsintown's floating local datetime.
  assert.equal(buildDedupeKey("Air", "Venue", "2027-03-14T20:00:00.000Z", "2027-03-14T20:00:00"), "air::venue::2027-03-14");
  // Without a local date, the UTC day as before.
  assert.equal(buildDedupeKey("Air", "Venue", "2027-03-15T03:00:00.000Z"), "air::venue::2027-03-15");
  assert.equal(buildDedupeKey("Air", null, null, "garbage"), "air::unknown::unknown-day");
});

test("rule rows are rewritten quietly for lineup, price and a first image, not for image churn", () => {
  const base = {
    id: "r", user_id: "u", source_slug: "ticketmaster" as const, source_event_id: "e", watch_artist_id: null, watch_rule_id: "rule",
    artist_name: "Air", title: "Air live", venue: "V", city: null, state: null, country: null,
    start_time: "2027-03-15T03:00:00.000Z", ticket_url: null, status: "onsale" as const, on_sale_start: null, sale_windows: [],
    image_url: "https://img.test/a.jpg", price_min: 20, price_max: 40, price_currency: "USD", lineup: ["Opener"],
    dedupe_key: "air::v::2027-03-14", last_seen_at: "", created_at: "", updated_at: "",
  };
  const next = {
    source_slug: "ticketmaster" as const, source_event_id: "e", artist_name: "Air", title: "Air live", venue: "V",
    city: null, state: null, country: null, start_time: "2027-03-15T03:00:00Z", ticket_url: null, status: "onsale" as const,
    on_sale_start: null, sale_windows: [], image_url: "https://img.test/a.jpg", price_min: 20, price_max: 40,
    price_currency: "USD", lineup: ["Opener"], dedupe_key: "air::v::2027-03-14", raw_json: {},
  };
  assert.equal(differs(base, next), false);
  // numeric columns can come back as strings.
  assert.equal(differs({ ...base, price_min: "20.00" as unknown as number }, next), false);
  assert.equal(differs(base, { ...next, image_url: "https://img.test/rotated.jpg" }), false);
  assert.equal(differs({ ...base, image_url: null }, next), true);
  assert.equal(differs(base, { ...next, lineup: ["Opener", "Late add"] }), true);
  assert.equal(differs(base, { ...next, price_max: 55 }), true);
  assert.equal(differs({ ...base, dedupe_key: "air::v::2027-03-15" }, next), true);
});
