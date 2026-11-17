import { NextResponse } from "next/server";
import { internalErrorResponse } from "../../../lib/apiError";
import { validationErrorResponse } from "../../../lib/apiValidation";
import { getCurrentUserId } from "../../../lib/auth";
import {
  alertPreferencesSchema,
  getNotificationSettingsResponse,
  updateAlertPreferences,
  updateNotificationSettings,
} from "../../../lib/notificationSettings";
import { notificationSettingsSchema } from "../../../lib/validation";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await getNotificationSettingsResponse(userId);
    return NextResponse.json({ settings });
  } catch (error) {
    return internalErrorResponse(error, "notification-settings.GET");
  }
}

/**
 * Destinations and switches at the top level, as before. Alert preferences
 * (time zone, reminder lead time, quiet hours, digest, per-channel alert
 * types) go under `preferences`.
 */
export async function PUT(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const raw = (await request.json()) as Record<string, unknown> | null;
    const { preferences: rawPreferences, ...rest } = raw && typeof raw === "object" ? raw : {};
    const body = notificationSettingsSchema.parse(rest);
    const preferences =
      rawPreferences === undefined ? null : alertPreferencesSchema.parse(rawPreferences);

    // Preferences first: turning the digest off releases held emails.
    if (preferences) await updateAlertPreferences(userId, preferences);
    const settings = await updateNotificationSettings(userId, body);
    return NextResponse.json({ settings });
  } catch (error) {
    const validation = validationErrorResponse(error);
    if (validation) return validation;
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
    }
    const message = (error as Error).message;
    if (message.includes("must") || message.includes("valid")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return internalErrorResponse(error, "notification-settings.PUT");
  }
}
