import { NextResponse } from "next/server";
import { internalErrorResponse } from "../../../lib/apiError";
import { validationErrorResponse } from "../../../lib/apiValidation";
import { getCurrentUserId } from "../../../lib/auth";
import { enforceRateLimit, getRequestIp } from "../../../lib/rateLimit";
import { getHomeLocation, saveHomeLocation } from "../../../lib/store/profile";
import { parseJson } from "../../../lib/validation";
import { profileSchema, toArtistLocation } from "../../../lib/watchlistLocation";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ home: await getHomeLocation(userId) });
  } catch (error) {
    return internalErrorResponse(error, "profile.GET");
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await enforceRateLimit("profile-write", `${userId}:${getRequestIp(request)}`, 60, 3600);
    const location = toArtistLocation(await parseJson(request, profileSchema));
    const home = await saveHomeLocation(userId, location);
    return NextResponse.json({ home });
  } catch (error) {
    return validationErrorResponse(error) ?? internalErrorResponse(error, "profile.PUT");
  }
}
