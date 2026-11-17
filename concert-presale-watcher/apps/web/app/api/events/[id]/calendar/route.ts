import { NextResponse } from "next/server";
import { internalErrorResponse } from "../../../../../lib/apiError";
import { validationErrorResponse } from "../../../../../lib/apiValidation";
import { getCurrentUserId } from "../../../../../lib/auth";
import { env } from "../../../../../lib/env";
import { buildEventIcs, icsFileName } from "../../../../../lib/ics";
import { getUserEvent } from "../../../../../lib/store/events";
import { uuidSchema } from "../../../../../lib/validation";

export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

/** The viewer's zone, when the dashboard passes a valid one, for times in the description. */
const readTimeZone = (value: string | null): string | undefined => {
  if (!value || value.length > 64) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return undefined;
  }
};

const uidDomain = (): string => {
  try {
    return env.appUrl ? new URL(env.appUrl).hostname : "uground.app";
  } catch {
    return "uground.app";
  }
};

/** An .ics file for one show, with entries for its upcoming presale and on-sale. */
export async function GET(request: Request, { params }: Params) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const event = await getUserEvent(uuidSchema.parse(id), userId);
    if (!event) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 });
    }

    const ics = buildEventIcs(event, {
      timeZone: readTimeZone(new URL(request.url).searchParams.get("tz")),
      uidDomain: uidDomain(),
    });
    if (!ics) {
      return NextResponse.json(
        { error: "This show has no date or upcoming sale yet." },
        { status: 404 },
      );
    }

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${icsFileName(event)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return validationErrorResponse(error) ?? internalErrorResponse(error, "events.calendar.GET");
  }
}
