import { NextResponse } from "next/server";
import { internalErrorResponse } from "../../../../lib/apiError";
import { getCurrentUserId } from "../../../../lib/auth";
import { getVapidConfig } from "../../../../lib/webPush";

export const runtime = "nodejs";

/** The VAPID public key a browser needs to subscribe. `configured: false` when push isn't set up. */
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vapid = getVapidConfig();
    return NextResponse.json({
      configured: vapid !== null,
      publicKey: vapid?.publicKey ?? null,
    });
  } catch (error) {
    return internalErrorResponse(error, "push.public-key");
  }
}
