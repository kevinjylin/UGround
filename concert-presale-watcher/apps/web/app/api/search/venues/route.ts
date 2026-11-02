import { NextResponse } from "next/server";
import { validationErrorResponse } from "../../../../lib/apiValidation";
import { getCurrentUserId } from "../../../../lib/auth";
import { logger } from "../../../../lib/logger";
import { enforceRateLimit, getRequestIp } from "../../../../lib/rateLimit";
import { searchTicketmasterVenues } from "../../../../lib/sources/ticketmaster";
import { searchQuerySchema } from "../../../../lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchQuerySchema.parse(searchParams.get("q") ?? "");
    const state = searchParams.get("state")?.trim().slice(0, 40) || null;
    await enforceRateLimit("venue-search", `${userId}:${getRequestIp(request)}`, 120, 3600);

    const venues = await searchTicketmasterVenues(query, { stateCode: state, countryCode: "US" });
    return NextResponse.json({ venues });
  } catch (error) {
    const handled = validationErrorResponse(error);
    if (handled) return handled;
    logger.error("[api:search.venues] venue search failed", error);
    return NextResponse.json(
      { error: "Venue search is unavailable right now." },
      { status: 503 },
    );
  }
}
