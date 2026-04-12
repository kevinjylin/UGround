import { NextResponse } from "next/server";
import { env } from "../../../../lib/env";
import { isPollRequestAuthorized } from "../../../../lib/pollAuth";
import { runPollCycle } from "../../../../lib/poller";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (!isPollRequestAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runPollCycle(env.defaultCity);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      {
        error: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
