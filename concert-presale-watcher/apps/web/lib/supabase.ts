import { assertSupabaseConfig, env } from "./env";
import type {
  AlertRecord,
  AlertType,
  EventRecord,
  NormalizedEvent,
  SnapshotRecord,
  WatchArtist,
} from "./types";

interface CreateWatchArtistInput {
  name: string;
  spotifyId?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface CreateAlertInput {
  eventId: string;
  alertType: AlertType;
  message: string;
  payload?: Record<string, unknown>;
  sentChannels: string[];
  sentAt: string | null;
}

const getBaseUrl = (): string => {
  assertSupabaseConfig();
  return `${env.supabaseUrl}/rest/v1`;
};

const getAuthHeaders = (): HeadersInit => {
  assertSupabaseConfig();

  return {
    apikey: env.supabaseServiceKey as string,
    Authorization: `Bearer ${env.supabaseServiceKey as string}`,
  };
};

const supabaseRequest = async <T>(
  path: string,
  init: RequestInit = {},
  acceptSingle = false,
): Promise<T> => {
  const headers = new Headers(init.headers);
  const authHeaders = getAuthHeaders();

  Object.entries(authHeaders).forEach(([key, value]) => {
    if (typeof value === "string") {
      headers.set(key, value);
    }
  });

  headers.set("Content-Type", "application/json");
  if (acceptSingle) {
    headers.set("Accept", "application/vnd.pgrst.object+json");
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${body}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
};

export const listWatchArtists = async (): Promise<WatchArtist[]> => {
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    return [];
  }

  return supabaseRequest<WatchArtist[]>(
    "/watch_artists?select=*&order=created_at.desc",
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
};

export const createWatchArtist = async (input: CreateWatchArtistInput): Promise<WatchArtist> => {
  const payload = {
    name: input.name,
    spotify_id: input.spotifyId ?? null,
    city: input.city ?? "",
    state: input.state ?? "",
    country: input.country ?? "US",
  };

  return supabaseRequest<WatchArtist>(
    "/watch_artists?select=*&on_conflict=name,city,country",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    },
    true,
  );
};

export const deleteWatchArtist = async (id: string): Promise<void> => {
  await supabaseRequest<void>(`/watch_artists?id=eq.${id}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal",
    },
  });
};

export const listEvents = async (limit = 100): Promise<EventRecord[]> => {
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    return [];
  }

  return supabaseRequest<EventRecord[]>(
    `/events?select=*&order=updated_at.desc&limit=${limit}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
};

export const getEventBySourceId = async (
  sourceSlug: string,
  sourceEventId: string,
): Promise<EventRecord | null> => {
  const encodedSource = encodeURIComponent(sourceSlug);
  const encodedId = encodeURIComponent(sourceEventId);

  const records = await supabaseRequest<EventRecord[]>(
    `/events?select=*&source_slug=eq.${encodedSource}&source_event_id=eq.${encodedId}&limit=1`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return records[0] ?? null;
};

export const upsertEvent = async (normalized: NormalizedEvent): Promise<EventRecord> => {
  const payload = {
    source_slug: normalized.source_slug,
    source_event_id: normalized.source_event_id,
    watch_artist_id: normalized.watch_artist_id,
    artist_name: normalized.artist_name,
    title: normalized.title,
    venue: normalized.venue,
    city: normalized.city,
    state: normalized.state,
    country: normalized.country,
    start_time: normalized.start_time,
    ticket_url: normalized.ticket_url,
    status: normalized.status,
    on_sale_start: normalized.on_sale_start,
    dedupe_key: normalized.dedupe_key,
    last_seen_at: new Date().toISOString(),
  };

  return supabaseRequest<EventRecord>(
    "/events?select=*&on_conflict=source_slug,source_event_id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
    },
    true,
  );
};

export const getLatestSnapshot = async (eventId: string): Promise<SnapshotRecord | null> => {
  const encodedEventId = encodeURIComponent(eventId);

  const snapshots = await supabaseRequest<SnapshotRecord[]>(
    `/snapshots?select=*&event_id=eq.${encodedEventId}&order=checked_at.desc&limit=1`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  return snapshots[0] ?? null;
};

export const createSnapshot = async (
  eventId: string,
  rawJsonHash: string,
  rawJson: unknown,
): Promise<SnapshotRecord> => {
  return supabaseRequest<SnapshotRecord>(
    "/snapshots?select=*",
    {
      method: "POST",
      body: JSON.stringify({
        event_id: eventId,
        raw_json_hash: rawJsonHash,
        raw_json: rawJson,
      }),
    },
    true,
  );
};

export const listAlerts = async (limit = 50): Promise<AlertRecord[]> => {
  if (!env.supabaseUrl || !env.supabaseServiceKey) {
    return [];
  }

  return supabaseRequest<AlertRecord[]>(
    `/alerts?select=*&order=created_at.desc&limit=${limit}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
};

export const createAlert = async (input: CreateAlertInput): Promise<AlertRecord> => {
  return supabaseRequest<AlertRecord>(
    "/alerts?select=*",
    {
      method: "POST",
      body: JSON.stringify({
        event_id: input.eventId,
        alert_type: input.alertType,
        message: input.message,
        payload: input.payload ?? {},
        sent_channels: input.sentChannels,
        sent_at: input.sentAt,
      }),
    },
    true,
  );
};
