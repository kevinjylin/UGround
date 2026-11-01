import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { internalErrorResponse } from "../../../../lib/apiError";
import { deliverAlertChannel } from "../../../../lib/alerts";
import { isPollRequestAuthorized } from "../../../../lib/pollAuth";
import { isSourceRunnable, runPollForArtist } from "../../../../lib/poller";
import {
  claimPollJobs,
  completePollJob,
  deferPollJob,
  getAlertById,
  getEventById,
  listPendingDeliveries,
  syncPollJobs,
  updateDelivery,
} from "../../../../lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 55;

// Stop claiming new jobs after this long so the job in flight and the
// delivery retries still finish inside maxDuration. Callers keep calling
// until the response says the queue is drained.
const JOB_TIME_BUDGET_MS = 30_000;

type JobResult = {
  id: string;
  source: string;
  status: "succeeded" | "failed" | "skipped";
  error?: string;
};

export async function POST(request: Request) {
  try {
    if (!isPollRequestAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();
    // ?sync=1 adds jobs for followed artists that don't have any yet.
    const synced =
      new URL(request.url).searchParams.get("sync") === "1" ? await syncPollJobs() : null;

    const workerId = randomUUID();
    const results: JobResult[] = [];
    let drained = false;
    while (Date.now() - startedAt < JOB_TIME_BUDGET_MS) {
      const [job] = await claimPollJobs(workerId, 1);
      if (!job) {
        drained = true;
        break;
      }
      // Venue and area watching have no adapter yet. Push these out a day so
      // they stop taking turns from artist jobs.
      if (job.target_type !== "legacy_user" || !job.user_id) {
        await deferPollJob(job, `Polling by ${job.target_type} is not supported yet.`);
        results.push({ id: job.id, source: job.source_slug, status: "skipped" });
        continue;
      }
      if (!isSourceRunnable(job.source_slug)) {
        await deferPollJob(job, `${job.source_slug} is not configured.`);
        results.push({ id: job.id, source: job.source_slug, status: "skipped" });
        continue;
      }
      try {
        const artistId = job.target_id.split(":").at(-1);
        if (!artistId) throw new Error("Invalid legacy poll target.");
        await runPollForArtist(artistId, job.user_id, [job.source_slug]);
        await completePollJob(job);
        results.push({ id: job.id, source: job.source_slug, status: "succeeded" });
      } catch (error) {
        const message = (error as Error).message;
        await completePollJob(job, message);
        results.push({ id: job.id, source: job.source_slug, status: "failed", error: message });
      }
    }

    const pendingDeliveries = await listPendingDeliveries(25);
    const deliveryResults = [];
    for (const delivery of pendingDeliveries) {
      try {
        const alert = await getAlertById(delivery.alert_id);
        const event = alert ? await getEventById(alert.event_id) : null;
        if (!alert || !event) throw new Error("Alert or event no longer exists.");
        const sent = await deliverAlertChannel(delivery.channel, alert.alert_type, event);
        await updateDelivery(delivery.id, {
          sent,
          error: sent ? undefined : "Provider rejected the retry.",
          attempts: delivery.attempts + 1,
        });
        deliveryResults.push({ id: delivery.id, status: sent ? "sent" : "failed" });
      } catch (error) {
        const message = (error as Error).message;
        await updateDelivery(delivery.id, {
          sent: false,
          error: message,
          attempts: delivery.attempts + 1,
        });
        deliveryResults.push({ id: delivery.id, status: "failed", error: message });
      }
    }

    const count = (status: JobResult["status"]) =>
      results.filter((result) => result.status === status).length;
    return NextResponse.json({
      synced,
      drained,
      claimed: results.length,
      succeeded: count("succeeded"),
      failed: count("failed"),
      skipped: count("skipped"),
      results,
      deliveriesProcessed: deliveryResults.length,
      deliveryResults,
    });
  } catch (error) {
    return internalErrorResponse(error, "internal.dispatch");
  }
}
