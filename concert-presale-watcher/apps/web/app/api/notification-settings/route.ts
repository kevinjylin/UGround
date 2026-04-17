import { NextResponse } from "next/server";
import { getCurrentUserId } from "../../../lib/auth";
import {
  getNotificationSettingsResponse,
  updateNotificationSettings,
} from "../../../lib/notificationSettings";

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
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const settings = await updateNotificationSettings(userId, body);
    return NextResponse.json({ settings });
  } catch (error) {
    const message = (error as Error).message;
    const status = message.includes("must") || message.includes("valid") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
