import { NextResponse } from "next/server";
import { internalErrorResponse } from "../../../../lib/apiError";
import { validationErrorResponse } from "../../../../lib/apiValidation";
import { getCurrentUserId } from "../../../../lib/auth";
import { pushSubscribeSchema, userAgentLabel } from "../../../../lib/pushSubscriptionInput";
import { enforceRateLimit, getRequestIp } from "../../../../lib/rateLimit";
import { upsertPushSubscription } from "../../../../lib/store/pushSubscriptions";
import { parseJson } from "../../../../lib/validation";
import { isPushConfigured } from "../../../../lib/webPush";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await enforceRateLimit("push-subscribe", `${userId}:${getRequestIp(request)}`, 20, 3600);

    if (!isPushConfigured()) {
      return NextResponse.json({ error: "Browser notifications aren't set up on this server." }, { status: 503 });
    }

    const body = await parseJson(request, pushSubscribeSchema);
    await upsertPushSubscription({
      userId,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgentLabel: userAgentLabel(request.headers.get("user-agent")),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return validationErrorResponse(error) ?? internalErrorResponse(error, "push.subscribe");
  }
}
