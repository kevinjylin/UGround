import assert from "node:assert/strict";
import test from "node:test";
import {
  channelWantsAlert,
  defaultAlertPreferences,
  isDigestDue,
  quietHoursEndAt,
  toAlertPreferences,
} from "./alertPreferences";

test("per-channel alert types: a listed channel only gets its types", () => {
  const preferences = {
    ...defaultAlertPreferences(),
    channelAlertTypes: { sms: ["presale_opened" as const, "sale_opens_soon" as const] },
  };
  assert.equal(channelWantsAlert(preferences, "sms", "sale_opens_soon"), true);
  assert.equal(channelWantsAlert(preferences, "sms", "new_event"), false);
  // Channels left out get everything.
  assert.equal(channelWantsAlert(preferences, "email", "new_event"), true);
});

test("stored preferences are sanitized", () => {
  const preferences = toAlertPreferences({
    user_id: "u",
    time_zone: "Mars/Olympus",
    reminder_lead_minutes: 30,
    quiet_hours_enabled: true,
    quiet_hours_start: 1320,
    quiet_hours_end: 420,
    email_digest: true,
    channel_alert_types: { sms: ["presale_opened", "bogus"], pager: ["new_event"] },
    digest_last_sent_at: null,
  });
  assert.equal(preferences.timeZone, null);
  assert.deepEqual(preferences.channelAlertTypes, { sms: ["presale_opened"] });
  assert.equal(preferences.reminderLeadMinutes, 30);
});

const quiet = (timeZone: string) => ({
  timeZone,
  quietHours: { enabled: true, start: 22 * 60, end: 8 * 60 },
});

test("quiet hours wrap past midnight in the user's zone and end at the local end time", () => {
  // 23:30 in Chicago (CST, UTC-6) on Nov 16.
  const lateNight = new Date("2026-11-17T05:30:00Z");
  assert.equal(quietHoursEndAt(lateNight, quiet("America/Chicago"))?.toISOString(), "2026-11-17T14:00:00.000Z");
  // 03:00 local is still quiet.
  assert.equal(quietHoursEndAt(new Date("2026-11-17T09:00:00Z"), quiet("America/Chicago"))?.toISOString(), "2026-11-17T14:00:00.000Z");
  // 12:00 local is not.
  assert.equal(quietHoursEndAt(new Date("2026-11-17T18:00:00Z"), quiet("America/Chicago")), null);
  // Off means never held.
  assert.equal(
    quietHoursEndAt(lateNight, { timeZone: "America/Chicago", quietHours: { enabled: false, start: 1320, end: 480 } }),
    null,
  );
});

test("quiet hours across a DST change still end at the local wall-clock time", () => {
  // 23:00 PDT on Oct 31, 2026; clocks fall back at 2 AM Nov 1.
  const before = new Date("2026-11-01T06:00:00Z");
  const end = quietHoursEndAt(before, quiet("America/Los_Angeles"));
  // 08:00 PST is 16:00 UTC.
  assert.equal(end?.toISOString(), "2026-11-01T16:00:00.000Z");
});

test("digest: once a day at 9 local, or on the run before 9 when runs are daily", () => {
  const zone = "America/Chicago";
  const evening = new Date("2026-11-17T03:17:00Z"); // 21:17 CST on Nov 16
  const due = (now: Date, oldestPendingAt: string, dispatchIntervalMs: number, lastSentAt: string | null = null) =>
    isDigestDue({ now, timeZone: zone, lastSentAt, oldestPendingAt, dispatchIntervalMs });

  // Daily dispatcher: the next run is after 9 AM, so this run sends.
  assert.equal(due(evening, "2026-11-17T03:16:00Z", 86400_000), true);
  // Per-minute dispatcher: alerts from this afternoon wait for 9 AM.
  assert.equal(due(evening, "2026-11-16T21:00:00Z", 60_000), false);
  assert.equal(due(new Date("2026-11-17T15:00:30Z"), "2026-11-16T21:00:00Z", 60_000), true);
  // Already sent within the day.
  assert.equal(due(new Date("2026-11-17T15:01:00Z"), "2026-11-16T21:00:00Z", 60_000, "2026-11-17T03:17:00Z"), false);
});
