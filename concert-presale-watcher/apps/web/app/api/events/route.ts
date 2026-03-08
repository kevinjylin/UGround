import { NextResponse } from "next/server";
import { listEvents } from "../../../lib/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 100;

    const events = await listEvents(Number.isFinite(limit) ? limit : 100);
    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json(
      {
        error: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
