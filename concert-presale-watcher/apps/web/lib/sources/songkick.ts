import { env } from "../env";
import type { NormalizedEvent, WatchArtist } from "../types";
import { asIsoOrNull, buildDedupeKey, foldText } from "../utils";
import type { SourceAdapter } from "./types";

interface SongkickEvent {
  id: number;
  displayName: string;
  uri?: string;
  start?: { datetime?: string; date?: string };
  venue?: { displayName?: string };
  location?: { city?: string };
  status?: string;
  performance?: Array<{
    displayName?: string;
    billing?: string;
    billingIndex?: number;
    artist?: { displayName?: string };
  }>;
}

/** Supporting acts in billing order; headliners and the followed artist are left out. */
export const songkickLineup = (event: SongkickEvent, artistName: string): string[] => {
  const followed = foldText(artistName).trim();
  const seen = new Set<string>();
  return [...(event.performance ?? [])]
    .sort((a, b) => (a.billingIndex ?? 0) - (b.billingIndex ?? 0))
    .filter((performance) => performance.billing !== "headline")
    .map((performance) => (performance.artist?.displayName ?? performance.displayName ?? "").trim())
    .filter((name) => {
      const key = foldText(name).trim();
      if (!key || key === followed || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

interface SongkickResponse {
  resultsPage?: { results?: { event?: SongkickEvent[] } };
}

const fetchForArtist = async (artist: WatchArtist): Promise<NormalizedEvent[]> => {
  if (!env.songkickApiKey) return [];
  const params = new URLSearchParams({
    apikey: env.songkickApiKey,
    artist_name: artist.name,
    per_page: "50",
  });
  const response = await fetch(`https://api.songkick.com/api/3.0/events.json?${params}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Songkick request failed (${response.status})`);
  const body = (await response.json()) as SongkickResponse;
  return (body.resultsPage?.results?.event ?? []).map((event) => {
    const startTime = asIsoOrNull(event.start?.datetime ?? event.start?.date);
    return {
      user_id: artist.user_id,
      source_slug: "songkick",
      source_event_id: String(event.id),
      watch_artist_id: artist.id,
      artist_name: artist.name,
      title: event.displayName,
      venue: event.venue?.displayName ?? null,
      city: event.location?.city?.split(",")[0]?.trim() || artist.city,
      state: artist.state,
      country: artist.country,
      start_time: startTime,
      ticket_url: event.uri ?? null,
      status: event.status === "cancelled" ? "cancelled" : "scheduled",
      on_sale_start: null,
      sale_windows: [],
      // Songkick's events API has no images or prices.
      lineup: songkickLineup(event, artist.name),
      dedupe_key: buildDedupeKey(artist.name, event.venue?.displayName ?? null, startTime, event.start?.date),
      raw_json: event,
    };
  });
};

export const songkickAdapter: SourceAdapter = {
  slug: "songkick",
  capabilities: { artist: true, venue: true, location: true, presales: false },
  configured: () => Boolean(env.songkickApiKey),
  fetchForArtist,
};

