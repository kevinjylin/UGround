import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { internalErrorResponse } from "../../../../lib/apiError";
import { deliverQueuedAlert } from "../../../../lib/alerts";
import { runDigestPass } from "../../../../lib/digest";
import { logger } from "../../../../lib/logger";
import { isPollRequestAuthorized } from "../../../../lib/pollAuth";
import { isSourceRunnable, runPollForArtist } from "../../../../lib/poller";
import { runReminderPass } from "../../../../lib/reminders";
import { runLocationJob, runVenueJob } from "../../../../lib/ruleWatcher";
import {
  addAlertSentChannel,
  holdDeliveryById,
  listAlertsByIds,
  listDueDeliveries,
} from "../../../../lib/store/alertStore";
import {
  claimPollJobs,
  completePollJob,
  deferPollJob,
  deletePollJob,
  getEventById,
  RULE_JOB_SOURCES,
  syncPollJobs,
  updateDelivery,
} from "../../../../lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 55;

// Stop claiming new jobs after this long so the job in flight, the
// reminders, and the delivery retries still finish inside maxDuration.
// Callers keep calling until the response says the queue is drained.
const JOB_TIME_BUDGET_MS = 30_000;

type JobResult = {
  id: string;
  source: string;
  status: "succeeded" | "failed" | "skipped";
  error?: string;
};

const safely = async <T>(label: string, run: () => Promise<T>): Promise<T | { error: string }> => {
  try {
    return await run();
  } catch (error) {
    logger.error(`[dispatch] ${label} failed`, error);
    return { error: (error as Error).message };
  }
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

    // Time-based reminders come first: they're cheap and time-sensitive.
    const reminders = await safely("reminders", () => runReminderPass());

    const workerId = randomUUID();
    const results: JobResult[] = [];
    let drained = false;
    while (Date.now() - startedAt < JOB_TIME_BUDGET_MS) {
      const [job] = await claimPollJobs(workerId, 1);
      if (!job) {
        drained = true;
        break;
      }
      // A job for a source without credentials can't run. Drop it; ?sync=1
      // adds it back once the source is configured.
      if (!isSourceRunnable(job.source_slug)) {
        await deletePollJob(job.id);
        results.push({ id: job.id, source: job.source_slug, status: "skipped", error: `${job.source_slug} is not configured.` });
        continue;
      }
      if (job.target_type === "venue" || job.target_type === "location") {
        // Only some sources can search by venue or area.
        if (!RULE_JOB_SOURCES.includes(job.source_slug)) {
          await deletePollJob(job.id);
          results.push({ id: job.id, source: job.source_slug, status: "skipped" });
          continue;
        }
        try {
          const outcome =
            job.target_type === "venue" ? await runVenueJob(job) : await runLocationJob(job);
          if (outcome.kind === "gone") {
            await deletePollJob(job.id);
            results.push({ id: job.id, source: job.source_slug, status: "skipped", error: outcome.reason });
          } else if (outcome.kind === "unresolved") {
            await deferPollJob(job, outcome.reason);
            results.push({ id: job.id, source: job.source_slug, status: "skipped", error: outcome.reason });
          } else {
            await completePollJob(job);
            results.push({ id: job.id, source: job.source_slug, status: "succeeded" });
          }
        } catch (error) {
          const message = (error as Error).message;
          await completePollJob(job, message);
          results.push({ id: job.id, source: job.source_slug, status: "failed", error: message });
        }
        continue;
      }
      // Artist rules without a legacy watchlist row have no runner. Push these
      // out a day so they stop taking turns from runnable jobs.
      if (job.target_type !== "legacy_user" || !job.user_id) {
        await deferPollJob(job, `Polling by ${job.target_type} is not supported yet.`);
        results.push({ id: job.id, source: job.source_slug, status: "skipped" });
        continue;
      }
      try {
        const artistId = job.target_id.split(":").at(-1);
        if (!artistId) throw new Error("Invalid legacy poll target.");
        const outcome = await runPollForArtist(artistId, job.user_id, [job.source_slug]);
        if (!outcome) {
          await deletePollJob(job.id);
          results.push({ id: job.id, source: job.source_slug, status: "skipped", error: "The artist is no longer followed." });
          continue;
        }
        // Check more often while a followed show has a sale coming up.
        await completePollJob({ ...job, cadence_seconds: outcome.cadenceSeconds });
        results.push({ id: job.id, source: job.source_slug, status: "succeeded" });
      } catch (error) {
        const message = (error as Error).message;
        await completePollJob(job, message);
        results.push({ id: job.id, source: job.source_slug, status: "failed", error: message });
      }
    }

    const pendingDeliveries = await listDueDeliveries(25);
    const alerts = new Map(
      (await listAlertsByIds([...new Set(pendingDeliveries.map((delivery) => delivery.alert_id))])).map(
        (alert) => [alert.id, alert],
      ),
    );
    const deliveryResults = [];
    for (const delivery of pendingDeliveries) {
      try {
        const alert = alerts.get(delivery.alert_id);
        const event = alert ? await getEventById(alert.event_id) : null;
        if (!alert || !event) throw new Error("Alert or event no longer exists.");
        const outcome = await deliverQueuedAlert(delivery.channel, alert, event);
        if (outcome.kind === "held") {
          await holdDeliveryById(delivery.id, outcome.reason, outcome.until);
          deliveryResults.push({ id: delivery.id, status: "held" });
        } else if (outcome.kind === "dropped") {
          // Stop retrying: the destination or the show is gone.
          await updateDelivery(delivery.id, { sent: false, error: outcome.reason, attempts: 5 });
          deliveryResults.push({ id: delivery.id, status: "dropped", error: outcome.reason });
        } else {
          const sent = outcome.kind === "sent";
          await updateDelivery(delivery.id, {
            sent,
            error: outcome.kind === "failed" ? outcome.error : undefined,
            attempts: delivery.attempts + 1,
          });
          if (sent) await addAlertSentChannel(alert.id, alert.sent_channels, delivery.channel);
          deliveryResults.push({ id: delivery.id, status: sent ? "sent" : "failed" });
        }
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

    // The digest waits for the queue to drain so one run's alerts share an email.
    const digest = drained ? await safely("digest", () => runDigestPass()) : null;

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
      reminders,
      deliveriesProcessed: deliveryResults.length,
      deliveryResults,
      digest,
    });
  } catch (error) {
    return internalErrorResponse(error, "internal.dispatch");
  }
}
