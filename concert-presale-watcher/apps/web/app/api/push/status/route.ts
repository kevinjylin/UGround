import { NextResponse } from "next/server";
import { internalErrorResponse } from "../../../../lib/apiError";
import { validationErrorResponse } from "../../../../lib/apiValidation";
import { getCurrentUserId } from "../../../../lib/auth";
import { pushEndpointSchema } from "../../../../lib/pushSubscriptionInput";
import { enforceRateLimit, getRequestIp } from "../../../../lib/rateLimit";
import { hasPushSubscriptionForEndpoint } from "../../../../lib/store/pushSubscriptions";
import { parseJson } from "../../../../lib/validation";

export const runtime = "nodejs";

/**
 * Whether this browser's subscription is saved for the signed-in user. A browser
 * can still hold a subscription saved under another account that signed in here.
 * POST so the endpoint, which works like a bearer URL, stays out of query strings.
 */
export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await enforceRateLimit("push-status", `${userId}:${getRequestIp(request)}`, 120, 3600);

    const { endpoint } = await parseJson(request, pushEndpointSchema);
    const subscribed = await hasPushSubscriptionForEndpoint(userId, endpoint);
    return NextResponse.json({ subscribed });
  } catch (error) {
    return validationErrorResponse(error) ?? internalErrorResponse(error, "push.status");
  }
}
