import assert from "node:assert/strict";
import test from "node:test";
import { saleWindowKey } from "./alertMessages";
import { reminderIdempotencyKey, reminderKindFor, selectReminders, type ReminderCandidate } from "./reminders";

const DAILY = 1440 * 60_000;
const EVERY_MINUTE = 60_000;
const now = new Date("2026-11-16T03:17:00Z");
const at = (hoursFromNow: number) => new Date(now.getTime() + hoursFromNow * 3600_000).toISOString();
const window = (startsInHours: number, endsInHours?: number) => ({
  kind: "presale" as const,
  name: "Artist Presale",
  url: null,
  starts_at: at(startsInHours),
  ends_at: endsInHours === undefined ? null : at(endsInHours),
});

test("daily dispatcher: 'opens soon' covers everything before the next run", () => {
  // 15 hours out with a 1 hour lead: tomorrow's run would be too late.
  assert.equal(reminderKindFor(window(15), 60, now, DAILY), "sale_opens_soon");
  // Past the next run (plus drift), so it waits for tomorrow.
  assert.equal(reminderKindFor(window(31), 60, now, DAILY), null);
  // A longer lead time reaches further.
  assert.equal(reminderKindFor(window(23), 1440, now, DAILY), "sale_opens_soon");
});

test("daily dispatcher: 'open now' only for a recent opening, never yesterday's", () => {
  assert.equal(reminderKindFor(window(-2), 60, now, DAILY), "sale_open_now");
  assert.equal(reminderKindFor(window(-13), 60, now, DAILY), null);
  // An opening whose window already closed isn't announced.
  assert.equal(reminderKindFor(window(-2, -1), 60, now, DAILY), null);
});

test("per-minute dispatcher: reminders follow the user's lead time", () => {
  assert.equal(reminderKindFor(window(0.5), 60, now, EVERY_MINUTE), "sale_opens_soon");
  assert.equal(reminderKindFor(window(1.5), 60, now, EVERY_MINUTE), null);
  assert.equal(reminderKindFor(window(1.5), 180, now, EVERY_MINUTE), "sale_opens_soon");
  assert.equal(reminderKindFor(window(-5 / 60), 60, now, EVERY_MINUTE), "sale_open_now");
  assert.equal(reminderKindFor(window(-20 / 60), 60, now, EVERY_MINUTE), null);
});

test("windows without a start time never remind", () => {
  assert.equal(reminderKindFor({ starts_at: null, ends_at: null }, 60, now, DAILY), null);
});

test("selection uses each user's lead time and skips a fresh announcement of the same window", () => {
  const soon = window(2);
  const candidates: ReminderCandidate[] = [
    { eventId: "e1", userId: "short-lead", window: soon },
    { eventId: "e2", userId: "long-lead", window: soon },
    { eventId: "e3", userId: "long-lead", window: soon },
  ];
  const selected = selectReminders({
    candidates,
    leadMinutesByUser: new Map([
      ["short-lead", 15],
      ["long-lead", 180],
    ]),
    // e3's announcement went out 10 minutes ago and already gave the start time.
    announcements: [
      { eventId: "e3", windowKey: saleWindowKey(soon), createdAt: new Date(now.getTime() - 600_000).toISOString() },
    ],
    now,
    dispatchIntervalMs: EVERY_MINUTE,
  });
  assert.deepEqual(
    selected.map((item) => [item.candidate.eventId, item.kind]),
    [["e2", "sale_opens_soon"]],
  );
});

test("one key per event, window, and reminder kind", () => {
  const w = window(2);
  assert.equal(reminderIdempotencyKey("sale_opens_soon", "e1", w), reminderIdempotencyKey("sale_opens_soon", "e1", { ...w }));
  assert.notEqual(reminderIdempotencyKey("sale_opens_soon", "e1", w), reminderIdempotencyKey("sale_open_now", "e1", w));
  // A moved start time is a new reminder.
  assert.notEqual(reminderIdempotencyKey("sale_opens_soon", "e1", w), reminderIdempotencyKey("sale_opens_soon", "e1", window(3)));
});
