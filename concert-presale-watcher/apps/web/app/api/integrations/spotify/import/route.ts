import { NextResponse, type NextRequest } from "next/server";
import { internalErrorResponse } from "../../../../../lib/apiError";
import { validationErrorResponse } from "../../../../../lib/apiValidation";
import { getCurrentUserId } from "../../../../../lib/auth";
import { enforceRateLimit, getRequestIp } from "../../../../../lib/rateLimit";
import {
  getPublicPlaylistArtists,
  getSpotifyAccountArtists,
  getSpotifyArtistsByIds,
  SpotifyAccountError,
} from "../../../../../lib/sources/spotify";
import { SPOTIFY_RESULT_MESSAGES } from "../../../../../lib/spotifyConnect";
import {
  openAccessToken,
  SPOTIFY_TOKEN_COOKIE,
  spotifyCookieOptions,
} from "../../../../../lib/spotifyOAuth";
import { normalizeState } from "../../../../../lib/state";
import { createWatchArtist } from "../../../../../lib/supabase";
import { parseJson, spotifyImportSchema } from "../../../../../lib/validation";

export const runtime = "nodejs";

/** Most artists one import creates. */
const IMPORT_LIMIT = 50;

const parseIds = (input: string[] | string | undefined): string[] => {
  if (!input) return [];
  const values = Array.isArray(input) ? input : input.split(/[\s,]+/);
  return [...new Set(values.map((id) => id.trim()).filter(Boolean))].slice(0, IMPORT_LIMIT);
};

const clearToken = (response: NextResponse): NextResponse => {
  response.cookies.set(SPOTIFY_TOKEN_COOKIE, "", spotifyCookieOptions(0));
  return response;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await enforceRateLimit("spotify-import", `${userId}:${getRequestIp(request)}`, 5, 3600);
    const body = await parseJson(request, spotifyImportSchema);

    let artists: Array<{ id: string; name: string }>;
    if (body.account) {
      if (!body.selectedArtistIds?.length) {
        return NextResponse.json({ error: "Pick at least one artist to follow." }, { status: 400 });
      }
      const opened = openAccessToken(request.cookies.get(SPOTIFY_TOKEN_COOKIE)?.value, userId);
      if (opened.status !== "ok") {
        return clearToken(
          NextResponse.json({ error: SPOTIFY_RESULT_MESSAGES.expired, code: "expired" }, { status: 401 }),
        );
      }
      try {
        // Listed again from the account, so only artists the user really has can be imported.
        artists = await getSpotifyAccountArtists(opened.token);
      } catch (error) {
        if (error instanceof SpotifyAccountError) {
          return clearToken(
            NextResponse.json(
              { error: SPOTIFY_RESULT_MESSAGES[error.reason], code: error.reason },
              { status: error.reason === "expired" ? 401 : 403 },
            ),
          );
        }
        throw error;
      }
    } else {
      artists = body.playlistUrl
        ? await getPublicPlaylistArtists(body.playlistUrl)
        : await getSpotifyArtistsByIds(parseIds(body.artistIds));
    }

    if (body.selectedArtistIds?.length) {
      const selected = new Set(body.selectedArtistIds);
      artists = artists.filter((artist) => selected.has(artist.id));
    }
    artists = artists.slice(0, IMPORT_LIMIT);
    const created = await Promise.all(
      artists.map((artist) =>
        createWatchArtist({
          userId,
          name: artist.name,
          spotifyId: artist.id,
          city: body.city,
          state: normalizeState(body.state) ?? undefined,
          country: body.country.toUpperCase(),
          radiusMiles: body.radiusMiles,
        }),
      ),
    );
    const response = NextResponse.json({ imported: created, count: created.length }, { status: 201 });
    // The account import is one-time: the token goes as soon as it's used.
    return body.account ? clearToken(response) : response;
  } catch (error) {
    return validationErrorResponse(error) ?? internalErrorResponse(error, "spotify.import");
  }
}
