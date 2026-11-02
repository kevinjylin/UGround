import { env } from "../env";
import { fetchWithRetry } from "../fetchWithRetry";
import { normalizeState, stateMatches } from "../state";
import type {
  DiscoveredEvent,
  NormalizedEvent,
  SaleWindow,
  VenueSuggestion,
  WatchArtist,
} from "../types";
import { asIsoOrNull, buildDedupeKey, normalizeStatus } from "../utils";
import type { SourceAdapter } from "./types";

const API_BASE = "https://app.ticketmaster.com/discovery/v2";

/** Ticketmaster caps page size at 200. */
const MAX_PAGE_SIZE = "200";

interface TicketmasterVenue {
  id?: string;
  name?: string;
  city?: { name?: string };
  state?: { stateCode?: string };
  country?: { countryCode?: string };
  address?: { line1?: string };
  location?: { latitude?: string; longitude?: string };
}

interface TicketmasterEvent {
  id?: string;
  name?: string;
  url?: string;
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
    attractions?: Array<{ name?: string }>;
  };
}

interface TicketmasterEventsResponse {
  _embedded?: {
    events?: TicketmasterEvent[];
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
    dedupe_key: buildDedupeKey(artistName, venue?.name ?? null, startTime),
    raw_json: event,
  };
};

const hasId = (event: TicketmasterEvent): event is TicketmasterEvent & { id: string } => Boolean(event.id);

/** Venue and area results aren't tied to one artist, so name them by headliner. */
const headlinerOf = (event: TicketmasterEvent): string =>
  event._embedded?.attractions?.[0]?.name?.trim() || event.name?.trim() || "Unknown artist";

// ---------------------------------------------------------------------------
// Artist search
// ---------------------------------------------------------------------------

const isLikelyArtistMatch = (artistName: string, event: TicketmasterEvent): boolean => {
  const artistLower = artistName.toLowerCase();
  const titleMatch = (event.name ?? "").toLowerCase().includes(artistLower);
  const attractionMatch =
    event._embedded?.attractions?.some((attraction) =>
      (attraction.name ?? "").toLowerCase().includes(artistLower),
    ) ?? false;

  return titleMatch || attractionMatch;
};

const normalizeEvents = (artist: WatchArtist, events: TicketmasterEvent[]): NormalizedEvent[] => {
  return events
    .filter(hasId)
    .filter((event) => isLikelyArtistMatch(artist.name, event))
    .map((event) => ({
      ...toDiscoveredEvent(event, artist.name, { city: artist.city, country: artist.country }),
      user_id: artist.user_id,
      watch_artist_id: artist.id,
    }) satisfies NormalizedEvent)
    .filter((event) => stateMatches(artist.state, event.state));
};

const runTicketmasterQuery = async (artist: WatchArtist, withLocation: boolean): Promise<TicketmasterEvent[]> => {
  const params = new URLSearchParams({
    keyword: artist.name,
    classificationName: "music",
    includeTest: "no",
    size: "100",
    sort: "date,asc",
  });

  if (withLocation && artist.city) {
    params.set("city", artist.city);
  }

  const normalizedArtistState = normalizeState(artist.state);
  if (withLocation && normalizedArtistState && /^[A-Z]{2}$/.test(normalizedArtistState)) {
    params.set("stateCode", normalizedArtistState);
  }

  if (withLocation && artist.country && artist.country.length === 2) {
    params.set("countryCode", artist.country);
  }

  const body = await ticketmasterGet<TicketmasterEventsResponse>(
    "/events.json",
    params,
    `artist ${artist.name}`,
  );
  return body?._embedded?.events ?? [];
};

export const fetchTicketmasterEvents = async (artist: WatchArtist): Promise<NormalizedEvent[]> => {
  if (!env.ticketmasterApiKey) {
    return [];
  }

  const withLocation = Boolean(artist.city || artist.state || artist.country);
  let events = await runTicketmasterQuery(artist, withLocation);

  if (events.length === 0 && withLocation) {
    events = await runTicketmasterQuery(artist, false);
  }

  return normalizeEvents(artist, events);
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
  const body = await ticketmasterGet<TicketmasterEventsResponse>("/events.json", params, `venue ${venueId}`);
  return (body?._embedded?.events ?? []).filter(hasId).map((event) => toDiscoveredEvent(event, headlinerOf(event)));
};

// ---------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------

/**
 * Concerts within a radius whose public on-sale is still ahead (or began in
 * the last day). Areas hold far more shows than one page can return, so this
 * tracks what is about to go on sale, which is what new announcements look
 * like, instead of a date-sorted slice whose edge would keep moving.
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
  const body = await ticketmasterGet<TicketmasterEventsResponse>("/events.json", params, label);
  return (body?._embedded?.events ?? []).filter(hasId).map((event) => toDiscoveredEvent(event, headlinerOf(event)));
};

export const ticketmasterAdapter: SourceAdapter = {
  slug: "ticketmaster",
  capabilities: { artist: true, venue: true, location: true, presales: true },
  configured: () => Boolean(env.ticketmasterApiKey),
  fetchForArtist: fetchTicketmasterEvents,
};
