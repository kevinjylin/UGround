import { env } from "../env";
import type { ArtistSuggestion } from "../types";

export interface SpotifyArtist {
  id: string;
  name: string;
  popularity: number;
  external_urls?: {
    spotify?: string;
  };
  images?: {
    height: number | null;
    url: string;
    width: number | null;
  }[];
}

interface SpotifyTokenResponse {
  access_token: string;
  expires_in: number;
}

interface SpotifyArtistsResponse {
  artists: SpotifyArtist[];
}

interface SpotifyArtistSearchResponse {
  artists: {
    items: SpotifyArtist[];
  };
}

interface SpotifyPlaylistTracksResponse {
  items: Array<{
    track?: {
      artists?: SpotifyArtist[];
    } | null;
  }>;
  next: string | null;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

const wait = async (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const getAccessToken = async (): Promise<string> => {
  if (!env.spotifyClientId || !env.spotifyClientSecret) {
    throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 5_000) {
    return cachedToken.token;
  }

  const basic = Buffer.from(`${env.spotifyClientId}:${env.spotifyClientSecret}`).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Spotify token request failed (${response.status})`);
  }

  const body = (await response.json()) as SpotifyTokenResponse;
  cachedToken = {
    token: body.access_token,
    expiresAt: now + body.expires_in * 1000,
  };

  return body.access_token;
};

const artistToSuggestion = (artist: SpotifyArtist): ArtistSuggestion => ({
  id: artist.id,
  name: artist.name,
  imageUrl: artist.images?.[0]?.url ?? null,
  profileUrl: artist.external_urls?.spotify ?? null,
});

const startsWithQuery = (name: string, query: string): boolean =>
  name.trim().toLowerCase().startsWith(query.trim().toLowerCase());

export const getSpotifyArtistsByIds = async (ids: string[]): Promise<SpotifyArtist[]> => {
  const cleaned = ids
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 50);

  if (cleaned.length === 0) {
    return [];
  }

  let token = await getAccessToken();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(
      `https://api.spotify.com/v1/artists?ids=${encodeURIComponent(cleaned.join(","))}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (response.ok) {
      const body = (await response.json()) as SpotifyArtistsResponse;
      return body.artists ?? [];
    }

    const errorText = await response.text();

    if ((response.status === 401 || response.status === 403) && attempt < 1) {
      cachedToken = null;
      token = await getAccessToken();
      continue;
    }

    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      const retryAfterSeconds = Number(response.headers.get("Retry-After") ?? "0");
      const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 600;
      await wait(delayMs);
      continue;
    }

    throw new Error(
      `Spotify artists request failed (${response.status}): ${errorText.slice(0, 280) || "no response body"}`,
    );
  }

  throw new Error("Spotify artists request failed after retries");
};

export const searchSpotifyArtists = async (
  query: string,
): Promise<ArtistSuggestion[]> => {
  const cleaned = query.trim();
  if (cleaned.length < 2) {
    return [];
  }

  let token = await getAccessToken();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const params = new URLSearchParams({
      q: cleaned,
      type: "artist",
      limit: "10",
    });

    const response = await fetch(
      `https://api.spotify.com/v1/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (response.ok) {
      const body = (await response.json()) as SpotifyArtistSearchResponse;
      return (body.artists?.items ?? [])
        .filter((artist) => startsWithQuery(artist.name, cleaned))
        .map(artistToSuggestion);
    }

    const errorText = await response.text();

    if ((response.status === 401 || response.status === 403) && attempt < 1) {
      cachedToken = null;
      token = await getAccessToken();
      continue;
    }

    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      const retryAfterSeconds = Number(response.headers.get("Retry-After") ?? "0");
      const delayMs =
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : 600;
      await wait(delayMs);
      continue;
    }

    throw new Error(
      `Spotify artist search failed (${response.status}): ${errorText.slice(0, 280) || "no response body"}`,
    );
  }

  throw new Error("Spotify artist search failed after retries");
};

export const parseSpotifyPlaylistId = (value: string): string => {
  const trimmed = value.trim();
  if (/^[A-Za-z0-9]{10,80}$/.test(trimmed)) return trimmed;
  const url = new URL(trimmed);
  if (!["open.spotify.com", "www.open.spotify.com"].includes(url.hostname)) {
    throw new Error("Use a public open.spotify.com playlist URL.");
  }
  const match = url.pathname.match(/^\/playlist\/([A-Za-z0-9]+)\/?$/);
  if (!match?.[1]) throw new Error("Use a valid Spotify playlist URL.");
  return match[1];
};

export const getPublicPlaylistArtists = async (
  playlistUrl: string,
): Promise<SpotifyArtist[]> => {
  const playlistId = parseSpotifyPlaylistId(playlistUrl);
  let token = await getAccessToken();
  let next: string | null =
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=100&fields=items(track(artists(id,name,popularity,external_urls,images))),next`;
  const artists = new Map<string, SpotifyArtist>();
  let pages = 0;

  while (next && pages < 5) {
    const response = await fetch(next, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (response.status === 401 && pages === 0) {
      cachedToken = null;
      token = await getAccessToken();
      continue;
    }
    if (!response.ok) {
      throw new Error(`Spotify playlist request failed (${response.status}).`);
    }
    const body = (await response.json()) as SpotifyPlaylistTracksResponse;
    for (const item of body.items ?? []) {
      for (const artist of item.track?.artists ?? []) {
        if (artist.id && artist.name) artists.set(artist.id, artist);
      }
    }
    next = body.next;
    pages += 1;
  }

  return [...artists.values()].sort(
    (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0) || a.name.localeCompare(b.name),
  );
};

export const spotifyArtistToSuggestion = artistToSuggestion;

// ---------------------------------------------------------------------------
// Connected account (authorization code flow, one-time import)
// ---------------------------------------------------------------------------

/** Spotify rejected the user's token: expired, revoked, or not allowed for this app. */
export class SpotifyAccountError extends Error {
  constructor(
    public readonly reason: "expired" | "forbidden",
    message: string,
  ) {
    super(message);
  }
}

export const exchangeSpotifyCode = async (
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; expiresIn: number }> => {
  if (!env.spotifyClientId || !env.spotifyClientSecret) {
    throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
  }
  const basic = Buffer.from(`${env.spotifyClientId}:${env.spotifyClientSecret}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Spotify code exchange failed (${response.status})`);
  }
  // The response also carries a refresh token. It is dropped here on purpose:
  // the import is one-time and nothing is kept past the access token's cookie.
  const body = (await response.json()) as SpotifyTokenResponse;
  return { accessToken: body.access_token, expiresIn: body.expires_in };
};

const fetchWithUserToken = async <T>(url: string, token: string): Promise<T> => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (response.ok) return (await response.json()) as T;
    if (response.status === 401) {
      throw new SpotifyAccountError("expired", "Spotify access token expired");
    }
    if (response.status === 403) {
      throw new SpotifyAccountError("forbidden", "Spotify refused access for this account");
    }
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      const retryAfterSeconds = Number(response.headers.get("Retry-After") ?? "0");
      await wait(Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? Math.min(retryAfterSeconds, 5) * 1000 : 600);
      continue;
    }
    throw new Error(`Spotify account request failed (${response.status})`);
  }
  throw new Error("Spotify account request failed after retries");
};

export interface SpotifyAccountArtist extends ArtistSuggestion {
  followed: boolean;
  top: boolean;
}

/** Most followed artists we list from one account, and how many top artists. */
export const ACCOUNT_FOLLOWED_LIMIT = 50;
export const ACCOUNT_TOP_LIMIT = 50;

/**
 * Artists the user follows on Spotify and their top artists, merged by id.
 * Followed artists come first, sorted by name; top-only artists follow in
 * Spotify's ranking.
 */
export const getSpotifyAccountArtists = async (token: string): Promise<SpotifyAccountArtist[]> => {
  const [followed, top] = await Promise.all([
    fetchWithUserToken<{ artists: { items: SpotifyArtist[] } }>(
      `https://api.spotify.com/v1/me/following?type=artist&limit=${ACCOUNT_FOLLOWED_LIMIT}`,
      token,
    ),
    fetchWithUserToken<{ items: SpotifyArtist[] }>(
      `https://api.spotify.com/v1/me/top/artists?limit=${ACCOUNT_TOP_LIMIT}&time_range=medium_term`,
      token,
    ),
  ]);
  const topIds = new Set((top.items ?? []).map((artist) => artist.id));
  const merged = new Map<string, SpotifyAccountArtist>();
  const followedItems = [...(followed.artists?.items ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  for (const artist of followedItems) {
    if (!artist.id || !artist.name) continue;
    merged.set(artist.id, { ...artistToSuggestion(artist), followed: true, top: topIds.has(artist.id) });
  }
  for (const artist of top.items ?? []) {
    if (!artist.id || !artist.name || merged.has(artist.id)) continue;
    merged.set(artist.id, { ...artistToSuggestion(artist), followed: false, top: true });
  }
  return [...merged.values()];
};
