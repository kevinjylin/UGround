import { env } from "../env";

export interface SpotifyArtist {
  id: string;
  name: string;
  popularity: number;
}

interface SpotifyTokenResponse {
  access_token: string;
  expires_in: number;
}

interface SpotifyArtistsResponse {
  artists: SpotifyArtist[];
}

let cachedToken: { token: string; expiresAt: number } | null = null;

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

export const getSpotifyArtistsByIds = async (ids: string[]): Promise<SpotifyArtist[]> => {
  const cleaned = ids
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 50);

  if (cleaned.length === 0) {
    return [];
  }

  const token = await getAccessToken();
  const response = await fetch(`https://api.spotify.com/v1/artists?ids=${encodeURIComponent(cleaned.join(","))}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Spotify artists request failed (${response.status})`);
  }

  const body = (await response.json()) as SpotifyArtistsResponse;
  return body.artists ?? [];
};
