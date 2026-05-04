import { NextResponse } from "next/server";
import { getCurrentUserId } from "../../../../lib/auth";
import { searchSpotifyArtists } from "../../../../lib/sources/spotify";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() ?? "";

    if (query.length < 2) {
      return NextResponse.json({ artists: [] });
    }

    const artists = await searchSpotifyArtists(query);
    return NextResponse.json({ artists });
  } catch (error) {
    const message = (error as Error).message.includes("SPOTIFY")
      ? "Spotify search is not configured. Typed artists can still be added."
      : "Spotify artist search is unavailable. Typed artists can still be added.";

    return NextResponse.json(
      {
        error: message,
      },
      { status: 503 },
    );
  }
}
