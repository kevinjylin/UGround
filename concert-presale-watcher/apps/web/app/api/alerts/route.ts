import { NextResponse } from "next/server";
import { listAlerts } from "../../../lib/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 50;

    const alerts = await listAlerts(Number.isFinite(limit) ? limit : 50);
    return NextResponse.json({ alerts });
  } catch (error) {
    return NextResponse.json(
      {
        error: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
