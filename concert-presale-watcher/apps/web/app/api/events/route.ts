import { NextResponse } from "next/server";
import { internalErrorResponse } from "../../../lib/apiError";
import { validationErrorResponse } from "../../../lib/apiValidation";
import { getCurrentUserId } from "../../../lib/auth";
import { FeedQueryError, parseFeedRequest } from "../../../lib/feedQuery";
import {
  countFeedEvents,
  listAlertsForEvents,
  listFeedEvents,
} from "../../../lib/store/events";

export const runtime = "nodejs";

/**
 * A page of the show feed.
 *
 *   view    upcoming (default) | past | hidden
 *   filter  all | onsale | changed_today | scheduled | saved
 *   sort    recent_change | date_soonest | artist_az
 *   q       search over artist, venue and city
 *   source  artist | artist:<watch id> | rule:<watch rule id>
 *   limit, offset   paging (limit up to 200, default 50)
 *   counts=1        also return tab and view counts
 *
 * Returns the page's events, their alerts, whether more pages exist, and
 * counts when asked.
 */
export async function GET(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const feed = parseFeedRequest(searchParams);
    const wantCounts = searchParams.get("counts") === "1";

    // One extra row says whether there's another page without a count query.
    const [rows, counts] = await Promise.all([
      listFeedEvents(userId, feed, { limit: feed.limit + 1, offset: feed.offset }),
      wantCounts ? countFeedEvents(userId, feed) : Promise.resolve(undefined),
    ]);
    const hasMore = rows.length > feed.limit;
    const events = rows.slice(0, feed.limit);
    const alerts = await listAlertsForEvents(
      userId,
      events.map((event) => event.id),
    );

    return NextResponse.json({ events, alerts, hasMore, ...(counts ? { counts } : {}) });
  } catch (error) {
    if (error instanceof FeedQueryError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return validationErrorResponse(error) ?? internalErrorResponse(error, "events.GET");
  }
}
