import test from "node:test";
import assert from "node:assert";
import {
  buildEventIcs,
  escapeIcsText,
  foldIcsLine,
  googleCalendarUrl,
  icsFileName,
  showTiming,
  type CalendarEvent,
} from "./ics";

const now = new Date("2026-11-16T12:00:00Z");

const show = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "11111111-2222-3333-4444-555555555555",
  artist_name: "Wednesday",
  title: "Wednesday: Bleeds Tour",
  venue: "Lincoln Hall",
  city: "Chicago",
  state: "IL",
  country: "US",
  start_time: "2026-12-22T02:00:00.000Z",
  ticket_url: "https://example.com/tickets/1",
  sale_windows: [],
  ...overrides,
});

/** Unfolds and splits a calendar into its content lines. */
const contentLines = (ics: string) => ics.replace(/\r\n /g, "").split("\r\n");

test("escapeIcsText", async (t) => {
  await t.test("escapes backslash, semicolon and comma", () => {
    assert.strictEqual(escapeIcsText("a\\b;c,d"), "a\\\\b\\;c\\,d");
  });
  await t.test("turns every newline style into \\n", () => {
    assert.strictEqual(escapeIcsText("one\ntwo\r\nthree\rfour"), "one\\ntwo\\nthree\\nfour");
  });
  await t.test("leaves colons and plain text alone", () => {
    assert.strictEqual(escapeIcsText("Tickets: https://x.test/a"), "Tickets: https://x.test/a");
  });
});

test("foldIcsLine", async (t) => {
  await t.test("leaves short lines unchanged", () => {
    assert.strictEqual(foldIcsLine("SUMMARY:Short"), "SUMMARY:Short");
  });
  await t.test("folds to 75 octets with a leading space on continuations", () => {
    const line = `DESCRIPTION:${"x".repeat(200)}`;
    const folded = foldIcsLine(line);
    const parts = folded.split("\r\n");
    assert.ok(parts.length > 1);
    for (const part of parts) assert.ok(Buffer.byteLength(part) <= 75, part);
    for (const part of parts.slice(1)) assert.ok(part.startsWith(" "));
    assert.strictEqual(folded.replace(/\r\n /g, ""), line);
  });
  await t.test("never splits a multi-byte character", () => {
    const line = `SUMMARY:${"é".repeat(60)}🎸${"ü".repeat(40)}`;
    const parts = foldIcsLine(line).split("\r\n");
    for (const part of parts) {
      assert.ok(Buffer.byteLength(part) <= 75);
      assert.ok(!part.includes("�"));
    }
    assert.strictEqual(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join(""), line);
  });
});

test("showTiming", async (t) => {
  await t.test("null and bad dates have no timing", () => {
    assert.strictEqual(showTiming(null), null);
    assert.strictEqual(showTiming("not a date"), null);
  });
  await t.test("a bare date is all day", () => {
    assert.deepStrictEqual(showTiming("2026-12-31"), {
      kind: "allDay",
      date: "20261231",
      nextDate: "20270101",
    });
  });
  await t.test("a timed show runs three hours", () => {
    const timing = showTiming("2026-12-22T02:00:00.000Z");
    assert.ok(timing && timing.kind === "timed");
    assert.strictEqual(timing.end.getTime() - timing.start.getTime(), 3 * 3_600_000);
  });
});

test("buildEventIcs", async (t) => {
  await t.test("builds one timed show with venue and ticket link", () => {
    const ics = buildEventIcs(show(), { now, timeZone: "America/Chicago" });
    assert.ok(ics);
    assert.ok(ics.endsWith("\r\n"));
    assert.ok(!/[^\r]\n/.test(ics), "every line ends in CRLF");
    const lines = contentLines(ics);
    assert.strictEqual(lines[0], "BEGIN:VCALENDAR");
    assert.ok(lines.includes("DTSTART:20261222T020000Z"));
    assert.ok(lines.includes("DTEND:20261222T050000Z"));
    assert.ok(lines.includes("SUMMARY:Wednesday at Lincoln Hall"));
    assert.ok(lines.includes("LOCATION:Lincoln Hall\\, Chicago\\, IL"));
    assert.ok(lines.includes("URL:https://example.com/tickets/1"));
    assert.ok(lines.includes("DTSTAMP:20261116T120000Z"));
    const description = lines.find((line) => line.startsWith("DESCRIPTION:"));
    assert.ok(description?.includes("Tickets: https://example.com/tickets/1"));
    assert.strictEqual(lines.filter((line) => line === "BEGIN:VEVENT").length, 1);
  });

  await t.test("adds an entry with an alarm for each sale window still ahead", () => {
    const ics = buildEventIcs(
      show({
        sale_windows: [
          { kind: "presale", name: "Artist presale", url: "https://example.com/p", starts_at: "2026-11-10T16:00:00Z", ends_at: null },
          { kind: "public", name: "Public sale", url: null, starts_at: "2026-11-20T16:00:00Z", ends_at: null },
        ],
      }),
      { now, timeZone: "America/Chicago" },
    )!;
    const lines = contentLines(ics);
    assert.strictEqual(lines.filter((line) => line === "BEGIN:VEVENT").length, 2);
    assert.ok(lines.includes("SUMMARY:General on-sale: Wednesday at Lincoln Hall"));
    assert.ok(lines.includes("DTSTART:20261120T160000Z"));
    assert.ok(lines.includes("TRIGGER:-PT15M"));
    // The presale already started, so it's only in the description.
    assert.ok(!lines.some((line) => line.startsWith("SUMMARY:Artist presale")));
    const description = lines.find((line) => line.startsWith("DESCRIPTION:"))!;
    assert.ok(description.includes("Artist presale: Nov 10\\, 2026\\, 10:00 AM CST"));
  });

  await t.test("escapes text fields from the source", () => {
    const ics = buildEventIcs(show({ artist_name: "Crosby, Stills; Nash", venue: null }), { now })!;
    assert.ok(contentLines(ics).includes("SUMMARY:Crosby\\, Stills\\; Nash"));
  });

  await t.test("a show with only a date is an all-day entry", () => {
    const lines = contentLines(buildEventIcs(show({ start_time: "2027-01-03" }), { now })!);
    assert.ok(lines.includes("DTSTART;VALUE=DATE:20270103"));
    assert.ok(lines.includes("DTEND;VALUE=DATE:20270104"));
  });

  await t.test("a show with no date keeps only its upcoming sale entries", () => {
    const lines = contentLines(
      buildEventIcs(
        show({
          start_time: null,
          sale_windows: [{ kind: "public", name: "Public sale", url: null, starts_at: "2026-12-01T18:00:00Z", ends_at: null }],
        }),
        { now },
      )!,
    );
    assert.strictEqual(lines.filter((line) => line === "BEGIN:VEVENT").length, 1);
    assert.ok(lines.includes("DTSTART:20261201T180000Z"));
  });

  await t.test("returns null when there is nothing to schedule", () => {
    assert.strictEqual(buildEventIcs(show({ start_time: null }), { now }), null);
  });

  await t.test("folds long lines", () => {
    const ics = buildEventIcs(show({ title: "A very long tour name ".repeat(10) }), { now })!;
    for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75, line);
  });
});

test("googleCalendarUrl", async (t) => {
  await t.test("builds a template link with dates and location", () => {
    const url = new URL(googleCalendarUrl(show())!);
    assert.strictEqual(url.hostname, "calendar.google.com");
    assert.strictEqual(url.searchParams.get("action"), "TEMPLATE");
    assert.strictEqual(url.searchParams.get("dates"), "20261222T020000Z/20261222T050000Z");
    assert.strictEqual(url.searchParams.get("location"), "Lincoln Hall, Chicago, IL");
    assert.strictEqual(url.searchParams.get("text"), "Wednesday at Lincoln Hall");
  });
  await t.test("uses all-day dates for a bare date and null for no date", () => {
    const url = new URL(googleCalendarUrl(show({ start_time: "2027-01-03" }))!);
    assert.strictEqual(url.searchParams.get("dates"), "20270103/20270104");
    assert.strictEqual(googleCalendarUrl(show({ start_time: null })), null);
  });
});

test("icsFileName", () => {
  assert.strictEqual(icsFileName(show({ start_time: "2026-12-22T02:00:00.000Z" })), "wednesday-2026-12-22.ics");
  assert.strictEqual(icsFileName(show({ artist_name: "Fontaines D.C.", start_time: null })), "fontaines-dc.ics");
  assert.strictEqual(icsFileName(show({ artist_name: "!!!" , start_time: null })), "show.ics");
});
