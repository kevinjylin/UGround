import { NextResponse } from "next/server";
import { internalErrorResponse } from "../../../../lib/apiError";
import { validationErrorResponse } from "../../../../lib/apiValidation";
import { getCurrentUserId } from "../../../../lib/auth";
import { parseUserStateBody } from "../../../../lib/feedQuery";
import { enforceRateLimit } from "../../../../lib/rateLimit";
import { setEventUserState } from "../../../../lib/store/events";
import { uuidSchema } from "../../../../lib/validation";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

/** Marks a show interested, going or hidden. `{ "state": null }` clears it. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const eventId = uuidSchema.parse(id);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = undefined;
    }
    const state = parseUserStateBody(body);
    if (state === undefined) {
      return NextResponse.json(
        { error: 'Send { "state": "interested" | "going" | "hidden" | null }.' },
        { status: 400 },
      );
    }

    await enforceRateLimit("event-state", userId, 600, 3600);
    const event = await setEventUserState(eventId, userId, state);
    if (!event) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error) {
    return validationErrorResponse(error) ?? internalErrorResponse(error, "events.PATCH");
  }
}
