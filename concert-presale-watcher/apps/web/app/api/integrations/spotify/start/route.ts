import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserId } from "../../../../../lib/auth";
import { env } from "../../../../../lib/env";
import { logger } from "../../../../../lib/logger";
import { enforceRateLimit, getRequestIp, RateLimitError } from "../../../../../lib/rateLimit";
import type { SpotifyConnectResult } from "../../../../../lib/spotifyConnect";
import {
  buildSpotifyAuthorizeUrl,
  createOAuthState,
  SPOTIFY_STATE_COOKIE,
  SPOTIFY_TOKEN_COOKIE,
  spotifyCookieOptions,
  spotifyRedirectUri,
  STATE_TTL_SECONDS,
} from "../../../../../lib/spotifyOAuth";

export const runtime = "nodejs";

const backToDashboard = (request: NextRequest, result: SpotifyConnectResult) =>
  NextResponse.redirect(new URL(`/dashboard?spotify=${result}`, request.url));

/** Starts "Connect Spotify": sets a state cookie and sends the browser to Spotify. */
export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.redirect(new URL("/login?next=/dashboard", request.url));
  }

  if (!env.spotifyClientId || !env.spotifyClientSecret || !env.alertSettingsEncryptionKey) {
    return backToDashboard(request, "unavailable");
  }

  try {
    await enforceRateLimit("spotify-connect", `${userId}:${getRequestIp(request)}`, 10, 3600);
    const { state, cookie } = createOAuthState(userId);
    const response = NextResponse.redirect(
      buildSpotifyAuthorizeUrl({
        clientId: env.spotifyClientId,
        redirectUri: spotifyRedirectUri(env.appUrl, new URL(request.url).origin),
        state,
      }),
    );
    response.cookies.set(SPOTIFY_STATE_COOKIE, cookie, spotifyCookieOptions(STATE_TTL_SECONDS));
    // A token left from an earlier connection is replaced by this one.
    response.cookies.set(SPOTIFY_TOKEN_COOKIE, "", spotifyCookieOptions(0));
    return response;
  } catch (error) {
    if (!(error instanceof RateLimitError)) logger.error("[api:spotify.start]", error);
    return backToDashboard(request, "error");
  }
}
