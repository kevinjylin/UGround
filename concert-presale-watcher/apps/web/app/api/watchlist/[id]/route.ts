import { NextResponse } from "next/server";
import { deleteWatchArtist } from "../../../../lib/supabase";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    await deleteWatchArtist(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
