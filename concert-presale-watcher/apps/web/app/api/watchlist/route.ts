import { NextResponse } from "next/server";
import { createWatchArtist, listWatchArtists } from "../../../lib/supabase";

interface CreateWatchArtistRequest {
  name?: string;
  spotifyId?: string;
  city?: string;
  state?: string;
  country?: string;
}

export const runtime = "nodejs";

export async function GET() {
  try {
    const artists = await listWatchArtists();
    return NextResponse.json({ artists });
  } catch (error) {
    return NextResponse.json(
      {
        error: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateWatchArtistRequest;

    if (!body.name || body.name.trim().length < 2) {
      return NextResponse.json(
        {
          error: "Artist name must be at least 2 characters.",
        },
        { status: 400 },
      );
    }

    const artist = await createWatchArtist({
      name: body.name.trim(),
      spotifyId: body.spotifyId?.trim() || undefined,
      city: body.city?.trim() || undefined,
      state: body.state?.trim() || undefined,
      country: body.country?.trim() || "US",
    });

    return NextResponse.json({ artist }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
