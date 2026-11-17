import { env } from "../env";
import { fetchWithRetry } from "../fetchWithRetry";
import { marketCenter } from "../locations";
import { logger } from "../logger";
import { normalizeState, stateMatches } from "../state";
import { saveArtistAttraction } from "../store/artists";
import type {
  DiscoveredEvent,
  NormalizedEvent,
  SaleWindow,
  VenueSuggestion,
  WatchArtist,
} from "../types";
import { asIsoOrNull, buildDedupeKey, foldText, normalizeStatus } from "../utils";
import type { SourceAdapter } from "./types";

const API_BASE = "https://app.ticketmaster.com/discovery/v2";

/** Ticketmaster caps page size at 200. */
const MAX_PAGE_SIZE = "200";

/** Ticketmaster only serves results while size * page < 1000. */
const DEEP_PAGING_LIMIT = 1000;

/**
 * How far one job pages through a result set. The dispatcher gives jobs
 * about 30 seconds and Ticketmaster allows 5 requests a second and 5000 a
 * day, so a job stops after `maxPages`, after `maxElapsedMs`, and waits
 * `minIntervalMs` between pages. Mutable so tests can drop the wait.
 */
export const ticketmasterPaging = {
  maxPages: 5,
  maxElapsedMs: 15_000,
  minIntervalMs: 250,
};

/** Radius around an artist's city when the watch doesn't set one. */
export const DEFAULT_ARTIST_RADIUS_MILES = 50;

/** How long to wait before looking up an artist Ticketmaster didn't list. */
const ATTRACTION_RECHECK_MS = 7 * 24 * 3600 * 1000;

interface TicketmasterVenue {
  id?: string;
  name?: string;
  city?: { name?: string };
  state?: { stateCode?: string };
  country?: { countryCode?: string };
  address?: { line1?: string };
  location?: { latitude?: string; longitude?: string };
}

interface TicketmasterImage {
  url?: string;
  ratio?: string;
  width?: number;
  height?: number;
  fallback?: boolean;
}

interface TicketmasterPriceRange {
  type?: string;
  currency?: string;
  min?: number;
  max?: number;
}

interface TicketmasterAttraction {
  id?: string;
  name?: string;
  aliases?: string[];
  classifications?: Array<{ segment?: { id?: string; name?: string } }>;
  upcomingEvents?: { _total?: number };
}

interface TicketmasterEvent {
  id?: string;
  name?: string;
  url?: string;
  images?: TicketmasterImage[];
  priceRanges?: TicketmasterPriceRange[];
  dates?: {
    start?: {
      dateTime?: string;
      localDate?: string;
    };
    status?: {
      code?: string;
    };
  };
  sales?: {
    public?: {
      startDateTime?: string;
    };
    presales?: Array<{
      name?: string;
      url?: string;
      startDateTime?: string;
      endDateTime?: string;
    }>;
  };
  _embedded?: {
    venues?: TicketmasterVenue[];
    attractions?: TicketmasterAttraction[];
  };
}

interface TicketmasterPage {
  size?: number;
  totalElements?: number;
  totalPages?: number;
  number?: number;
}

interface TicketmasterEventsResponse {
  _embedded?: {
    events?: TicketmasterEvent[];
  };
  page?: TicketmasterPage;
}

interface TicketmasterAttractionsResponse {
  _embedded?: {
    attractions?: TicketmasterAttraction[];
  };
}

interface TicketmasterVenuesResponse {
  _embedded?: {
    venues?: TicketmasterVenue[];
  };
}

const ticketmasterGet = async <T>(path: string, params: URLSearchParams, label: string): Promise<T | null> => {
  params.set("apikey", env.ticketmasterApiKey as string);
  const response = await fetchWithRetry(
    `${API_BASE}${path}?${params.toString()}`,
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
    { label: `ticketmaster:${label}` },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ticketmaster request failed (${response.status}) for ${label}: ${body.slice(0, 220)}`);
  }

  return (await response.json()) as T;
};

/** Ticketmaster rejects ISO timestamps that carry milliseconds. */
export const toTicketmasterDateTime = (date: Date): string =>
  date.toISOString().replace(/\.\d{3}Z$/, "Z");

const GEOHASH_BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** Ticketmaster's `geoPoint` filter takes a geohash rather than lat/long. */
export const encodeGeohash = (latitude: number, longitude: number, precision = 9): string => {
  const lat: [number, number] = [-90, 90];
  const lon: [number, number] = [-180, 180];
  let hash = "";
  let bits = 0;
  let value = 0;
  let evenBit = true;

  while (hash.length < precision) {
    const range = evenBit ? lon : lat;
    const coordinate = evenBit ? longitude : latitude;
    const mid = (range[0] + range[1]) / 2;
    if (coordinate >= mid) {
      value = (value << 1) | 1;
      range[0] = mid;
    } else {
      value <<= 1;
      range[1] = mid;
    }
    evenBit = !evenBit;
    bits += 1;
    if (bits === 5) {
      hash += GEOHASH_BASE32[value];
      bits = 0;
      value = 0;
    }
  }

  return hash;
};

const toSaleWindows = (event: TicketmasterEvent, publicStart: string | null): SaleWindow[] => [
  ...(event.sales?.presales ?? []).map((presale) => ({
    kind: "presale" as const,
    name: presale.name?.trim() || "Presale",
    url: presale.url ?? event.url ?? null,
    starts_at: asIsoOrNull(presale.startDateTime),
    ends_at: asIsoOrNull(presale.endDateTime),
  })),
  ...(publicStart
    ? [{
        kind: "public" as const,
        name: "Public sale",
        url: event.url ?? null,
        starts_at: publicStart,
        ends_at: null,
      }]
    : []),
];

// ---------------------------------------------------------------------------
// Enrichment
// ---------------------------------------------------------------------------

/** Wide enough for a feed card without pulling a 2048px original. */
const TARGET_IMAGE_WIDTH = 640;
const RATIO_PREFERENCE = ["16_9", "3_2", "4_3"];

/**
 * The event's own image (Ticketmaster's generic fallbacks are skipped), in
 * the widest-preferred ratio, at the smallest width that still fills a card.
 */
export const pickTicketmasterImage = (images: TicketmasterImage[] | undefined): string | null => {
  const own = (images ?? []).filter((image) => image.url && !image.fallback);
  if (own.length === 0) return null;
  const ratioRank = (image: TicketmasterImage) => {
    const rank = RATIO_PREFERENCE.indexOf(image.ratio ?? "");
    return rank === -1 ? RATIO_PREFERENCE.length : rank;
  };
  const bestRatio = Math.min(...own.map(ratioRank));
  const inRatio = own.filter((image) => ratioRank(image) === bestRatio);
  const width = (image: TicketmasterImage) => image.width ?? 0;
  const bigEnough = inRatio.filter((image) => width(image) >= TARGET_IMAGE_WIDTH);
  const chosen = bigEnough.length > 0
    ? bigEnough.reduce((a, b) => (width(b) < width(a) ? b : a))
    : inRatio.reduce((a, b) => (width(b) > width(a) ? b : a));
  return chosen.url ?? null;
};

const finiteOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

/**
 * One price range across the event's ranges. Ranges in another currency than
 * the first standard one are left out rather than mixed in.
 */
export const pickTicketmasterPrice = (
  ranges: TicketmasterPriceRange[] | undefined,
): { price_min: number | null; price_max: number | null; price_currency: string | null } => {
  const usable = (ranges ?? []).filter(
    (range) => finiteOrNull(range.min) !== null || finiteOrNull(range.max) !== null,
  );
  const primary = usable.find((range) => range.type === "standard") ?? usable[0];
  if (!primary) return { price_min: null, price_max: null, price_currency: null };
  const currency = primary.currency?.trim().toUpperCase() || null;
  const same = usable.filter((range) => (range.currency?.trim().toUpperCase() || null) === currency);
  const mins = same.map((range) => finiteOrNull(range.min) ?? finiteOrNull(range.max)).filter((n): n is number => n !== null);
  const maxes = same.map((range) => finiteOrNull(range.max) ?? finiteOrNull(range.min)).filter((n): n is number => n !== null);
  return {
    price_min: mins.length > 0 ? Math.min(...mins) : null,
    price_max: maxes.length > 0 ? Math.max(...maxes) : null,
    price_currency: currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
  };
};

/** Normalize an act name for comparison: case, accents, "&", a leading "The", punctuation. */
export const normalizeActName = (value: string | null | undefined): string =>
  foldText(value ?? "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the\s+/, "")
    .replace(/\s+/g, " ");

/** Other acts on the bill in billing order, headliner (the first attraction) excluded. */
export const lineupOf = (attractions: TicketmasterAttraction[] | undefined): string[] => {
  const names = (attractions ?? []).map((attraction) => attraction.name?.trim() ?? "").filter(Boolean);
  const [headliner, ...rest] = names;
  const seen = new Set([normalizeActName(headliner)]);
  const lineup: string[] = [];
  for (const name of rest) {
    const key = normalizeActName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    lineup.push(name);
  }
  return lineup;
};

export const extractTicketmasterEnrichment = (event: TicketmasterEvent) => ({
  image_url: pickTicketmasterImage(event.images),
  ...pickTicketmasterPrice(event.priceRanges),
  lineup: lineupOf(event._embedded?.attractions),
});

const toDiscoveredEvent = (
  event: TicketmasterEvent & { id: string },
  artistName: string,
  defaults: { city?: string | null; country?: string | null } = {},
): DiscoveredEvent => {
  const venue = event._embedded?.venues?.[0];
  const startTime = asIsoOrNull(event.dates?.start?.dateTime ?? event.dates?.start?.localDate ?? null);
  const publicStart = asIsoOrNull(event.sales?.public?.startDateTime ?? null);

  return {
    source_slug: "ticketmaster",
    source_event_id: event.id,
    artist_name: artistName,
    title: event.name ?? `${artistName} event`,
    venue: venue?.name ?? null,
    city: venue?.city?.name ?? defaults.city ?? null,
    state: venue?.state?.stateCode ?? null,
    country: venue?.country?.countryCode ?? defaults.country ?? null,
    start_time: startTime,
    ticket_url: event.url ?? null,
    status: normalizeStatus(event.dates?.status?.code),
    on_sale_start: publicStart,
    sale_windows: toSaleWindows(event, publicStart),
    ...extractTicketmasterEnrichment(event),
    dedupe_key: buildDedupeKey(artistName, venue?.name ?? null, startTime, event.dates?.start?.localDate),
    raw_json: event,
  };
};

const hasId = (event: TicketmasterEvent): event is TicketmasterEvent & { id: string } => Boolean(event.id);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Follow an event search's pages until the results run out, the deep-paging
 * limit, or the job's page and time caps. A failure on the first page throws;
 * a failure on a later page keeps what was already fetched.
 */
export const fetchTicketmasterEventPages = async (
  params: URLSearchParams,
  label: string,
  options: { maxPages?: number } = {},
): Promise<TicketmasterEvent[]> => {
  const size = Number(params.get("size") ?? MAX_PAGE_SIZE) || Number(MAX_PAGE_SIZE);
  const maxPages = Math.min(options.maxPages ?? ticketmasterPaging.maxPages, Math.floor(DEEP_PAGING_LIMIT / size));
  const startedAt = Date.now();
  const byId = new Map<string, TicketmasterEvent>();
  const withoutId: TicketmasterEvent[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    if (page > 0) {
      if (Date.now() - startedAt > ticketmasterPaging.maxElapsedMs) {
        logger.warn(`[ticketmaster:${label}] stopped paging after ${page} pages to stay inside the job's time budget`);
        break;
      }
      await sleep(ticketmasterPaging.minIntervalMs);
    }

    params.set("page", String(page));
    let body: TicketmasterEventsResponse | null;
    try {
      body = await ticketmasterGet<TicketmasterEventsResponse>("/events.json", params, label);
    } catch (error) {
      if (page === 0) throw error;
      logger.warn(`[ticketmaster:${label}] page ${page} failed; keeping ${byId.size} events`, error);
      break;
    }

    const events = body?._embedded?.events ?? [];
    for (const event of events) {
      // A page boundary can shift between requests; keep one copy per id.
      if (event.id) byId.set(event.id, event);
      else withoutId.push(event);
    }

    const totalPages = body?.page?.totalPages;
    if (events.length < size) break;
    if (typeof totalPages === "number" && page + 1 >= totalPages) break;
  }

  return [...byId.values(), ...withoutId];
};

/** Venue and area results aren't tied to one artist, so name them by headliner. */
const headlinerOf = (event: TicketmasterEvent): string =>
  event._embedded?.attractions?.[0]?.name?.trim() || event.name?.trim() || "Unknown artist";

// ---------------------------------------------------------------------------
// Artist search
// ---------------------------------------------------------------------------

/**
 * Pick the attraction a followed artist name means. Only names (or listed
 * aliases) equal to the artist after normalization count, so "Air" never
 * resolves to "Air Supply" or a tribute act. Music attractions win over
 * others with the same name, then the one with more upcoming events. Returns
 * null rather than guessing.
 */
export const pickAttractionMatch = (
  artistName: string,
  attractions: TicketmasterAttraction[],
): TicketmasterAttraction | null => {
  const wanted = normalizeActName(artistName);
  if (!wanted) return null;

  const isMusic = (attraction: TicketmasterAttraction) => {
    const segments = (attraction.classifications ?? []).map((c) => c.segment?.name?.toLowerCase()).filter(Boolean);
    return segments.length === 0 || segments.includes("music");
  };

  const scored = attractions
    .filter((attraction): attraction is TicketmasterAttraction & { id: string } => Boolean(attraction.id))
    .map((attraction) => {
      let score = 0;
      if (normalizeActName(attraction.name) === wanted) score = 2;
      else if ((attraction.aliases ?? []).some((alias) => normalizeActName(alias) === wanted)) score = 1;
      if (score > 0 && isMusic(attraction)) score += 2;
      return { attraction, score, upcoming: attraction.upcomingEvents?._total ?? 0 };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.upcoming - a.upcoming);

  return scored[0]?.attraction ?? null;
};

export const searchTicketmasterAttraction = async (artistName: string): Promise<TicketmasterAttraction | null> => {
  const params = new URLSearchParams({
    keyword: artistName,
    classificationName: "music",
    includeTest: "no",
    size: "20",
  });
  const body = await ticketmasterGet<TicketmasterAttractionsResponse>(
    "/attractions.json",
    params,
    `attraction ${artistName}`,
  );
  return pickAttractionMatch(artistName, body?._embedded?.attractions ?? []);
};

/**
 * The artist's attraction id: the saved one, or a fresh lookup on the first
 * poll (saved either way). An artist with no match is looked up again weekly.
 */
const resolveArtistAttractionId = async (artist: WatchArtist, now: Date): Promise<string | null> => {
  if (artist.ticketmaster_attraction_id) return artist.ticketmaster_attraction_id;
  const checkedAt = artist.ticketmaster_attraction_checked_at
    ? Date.parse(artist.ticketmaster_attraction_checked_at)
    : Number.NaN;
  if (Number.isFinite(checkedAt) && now.getTime() - checkedAt < ATTRACTION_RECHECK_MS) return null;

  const match = await searchTicketmasterAttraction(artist.name);
  const attractionId = match?.id ?? null;
  try {
    await saveArtistAttraction(artist.id, attractionId, now);
  } catch (error) {
    // Not fatal: the lookup just runs again next poll.
    logger.warn(`[ticketmaster] couldn't save attraction for ${artist.name}`, error);
  }
  return attractionId;
};

/**
 * Keyword results only count when the artist is billed under exactly that
 * name (an attraction on the event, or the event title itself), not when the
 * name merely appears inside a longer one.
 */
export const isStrictArtistMatch = (artistName: string, event: TicketmasterEvent): boolean => {
  const wanted = normalizeActName(artistName);
  if (!wanted) return false;
  const attractions = event._embedded?.attractions ?? [];
  if (attractions.some((attraction) => normalizeActName(attraction.name) === wanted)) return true;
  return attractions.length === 0 && normalizeActName(event.name) === wanted;
};

type LocationFilter =
  | { kind: "radius"; params: Record<string, string> }
  | { kind: "place"; params: Record<string, string> };

const twoLetterState = (state: string | null | undefined): string | null => {
  const normalized = normalizeState(state);
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : null;
};

/**
 * Where an artist watch looks. A city with known coordinates searches a radius
 * around it (so the rest of the metro counts); other cities search that exact
 * city. State-only and country-only watches filter by those.
 */
export const artistLocationFilter = (artist: WatchArtist): LocationFilter | null => {
  const stateCode = twoLetterState(artist.state);
  const countryCode = artist.country && artist.country.length === 2 ? artist.country.toUpperCase() : null;
  const params: Record<string, string> = {};
  if (countryCode) params.countryCode = countryCode;

  if (artist.city) {
    const center = !countryCode || countryCode === "US" ? marketCenter(artist.city, stateCode) : null;
    if (center) {
      const radius = artist.radius_miles && artist.radius_miles > 0 ? artist.radius_miles : DEFAULT_ARTIST_RADIUS_MILES;
      return {
        kind: "radius",
        params: {
          ...params,
          geoPoint: encodeGeohash(center.latitude, center.longitude),
          radius: String(Math.round(radius)),
          unit: "miles",
        },
      };
    }
    params.city = artist.city;
  }
  if (stateCode) params.stateCode = stateCode;

  return Object.keys(params).length > 0 ? { kind: "place", params } : null;
};

/** Pages one artist search follows; an artist rarely has more than 400 dates. */
const ARTIST_MAX_PAGES = 2;

const runTicketmasterQuery = async (
  artist: WatchArtist,
  attractionId: string | null,
  location: LocationFilter | null,
): Promise<TicketmasterEvent[]> => {
  const params = new URLSearchParams({
    classificationName: "music",
    includeTest: "no",
    size: MAX_PAGE_SIZE,
    sort: "date,asc",
  });
  if (attractionId) params.set("attractionId", attractionId);
  else params.set("keyword", artist.name);
  for (const [key, value] of Object.entries(location?.params ?? {})) params.set(key, value);

  return fetchTicketmasterEventPages(params, `artist ${artist.name}`, { maxPages: ARTIST_MAX_PAGES });
};

export const fetchTicketmasterEvents = async (
  artist: WatchArtist,
  now = new Date(),
): Promise<NormalizedEvent[]> => {
  if (!env.ticketmasterApiKey) {
    return [];
  }

  const attractionId = await resolveArtistAttractionId(artist, now);
  const location = artistLocationFilter(artist);
  let events = await runTicketmasterQuery(artist, attractionId, location);
  // Inside the radius the metro counts even across a state line.
  let skipStateFilter = location?.kind === "radius";

  if (events.length === 0 && location) {
    events = await runTicketmasterQuery(artist, attractionId, null);
    skipStateFilter = false;
  }

  return events
    .filter(hasId)
    .filter((event) => Boolean(attractionId) || isStrictArtistMatch(artist.name, event))
    .map((event) => ({
      ...toDiscoveredEvent(event, artist.name, { city: artist.city, country: artist.country }),
      user_id: artist.user_id,
      watch_artist_id: artist.id,
    }) satisfies NormalizedEvent)
    .filter((event) => skipStateFilter || stateMatches(artist.state, event.state));
};

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------

const toNumberOrNull = (value: string | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toVenueSuggestion = (venue: TicketmasterVenue & { id: string }): VenueSuggestion => ({
  id: venue.id,
  name: venue.name?.trim() || "Unnamed venue",
  city: venue.city?.name ?? null,
  state: venue.state?.stateCode ?? null,
  country: venue.country?.countryCode ?? null,
  address: venue.address?.line1 ?? null,
  latitude: toNumberOrNull(venue.location?.latitude),
  longitude: toNumberOrNull(venue.location?.longitude),
});

export const searchTicketmasterVenues = async (
  query: string,
  options: { stateCode?: string | null; countryCode?: string | null } = {},
): Promise<VenueSuggestion[]> => {
  if (!env.ticketmasterApiKey) {
    throw new Error("TICKETMASTER_API_KEY is not configured");
  }

  const params = new URLSearchParams({ keyword: query, includeTest: "no", size: "10" });
  const stateCode = normalizeState(options.stateCode ?? null);
  if (stateCode && /^[A-Z]{2}$/.test(stateCode)) params.set("stateCode", stateCode);
  if (options.countryCode?.length === 2) params.set("countryCode", options.countryCode.toUpperCase());

  const body = await ticketmasterGet<TicketmasterVenuesResponse>("/venues.json", params, `venue search ${query}`);
  return (body?._embedded?.venues ?? [])
    .filter((venue): venue is TicketmasterVenue & { id: string } => Boolean(venue.id))
    .map(toVenueSuggestion);
};

export const getTicketmasterVenue = async (venueId: string): Promise<VenueSuggestion | null> => {
  if (!env.ticketmasterApiKey) {
    throw new Error("TICKETMASTER_API_KEY is not configured");
  }

  const venue = await ticketmasterGet<TicketmasterVenue>(
    `/venues/${encodeURIComponent(venueId)}.json`,
    new URLSearchParams(),
    `venue ${venueId}`,
  );
  return venue?.id ? toVenueSuggestion(venue as TicketmasterVenue & { id: string }) : null;
};

const normalizeVenueName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^the\s+/, "")
    .trim();

/**
 * Pick the venue a typed name most likely means. Exact name matches win,
 * then names that contain each other; a matching city breaks ties. Returns
 * null rather than guessing when nothing resembles the name.
 */
export const pickVenueMatch = (
  name: string,
  city: string | null | undefined,
  candidates: VenueSuggestion[],
): VenueSuggestion | null => {
  const wanted = normalizeVenueName(name);
  const wantedCity = city?.trim().toLowerCase() || null;
  if (!wanted) return null;

  const scored = candidates
    .map((venue) => {
      const candidate = normalizeVenueName(venue.name);
      let score = 0;
      if (candidate === wanted) score = 3;
      else if (candidate.includes(wanted) || wanted.includes(candidate)) score = 2;
      if (score > 0 && wantedCity && venue.city?.toLowerCase() === wantedCity) score += 1;
      return { venue, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.venue ?? null;
};

/** Every upcoming concert at one Ticketmaster venue. */
export const fetchTicketmasterVenueEvents = async (venueId: string): Promise<DiscoveredEvent[]> => {
  const params = new URLSearchParams({
    venueId,
    classificationName: "music",
    includeTest: "no",
    size: MAX_PAGE_SIZE,
    sort: "date,asc",
  });
  const events = await fetchTicketmasterEventPages(params, `venue ${venueId}`);
  return events.filter(hasId).map((event) => toDiscoveredEvent(event, headlinerOf(event)));
};

// ---------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------

/**
 * Concerts within a radius whose public on-sale is still ahead (or began in
 * the last day), soonest on-sale first, paged up to the deep-paging limit.
 * Areas can hold more shows than that, so this tracks what is about to go on
 * sale, which is what new announcements look like, instead of a date-sorted
 * slice whose edge would keep moving.
 */
export const fetchTicketmasterAreaEvents = async (
  area: { latitude: number; longitude: number; radiusMiles: number },
  now = new Date(),
): Promise<DiscoveredEvent[]> => {
  const params = new URLSearchParams({
    geoPoint: encodeGeohash(area.latitude, area.longitude),
    radius: String(area.radiusMiles),
    unit: "miles",
    classificationName: "music",
    includeTest: "no",
    onsaleStartDateTime: toTicketmasterDateTime(new Date(now.getTime() - 24 * 3600 * 1000)),
    size: MAX_PAGE_SIZE,
    sort: "onSaleStartDate,asc",
  });
  const label = `area ${area.latitude.toFixed(2)},${area.longitude.toFixed(2)}`;
  const events = await fetchTicketmasterEventPages(params, label);
  return events.filter(hasId).map((event) => toDiscoveredEvent(event, headlinerOf(event)));
};

export const ticketmasterAdapter: SourceAdapter = {
  slug: "ticketmaster",
  capabilities: { artist: true, venue: true, location: true, presales: true },
  configured: () => Boolean(env.ticketmasterApiKey),
  fetchForArtist: (artist) => fetchTicketmasterEvents(artist),
};
