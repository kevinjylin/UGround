import { env } from "../env";
import type { NormalizedEvent, WatchArtist } from "../types";
import { asIsoOrNull, buildDedupeKey, normalizeStatus } from "../utils";

interface TicketmasterVenue {
  name?: string;
  city?: { name?: string };
  state?: { stateCode?: string };
  country?: { countryCode?: string };
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
  };
  _embedded?: {
    venues?: TicketmasterVenue[];
  };
}

interface TicketmasterResponse {
  _embedded?: {
    events?: TicketmasterEvent[];
  };
}

export const fetchTicketmasterEvents = async (artist: WatchArtist): Promise<NormalizedEvent[]> => {
  if (!env.ticketmasterApiKey) {
    return [];
  }

  const params = new URLSearchParams({
    apikey: env.ticketmasterApiKey,
    keyword: artist.name,
    size: "40",
    sort: "date,asc",
  });

  if (artist.city) {
    params.set("city", artist.city);
  }

  if (artist.country) {
    params.set("countryCode", artist.country);
  }

  const response = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Ticketmaster request failed (${response.status}) for artist ${artist.name}`);
  }

  const body = (await response.json()) as TicketmasterResponse;
  const events = body._embedded?.events ?? [];

  return events
    .filter((event) => Boolean(event.id))
    .map((event) => {
      const venue = event._embedded?.venues?.[0];
      const startTime = asIsoOrNull(event.dates?.start?.dateTime ?? event.dates?.start?.localDate ?? null);

      return {
        source_slug: "ticketmaster",
        source_event_id: event.id as string,
        watch_artist_id: artist.id,
        artist_name: artist.name,
        title: event.name ?? `${artist.name} event`,
        venue: venue?.name ?? null,
        city: venue?.city?.name ?? artist.city,
        state: venue?.state?.stateCode ?? artist.state,
        country: venue?.country?.countryCode ?? artist.country,
        start_time: startTime,
        ticket_url: event.url ?? null,
        status: normalizeStatus(event.dates?.status?.code),
        on_sale_start: asIsoOrNull(event.sales?.public?.startDateTime ?? null),
        dedupe_key: buildDedupeKey(artist.name, venue?.name ?? null, startTime),
        raw_json: event,
      } satisfies NormalizedEvent;
    });
};
