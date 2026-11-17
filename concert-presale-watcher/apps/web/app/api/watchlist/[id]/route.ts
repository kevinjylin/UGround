import { NextResponse } from "next/server";
import { internalErrorResponse } from "../../../../lib/apiError";
import { validationErrorResponse } from "../../../../lib/apiValidation";
import { getCurrentUserId } from "../../../../lib/auth";
import { enforceRateLimit, getRequestIp } from "../../../../lib/rateLimit";
import { updateWatchArtistLocation, WatchArtistConflictError } from "../../../../lib/store/watchArtists";
import { deleteWatchArtist } from "../../../../lib/supabase";
import { parseJson, uuidSchema } from "../../../../lib/validation";
import { toArtistLocation, watchArtistUpdateSchema } from "../../../../lib/watchlistLocation";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await enforceRateLimit("watchlist-write", `${userId}:${getRequestIp(request)}`, 20, 3600);
    const { id } = await params;
    const artistId = uuidSchema.parse(id);
    const location = toArtistLocation(await parseJson(request, watchArtistUpdateSchema));

    try {
      const artist = await updateWatchArtistLocation(artistId, userId, location);
      if (!artist) {
        return NextResponse.json({ error: "Artist not found." }, { status: 404 });
      }
      return NextResponse.json({ artist });
    } catch (error) {
      if (error instanceof WatchArtistConflictError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    return validationErrorResponse(error) ?? internalErrorResponse(error, "watchlist.PATCH");
  }
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await deleteWatchArtist(uuidSchema.parse(id), userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return validationErrorResponse(error) ?? internalErrorResponse(error, "watchlist.DELETE");
  }
}
