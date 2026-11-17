import { NextResponse } from "next/server";
import { internalErrorResponse } from "../../../../lib/apiError";
import { validationErrorResponse } from "../../../../lib/apiValidation";
import { getCurrentUserId } from "../../../../lib/auth";
import { pushEndpointSchema } from "../../../../lib/pushSubscriptionInput";
import { enforceRateLimit, getRequestIp } from "../../../../lib/rateLimit";
import { deletePushSubscriptionByEndpoint } from "../../../../lib/store/pushSubscriptions";
import { parseJson } from "../../../../lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await enforceRateLimit("push-unsubscribe", `${userId}:${getRequestIp(request)}`, 20, 3600);

    const { endpoint } = await parseJson(request, pushEndpointSchema);
    await deletePushSubscriptionByEndpoint(userId, endpoint);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return validationErrorResponse(error) ?? internalErrorResponse(error, "push.unsubscribe");
  }
}
