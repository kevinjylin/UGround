import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserId } from "../../../../../lib/auth";
import { env } from "../../../../../lib/env";
import { logger } from "../../../../../lib/logger";
import { exchangeSpotifyCode } from "../../../../../lib/sources/spotify";
import type { SpotifyConnectResult } from "../../../../../lib/spotifyConnect";
import {
  sealAccessToken,
  SPOTIFY_STATE_COOKIE,
  SPOTIFY_TOKEN_COOKIE,
  spotifyCookieOptions,
  spotifyRedirectUri,
  verifyOAuthState,
} from "../../../../../lib/spotifyOAuth";

export const runtime = "nodejs";

/** Spotify sends the browser here after the user allows or denies access. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const finish = (result: SpotifyConnectResult, token?: { cookie: string; maxAge: number }) => {
    const response = NextResponse.redirect(new URL(`/dashboard?spotify=${result}`, request.url));
    // The state is single use, whatever the outcome.
    response.cookies.set(SPOTIFY_STATE_COOKIE, "", spotifyCookieOptions(0));
    if (token) {
      response.cookies.set(SPOTIFY_TOKEN_COOKIE, token.cookie, spotifyCookieOptions(token.maxAge));
    }
    return response;
  };

  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.redirect(new URL("/login?next=/dashboard", request.url));
  }

  const spotifyError = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const check = verifyOAuthState(
    request.cookies.get(SPOTIFY_STATE_COOKIE)?.value,
    url.searchParams.get("state"),
    userId,
  );

  if (check === "missing" || check === "mismatch") return finish("state");
  if (check === "expired") return finish("expired");
  if (spotifyError === "access_denied") return finish("denied");
  if (spotifyError || !code) return finish("error");

  try {
    const { accessToken, expiresIn } = await exchangeSpotifyCode(
      code,
      spotifyRedirectUri(env.appUrl, url.origin),
    );
    return finish("connected", sealAccessToken(accessToken, userId, expiresIn));
  } catch (error) {
    logger.error("[api:spotify.callback] code exchange failed", error);
    return finish("error");
  }
}
