import { NextResponse } from "next/server";
import { internalErrorResponse } from "../../../lib/apiError";
import { validationErrorResponse } from "../../../lib/apiValidation";
import { getCurrentUserId } from "../../../lib/auth";
import { marketCenter } from "../../../lib/locations";
import { logger } from "../../../lib/logger";
import { enforceRateLimit, getRequestIp } from "../../../lib/rateLimit";
import { resolveTicketmasterVenue } from "../../../lib/ruleWatcher";
import { createWatchArtist, createWatchRule, listWatchRules } from "../../../lib/supabase";
import { parseJson, watchRuleSchema } from "../../../lib/validation";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ rules: await listWatchRules(userId) });
  } catch (error) {
    return internalErrorResponse(error, "watch-rules.GET");
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await enforceRateLimit("watch-rules-write", `${userId}:${getRequestIp(request)}`, 20, 3600);
    const body = await parseJson(request, watchRuleSchema);
    if (body.kind === "artist") {
      const artist = await createWatchArtist({
        userId,
        name: body.label,
        spotifyId: body.spotifyId,
        city: body.city,
        state: body.state,
        country: body.country.toUpperCase(),
      });
      const rules = await listWatchRules(userId);
      const rule = rules.find((item) => item.legacy_watch_artist_id === artist.id);
      return NextResponse.json({ rule }, { status: 201 });
    }
    if (body.kind === "venue") {
      let venue;
      try {
        venue = await resolveTicketmasterVenue({
          venueId: body.ticketmasterVenueId,
          name: body.label,
          city: body.city,
          state: body.state,
          country: body.country,
        });
      } catch (error) {
        logger.error("[api:watch-rules.POST] venue lookup failed", error);
        return NextResponse.json(
          { error: "Venue search is unavailable right now. Try again later." },
          { status: 503 },
        );
      }
      if (!venue) {
        return NextResponse.json(
          { error: "Couldn't find that venue on Ticketmaster. Pick one from the search results." },
          { status: 422 },
        );
      }
      const rule = await createWatchRule({
        userId,
        kind: "venue",
        label: venue.name,
        city: venue.city ?? body.city,
        state: venue.state ?? body.state,
        country: (venue.country ?? body.country).toUpperCase(),
        venue,
      });
      return NextResponse.json({ rule }, { status: 201 });
    }

    const center =
      body.latitude !== undefined && body.longitude !== undefined
        ? { latitude: body.latitude, longitude: body.longitude }
        : marketCenter(body.city, body.state);
    if (!center) {
      return NextResponse.json(
        { error: "Pick a city from the list to center the area on." },
        { status: 422 },
      );
    }
    const rule = await createWatchRule({
      userId,
      kind: "location",
      label: body.label,
      city: body.city,
      state: body.state,
      country: body.country.toUpperCase(),
      latitude: center.latitude,
      longitude: center.longitude,
      radiusMiles: body.radiusMiles,
    });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return validationErrorResponse(error) ?? internalErrorResponse(error, "watch-rules.POST");
  }
}
