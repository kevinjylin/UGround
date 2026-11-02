"use client";

import { useState } from "react";
import DashboardPage from "../dashboard/page";

const now = Date.now();
const ago = (mins: number) => new Date(now - mins * 60000).toISOString();
const on = (iso: string) => new Date(iso).toISOString();

const base = {
  user_id: "u1",
  source_event_id: "x",
  watch_artist_id: null,
  watch_rule_id: null,
  country: "US",
  dedupe_key: "k",
  created_at: ago(60 * 24 * 5),
  sale_windows: [],
};

const events = [
  { ...base, id: "e1", source_slug: "ticketmaster", artist_name: "Fontaines D.C.", title: "Fontaines D.C. – Romance Tour", venue: "The Greek Theatre", city: "Los Angeles", state: "CA", start_time: on("2027-01-19T20:00:00-08:00"), ticket_url: "https://example.com/t1", status: "onsale", on_sale_start: null, last_seen_at: ago(12), updated_at: ago(90) },
  { ...base, id: "e2", source_slug: "ticketmaster", artist_name: "Geese", title: "Geese", venue: "Bowery Ballroom", city: "New York", state: "NY", start_time: on("2026-11-22T20:00:00-05:00"), ticket_url: "https://example.com/t2", status: "onsale", on_sale_start: null, last_seen_at: ago(12), updated_at: ago(300) },
  { ...base, id: "e3", source_slug: "ticketmaster", artist_name: "MJ Lenderman", title: "MJ Lenderman and the Wind", venue: "The Echo", city: "Los Angeles", state: "CA", start_time: on("2026-12-04T20:00:00-08:00"), ticket_url: "https://example.com/t3", status: "onsale", on_sale_start: null, last_seen_at: ago(12), updated_at: ago(20) },
  { ...base, id: "e4", source_slug: "songkick", artist_name: "Hotline TNT", title: "Hotline TNT", venue: "Empty Bottle", city: "Chicago", state: "IL", start_time: on("2026-11-12T21:00:00-06:00"), ticket_url: "https://example.com/t4", status: "cancelled", on_sale_start: null, last_seen_at: ago(12), updated_at: ago(60 * 48) },
  { ...base, id: "e5", source_slug: "bandsintown", artist_name: "Slow Pulp", title: "Slow Pulp", venue: "9:30 Club", city: "Washington", state: "DC", start_time: on("2027-01-03T19:00:00-05:00"), ticket_url: "https://example.com/t5", status: "scheduled", on_sale_start: null, last_seen_at: ago(12), updated_at: ago(240) },
  { ...base, id: "e6", source_slug: "ticketmaster", artist_name: "Wednesday", title: "Wednesday: Bleeds Tour", venue: "Lincoln Hall", city: "Chicago", state: "IL", start_time: on("2026-12-21T20:00:00-06:00"), ticket_url: "https://example.com/t6", status: "scheduled", on_sale_start: on("2026-11-04T10:00:00-06:00"), last_seen_at: ago(12), updated_at: ago(420),
    sale_windows: [
      { kind: "presale", name: "Artist presale", url: "https://example.com/p", starts_at: on("2026-11-02T10:00:00-06:00"), ends_at: null },
      { kind: "public", name: "General on-sale", url: null, starts_at: on("2026-11-04T10:00:00-06:00"), ends_at: null },
    ] },
  { ...base, id: "e8", source_slug: "ticketmaster", artist_name: "Ratboys", title: "Ratboys", venue: "Empty Bottle", city: "Chicago", state: "IL", start_time: on("2027-02-06T21:00:00-06:00"), ticket_url: "https://example.com/t8", status: "scheduled", on_sale_start: on("2026-11-07T10:00:00-06:00"), last_seen_at: ago(12), updated_at: ago(45), watch_rule_id: "r1",
    sale_windows: [{ kind: "public", name: "Public sale", url: null, starts_at: on("2026-11-07T10:00:00-06:00"), ends_at: null }] },
  { ...base, id: "e9", source_slug: "ticketmaster", artist_name: "Horsegirl", title: "Horsegirl", venue: "Metro", city: "Chicago", state: "IL", start_time: on("2027-03-14T20:00:00-05:00"), ticket_url: "https://example.com/t9", status: "scheduled", on_sale_start: on("2026-11-06T10:00:00-06:00"), last_seen_at: ago(12), updated_at: ago(15), watch_rule_id: "r2",
    sale_windows: [
      { kind: "presale", name: "Metro presale", url: "https://example.com/p9", starts_at: on("2026-11-05T10:00:00-06:00"), ends_at: null },
      { kind: "public", name: "Public sale", url: null, starts_at: on("2026-11-06T10:00:00-06:00"), ends_at: null },
    ] },
  { ...base, id: "e7", source_slug: "ticketmaster", artist_name: "Wednesday", title: "Wednesday", venue: "Thalia Hall", city: "Chicago", state: "IL", start_time: on("2026-12-22T20:00:00-06:00"), ticket_url: "https://example.com/t7", status: "postponed", on_sale_start: null, last_seen_at: ago(12), updated_at: ago(60 * 30) },
];

const alert = (id: string, event_id: string, alert_type: string, mins: number, sent: string[]) => ({
  id, user_id: "u1", event_id, alert_type, payload: {}, sent_channels: sent, sent_at: ago(mins), created_at: ago(mins),
  message: `[${alert_type}] | raw | message | https://example.com`,
});

const alerts = [
  alert("a1", "e3", "status_changed", 20, ["email", "discord"]),
  alert("a1b", "e3", "public_sale_announced", 60 * 26, ["email"]),
  alert("a2", "e5", "new_event", 240, ["discord"]),
  alert("a3", "e6", "presale_announced", 420, ["sms"]),
  alert("a4", "e4", "status_changed", 60 * 48, ["email"]),
  alert("a5", "e9", "new_event", 15, ["email"]),
];

const artists = ["Fontaines D.C.", "Geese", "MJ Lenderman", "Hotline TNT", "Slow Pulp", "Wednesday"].map((name, i) => ({
  id: `w${i}`, user_id: "u1", name, spotify_id: null, city: null, state: null, country: "US", created_at: ago(9000), updated_at: ago(9000),
}));

const rules = [
  { id: "r1", user_id: "u1", kind: "venue", artist_id: null, venue_id: "v1", label: "Empty Bottle", city: "Chicago", state: "IL", country: "US", latitude: null, longitude: null, radius_miles: null, legacy_watch_artist_id: null, baseline_at: ago(8000), created_at: ago(9000), updated_at: ago(9000) },
  { id: "r2", user_id: "u1", kind: "location", artist_id: null, venue_id: null, label: "Chicago, IL", city: "Chicago", state: "IL", country: "US", latitude: null, longitude: null, radius_miles: 25, legacy_watch_artist_id: null, baseline_at: ago(8000), created_at: ago(9000), updated_at: ago(9000) },
];

const venueResults = [
  { id: "KovZpZAEkn6A", name: "Metro", city: "Chicago", state: "IL", country: "US", address: "3730 N. Clark St.", latitude: 41.9497, longitude: -87.6588 },
  { id: "KovZpZAFkvEA", name: "Metropolitan Opera House", city: "New York", state: "NY", country: "US", address: "30 Lincoln Center Plaza", latitude: 40.7725, longitude: -73.9835 },
];

const settings = {
  discordWebhook: { configured: true, enabled: true, masked: "…/webhooks/•••• 4821" },
  email: { configured: true, enabled: true, confirmed: true, masked: "k•••@gmail.com" },
  phone: { configured: false, enabled: false, confirmed: false, masked: null },
};

const sources = ["ticketmaster", "songkick", "bandsintown", "eventbrite"].map((slug, i) => ({
  source_slug: slug, enabled: i < 3, access_mode: i === 0 ? "official" : i < 3 ? "partner" : "unconfigured",
  last_success_at: ago(12), last_failure_at: null, last_error: null, quota_remaining: null, stale_after_seconds: 3600, stale: false,
}));

/** Answers the dashboard's /api calls with the sample data above. */
function installMockApi(empty: boolean) {
  const w = window as unknown as { __ugroundMockApi?: boolean };
  if (w.__ugroundMockApi) return;
  w.__ugroundMockApi = true;
  const real = window.fetch.bind(window);
  const json = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/search/venues")) return json({ venues: venueResults });
    if (url.includes("/api/watchlist")) return json({ artists: empty ? [] : artists });
    if (url.includes("/api/watch-rules")) return json({ rules: empty ? [] : rules });
    if (url.includes("/api/events")) return json({ events: empty ? [] : events });
    if (url.includes("/api/alerts")) return json({ alerts: empty ? [] : alerts });
    if (url.includes("/api/notification-settings")) return json({ settings });
    if (url.includes("/api/source-status")) return json({ sources });
    if (url.includes("/api/poll")) return json({ queued: true, queuedJobs: 6 }, 202);
    return real(input, init);
  }) as typeof fetch;
}

export default function PreviewDashboard() {
  // Install the mock before the dashboard's first effect fires its requests.
  useState(() => {
    if (typeof window !== "undefined") {
      installMockApi(new URLSearchParams(window.location.search).has("empty"));
    }
  });
  return <DashboardPage />;
}
