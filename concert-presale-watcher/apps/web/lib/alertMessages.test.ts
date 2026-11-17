import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAlertContent,
  buildAlertEmail,
  buildDigestEmail,
  buildDiscordMessage,
  buildPushPayload,
  buildSmsMessage,
  buildSubject,
  formatInZone,
  saleWindowKey,
} from "./alertMessages";
import type { EventRecord } from "./types";

const now = new Date("2026-11-16T03:17:00Z");

const presale = {
  kind: "presale" as const,
  name: "Verified Fan Presale",
  url: null,
  starts_at: "2026-11-18T18:00:00Z",
  ends_at: null,
};

const event: EventRecord = {
  id: "event-1",
  user_id: "user-1",
  source_slug: "ticketmaster",
  source_event_id: "tm-1",
  watch_artist_id: "wa-1",
  watch_rule_id: null,
  artist_name: "Phoebe Bridgers",
  title: "Phoebe Bridgers: The Reunion Tour",
  venue: "Metro",
  city: "Chicago",
  state: "IL",
  country: "US",
  // 8 PM in Chicago on Mar 6, which is already Mar 7 in UTC.
  start_time: "2027-03-07T02:00:00Z",
  ticket_url: "https://www.ticketmaster.com/event/1",
  status: "onsale",
  on_sale_start: "2026-11-20T16:00:00Z",
  sale_windows: [
    presale,
    { kind: "public", name: "Public sale", url: null, starts_at: "2026-11-20T16:00:00Z", ends_at: null },
  ],
  dedupe_key: "k",
  last_seen_at: "",
  created_at: "",
  updated_at: "",
};

const chicago = { timeZone: "America/Chicago", localDate: "2027-03-06", dateOnly: false };

test("sale times use the user's zone and the show uses the venue's, each with its abbreviation", () => {
  const content = buildAlertContent({
    alertType: "sale_opens_soon",
    event,
    payload: { sale_window: presale },
    userTimeZone: "America/Los_Angeles",
    venueTime: chicago,
    now,
  });
  assert.equal(content.label, "Verified Fan Presale opens soon");
  assert.equal(content.saleLine, "Verified Fan Presale starts Wed, Nov 18, 10:00 AM PST");
  assert.equal(content.showDate, "Sat, Mar 6, 2027, 8:00 PM CST");
  assert.equal(content.place, "Metro, Chicago, IL");
  assert.equal(
    buildSubject(content),
    "Verified Fan Presale opens soon: Phoebe Bridgers, Wed, Nov 18, 10:00 AM PST",
  );
});

test("a held reminder sent after the start says the sale is open, in the past tense", () => {
  const content = buildAlertContent({
    alertType: "sale_opens_soon",
    event,
    payload: { sale_window: presale },
    userTimeZone: "America/New_York",
    now: new Date("2026-11-18T19:00:00Z"),
  });
  assert.equal(content.label, "Verified Fan Presale is open");
  assert.equal(content.saleLine, "Verified Fan Presale started Wed, Nov 18, 1:00 PM EST");
});

test("without any zone, times are stated in UTC rather than the server's locale", () => {
  const content = buildAlertContent({ alertType: "new_event", event, userTimeZone: null, now });
  assert.equal(content.label, "New show");
  assert.equal(content.showDate, "Sun, Mar 7, 2027, 2:00 AM UTC");
  // A new show mentions the next sale that hasn't started.
  assert.equal(content.saleLine, "Verified Fan Presale starts Wed, Nov 18, 6:00 PM UTC");
  assert.equal(formatInZone("2026-11-18T18:00:00Z", "Not/AZone", now), "Wed, Nov 18, 6:00 PM UTC");
});

test("a date-only show prints the ticket's date, not a shifted UTC midnight", () => {
  const content = buildAlertContent({
    alertType: "new_event",
    event: { ...event, start_time: "2027-03-06T00:00:00Z" },
    userTimeZone: "America/Los_Angeles",
    venueTime: { timeZone: "America/Chicago", localDate: "2027-03-06", dateOnly: true },
    now,
  });
  assert.equal(content.showDate, "Sat, Mar 6, 2027");
});

test("presale announcements name the window that was new", () => {
  const second = { ...presale, name: "Spotify Presale", starts_at: "2026-11-19T17:00:00Z" };
  const content = buildAlertContent({
    alertType: "presale_announced",
    event: { ...event, sale_windows: [presale, second] },
    payload: { sale_window_keys: [saleWindowKey(second)] },
    userTimeZone: "America/Chicago",
    now,
  });
  assert.equal(content.saleLine, "Spotify Presale starts Thu, Nov 19, 11:00 AM CST");
});

test("email has a subject, HTML and text bodies, escaped content, and the unsubscribe link", () => {
  const content = buildAlertContent({
    alertType: "presale_opened",
    event: { ...event, title: `<script>alert("x")</script>` },
    userTimeZone: "America/Chicago",
    now,
  });
  const email = buildAlertEmail(content, {
    unsubscribeUrl: "https://www.uground.app/api/notification-settings/unsubscribe?token=abc",
    manageUrl: "https://www.uground.app/dashboard",
  });
  assert.match(email.subject, /^Presale open: Phoebe Bridgers/);
  assert.ok(!email.html.includes("<script>"));
  assert.ok(email.html.includes("&lt;script&gt;"));
  assert.ok(email.html.includes("#f05a28"));
  assert.ok(email.html.includes('href="https://www.uground.app/api/notification-settings/unsubscribe?token=abc"'));
  assert.ok(email.html.includes('href="https://www.ticketmaster.com/event/1"'));
  assert.match(email.text, /Turn off email alerts: https:\/\/www\.uground\.app\/api\/notification-settings\/unsubscribe\?token=abc/);
  assert.match(email.text, /Tickets: https:\/\/www\.ticketmaster\.com\/event\/1/);
});

test("unsafe ticket links are left out of every channel", () => {
  const content = buildAlertContent({
    alertType: "new_event",
    event: { ...event, ticket_url: "javascript:alert(1)", sale_windows: [] },
    userTimeZone: "UTC",
    now,
  });
  assert.equal(content.ticketUrl, null);
  assert.ok(!buildSmsMessage(content).includes("javascript"));
});

test("SMS is short and plain, Discord uses an ember embed, push links to the tickets", () => {
  const content = buildAlertContent({
    alertType: "sale_open_now",
    event,
    payload: { sale_window: presale },
    userTimeZone: "America/Los_Angeles",
    venueTime: chicago,
    now: new Date("2026-11-18T18:05:00Z"),
  });
  const sms = buildSmsMessage(content);
  assert.equal(
    sms,
    "UGround: Verified Fan Presale is open, Phoebe Bridgers. Started Wed, Nov 18, 10:00 AM PST. Show Sat, Mar 6, 2027, 8:00 PM CST, Metro, Chicago, IL. https://www.ticketmaster.com/event/1",
  );
  assert.ok(/^[\x20-\x7e]+$/.test(sms), "SMS stays in plain ASCII");

  const discord = buildDiscordMessage(content);
  assert.equal(discord.embeds[0]?.color, 0xf05a28);
  assert.equal(discord.embeds[0]?.url, "https://www.ticketmaster.com/event/1");
  assert.match(discord.embeds[0]?.description ?? "", /Show: Sat, Mar 6, 2027, 8:00 PM CST/);

  const push = buildPushPayload(content, "https://www.uground.app/dashboard");
  assert.equal(push.title, "Phoebe Bridgers: Verified Fan Presale is open");
  assert.equal(push.url, "https://www.ticketmaster.com/event/1");
});

test("the digest lists every alert with one unsubscribe link", () => {
  const first = buildAlertContent({ alertType: "new_event", event, userTimeZone: "America/Chicago", now });
  const second = buildAlertContent({
    alertType: "status_changed",
    event: { ...event, artist_name: "boygenius", status: "cancelled" },
    userTimeZone: "America/Chicago",
    now,
  });
  const email = buildDigestEmail(
    [first, second],
    { unsubscribeUrl: "https://www.uground.app/u?token=t", manageUrl: null },
    "Mon, Nov 16",
  );
  assert.equal(email.subject, "UGround daily digest: 2 alerts, Mon, Nov 16");
  assert.ok(email.text.includes("New show: Phoebe Bridgers"));
  assert.ok(email.text.includes("Now cancelled: boygenius"));
  assert.equal(email.html.split("https://www.uground.app/u?token=t").length - 1, 1);
});
