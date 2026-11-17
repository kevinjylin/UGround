import { randomBytes, timingSafeEqual } from "node:crypto";
import { decryptSecret, encryptSecret } from "./notificationCrypto";

export type { SpotifyConnectResult } from "./spotifyConnect";

/**
 * One-time "Connect Spotify" import. The authorization code flow runs once,
 * the access token lives in a short encrypted httpOnly cookie for the length
 * of the import, and no refresh token is ever stored.
 */

export const SPOTIFY_SCOPES = ["user-follow-read", "user-top-read"] as const;
export const SPOTIFY_COOKIE_PATH = "/api/integrations/spotify";
export const SPOTIFY_STATE_COOKIE = "uground_spotify_state";
export const SPOTIFY_TOKEN_COOKIE = "uground_spotify_token";
export const SPOTIFY_CALLBACK_PATH = "/api/integrations/spotify/callback";

/** How long the user has to finish signing in to Spotify. */
export const STATE_TTL_SECONDS = 10 * 60;
/** How long the access token is kept for picking artists. Spotify's own expiry is an hour. */
export const TOKEN_TTL_SECONDS = 15 * 60;

export const spotifyRedirectUri = (appUrl: string | undefined, requestOrigin: string): string =>
  `${(appUrl || requestOrigin).replace(/\/+$/, "")}${SPOTIFY_CALLBACK_PATH}`;

export const buildSpotifyAuthorizeUrl = (input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string => {
  const params = new URLSearchParams({
    client_id: input.clientId,
    response_type: "code",
    redirect_uri: input.redirectUri,
    scope: SPOTIFY_SCOPES.join(" "),
    state: input.state,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
};

interface SealedState {
  state: string;
  userId: string;
  exp: number;
}

interface SealedToken {
  token: string;
  userId: string;
  exp: number;
}

const readSealed = <T>(value: string | undefined | null): T | null => {
  if (!value) return null;
  // Only full 16-byte GCM tags: decryptSecret would otherwise accept a truncated one.
  const tag = value.split(":")[2];
  if (!tag || Buffer.from(tag, "base64").length !== 16) return null;
  try {
    return JSON.parse(decryptSecret(value) ?? "null") as T | null;
  } catch {
    return null;
  }
};

const safeEqual = (a: string, b: string): boolean => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/** A fresh `state` for the authorize URL, and the encrypted cookie that remembers it. */
export const createOAuthState = (
  userId: string,
  now = Date.now(),
): { state: string; cookie: string } => {
  const state = randomBytes(24).toString("base64url");
  const sealed: SealedState = { state, userId, exp: now + STATE_TTL_SECONDS * 1000 };
  return { state, cookie: encryptSecret(JSON.stringify(sealed)) };
};

export type StateCheck = "ok" | "missing" | "mismatch" | "expired";

/** Check the `state` Spotify sent back against the cookie set when the flow started. */
export const verifyOAuthState = (
  cookie: string | undefined | null,
  returnedState: string | null,
  userId: string,
  now = Date.now(),
): StateCheck => {
  const sealed = readSealed<SealedState>(cookie);
  if (!sealed || !returnedState) return "missing";
  if (!safeEqual(sealed.state, returnedState) || sealed.userId !== userId) return "mismatch";
  if (sealed.exp <= now) return "expired";
  return "ok";
};

/** Encrypt the access token for a cookie that expires before the token does. */
export const sealAccessToken = (
  token: string,
  userId: string,
  expiresInSeconds: number,
  now = Date.now(),
): { cookie: string; maxAge: number } => {
  const maxAge = Math.max(1, Math.min(TOKEN_TTL_SECONDS, Math.floor(expiresInSeconds) - 60));
  const sealed: SealedToken = { token, userId, exp: now + maxAge * 1000 };
  return { cookie: encryptSecret(JSON.stringify(sealed)), maxAge };
};

export type OpenedToken = { status: "ok"; token: string } | { status: "missing" | "expired" };

export const openAccessToken = (
  cookie: string | undefined | null,
  userId: string,
  now = Date.now(),
): OpenedToken => {
  const sealed = readSealed<SealedToken>(cookie);
  // A cookie for another account is treated as if it weren't there.
  if (!sealed || sealed.userId !== userId || typeof sealed.token !== "string") return { status: "missing" };
  if (sealed.exp <= now) return { status: "expired" };
  return { status: "ok", token: sealed.token };
};

export const spotifyCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: SPOTIFY_COOKIE_PATH,
  maxAge,
});
