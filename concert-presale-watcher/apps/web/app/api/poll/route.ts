import { NextResponse } from "next/server";
import { env } from "../../../lib/env";
import { runPollCycle } from "../../../lib/poller";
import type { PollRequestBody } from "../../../lib/types";

export const runtime = "nodejs";

const isAuthorized = (request: Request): boolean => {
  if (!env.pollSecret) {
    return true;
  }

  const header = request.headers.get("x-poll-secret") ?? request.headers.get("authorization");
  if (!header) {
    return false;
  }

  return header === env.pollSecret || header === `Bearer ${env.pollSecret}`;
};

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: PollRequestBody = {};
    try {
      body = (await request.json()) as PollRequestBody;
    } catch {
      body = {};
    }

    const result = await runPollCycle(body.city);
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
