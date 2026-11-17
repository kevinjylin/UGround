import { NextResponse, type NextRequest } from "next/server";
import { internalErrorResponse } from "../../../../../lib/apiError";
import { validationErrorResponse } from "../../../../../lib/apiValidation";
import { getCurrentUserId } from "../../../../../lib/auth";
import { enforceRateLimit, getRequestIp } from "../../../../../lib/rateLimit";
import { getSpotifyAccountArtists, SpotifyAccountError } from "../../../../../lib/sources/spotify";
import { SPOTIFY_RESULT_MESSAGES } from "../../../../../lib/spotifyConnect";
import {
  openAccessToken,
  SPOTIFY_TOKEN_COOKIE,
  spotifyCookieOptions,
} from "../../../../../lib/spotifyOAuth";

export const runtime = "nodejs";

const expired = (reason: "expired" | "forbidden" = "expired") => {
  const response = NextResponse.json(
    { error: SPOTIFY_RESULT_MESSAGES[reason], code: reason },
    { status: reason === "expired" ? 401 : 403 },
  );
  response.cookies.set(SPOTIFY_TOKEN_COOKIE, "", spotifyCookieOptions(0));
  return response;
};

/** Followed and top artists from the Spotify account connected for this import. */
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await enforceRateLimit("spotify-account-preview", `${userId}:${getRequestIp(request)}`, 20, 3600);

    const opened = openAccessToken(request.cookies.get(SPOTIFY_TOKEN_COOKIE)?.value, userId);
    if (opened.status !== "ok") return expired();

    try {
      const artists = await getSpotifyAccountArtists(opened.token);
      return NextResponse.json({ artists, count: artists.length });
    } catch (error) {
      if (error instanceof SpotifyAccountError) return expired(error.reason);
      throw error;
    }
  } catch (error) {
    return validationErrorResponse(error) ?? internalErrorResponse(error, "spotify.account-artists");
  }
}
