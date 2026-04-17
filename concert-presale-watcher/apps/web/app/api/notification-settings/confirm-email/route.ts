import { NextResponse } from "next/server";
import { getCurrentUserId } from "../../../../lib/auth";
import { confirmEmailToken } from "../../../../lib/notificationSettings";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token") ?? "";
    if (!token) {
      return NextResponse.json({ error: "Missing email confirmation token." }, { status: 400 });
    }

    await confirmEmailToken(userId, token);
    return NextResponse.redirect(new URL("/dashboard?emailConfirmed=1", request.url));
  } catch (error) {
    const message = (error as Error).message;
    const status = message.includes("Invalid") || message.includes("expired") || message.includes("pending") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
