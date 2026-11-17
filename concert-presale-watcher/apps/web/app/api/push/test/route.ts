import { NextResponse } from "next/server";
import { internalErrorResponse } from "../../../../lib/apiError";
import { validationErrorResponse } from "../../../../lib/apiValidation";
import { getCurrentUserId } from "../../../../lib/auth";
import { enforceRateLimit, getRequestIp } from "../../../../lib/rateLimit";
import { countPushSubscriptions } from "../../../../lib/store/pushSubscriptions";
import { isPushConfigured, sendPushToUser } from "../../../../lib/webPush";

export const runtime = "nodejs";

/** Send a test notification to every browser the current user turned push on in. */
export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await enforceRateLimit("push-test", `${userId}:${getRequestIp(request)}`, 5, 3600);

    if (!isPushConfigured()) {
      return NextResponse.json({ error: "Browser notifications aren't set up on this server." }, { status: 503 });
    }
    if ((await countPushSubscriptions(userId)) === 0) {
      return NextResponse.json({ error: "Turn on notifications in this browser first." }, { status: 400 });
    }

    const sent = await sendPushToUser(userId, {
      title: "UGround test alert",
      body: "Browser notifications are working. Alerts for your watchlist will show up like this.",
      url: "/dashboard",
    });
    if (!sent) {
      return NextResponse.json(
        { error: "No browser accepted the test. Try turning notifications off and on again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return validationErrorResponse(error) ?? internalErrorResponse(error, "push.test");
  }
}
