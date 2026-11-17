import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { DEFAULT_RADIUS_MILES, parseLocationText } from "./locations";
import { isSpotifyConnectResult } from "./spotifyConnect";
import { spotifyImportSchema, watchRuleSchema } from "./validation";
import {
  isOutsideLocation,
  locationChanged,
  toArtistLocation,
  watchArtistUpdateSchema,
} from "./watchlistLocation";

// env.ts reads process.env when first imported, so set the key before loading
// anything that encrypts.
process.env.ALERT_SETTINGS_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");
const loadOAuth = () => import("./spotifyOAuth");

test("Spotify OAuth state is checked against the cookie, the user, and the clock", async () => {
  const { createOAuthState, verifyOAuthState, STATE_TTL_SECONDS } = await loadOAuth();
  const now = Date.UTC(2026, 10, 16, 12);
  const { state, cookie } = createOAuthState("user-1", now);

  assert.equal(verifyOAuthState(cookie, state, "user-1", now + 1000), "ok");
  assert.equal(verifyOAuthState(cookie, `${state}x`, "user-1", now), "mismatch");
  assert.equal(verifyOAuthState(cookie, state, "user-2", now), "mismatch");
  assert.equal(verifyOAuthState(cookie, state, "user-1", now + STATE_TTL_SECONDS * 1000 + 1), "expired");
  assert.equal(verifyOAuthState(undefined, state, "user-1", now), "missing");
  assert.equal(verifyOAuthState(cookie, null, "user-1", now), "missing");
  assert.equal(verifyOAuthState("v1:not:a-real:cookie", state, "user-1", now), "missing");
  // The cookie is encrypted, so the state isn't readable from it.
  assert.ok(!cookie.includes(state));
});

test("Spotify access token cookie round-trips and expires before the token does", async () => {
  const { sealAccessToken, openAccessToken, TOKEN_TTL_SECONDS } = await loadOAuth();
  const now = Date.UTC(2026, 10, 16, 12);
  const { cookie, maxAge } = sealAccessToken("BQD-token", "user-1", 3600, now);

  assert.equal(maxAge, TOKEN_TTL_SECONDS);
  assert.ok(!cookie.includes("BQD-token"));
  assert.deepEqual(openAccessToken(cookie, "user-1", now + 1000), { status: "ok", token: "BQD-token" });
  assert.deepEqual(openAccessToken(cookie, "user-2", now), { status: "missing" });
  assert.deepEqual(openAccessToken(cookie, "user-1", now + maxAge * 1000), { status: "expired" });
  assert.deepEqual(openAccessToken(undefined, "user-1", now), { status: "missing" });

  // A token Spotify says lasts two minutes is kept for one.
  assert.equal(sealAccessToken("t", "user-1", 120, now).maxAge, 60);
});

test("Spotify authorize URL asks for the two read scopes and carries state", async () => {
  const { buildSpotifyAuthorizeUrl, spotifyRedirectUri } = await loadOAuth();
  const redirectUri = spotifyRedirectUri("https://www.uground.app/", "http://ignored");
  assert.equal(redirectUri, "https://www.uground.app/api/integrations/spotify/callback");
  assert.equal(
    spotifyRedirectUri(undefined, "http://127.0.0.1:3000"),
    "http://127.0.0.1:3000/api/integrations/spotify/callback",
  );

  const url = new URL(buildSpotifyAuthorizeUrl({ clientId: "abc", redirectUri, state: "s1" }));
  assert.equal(url.origin, "https://accounts.spotify.com");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("scope"), "user-follow-read user-top-read");
  assert.equal(url.searchParams.get("state"), "s1");
  assert.equal(url.searchParams.get("redirect_uri"), redirectUri);
});

test("Spotify result codes from the URL are recognized, other values aren't", () => {
  assert.equal(isSpotifyConnectResult("connected"), true);
  assert.equal(isSpotifyConnectResult("denied"), true);
  assert.equal(isSpotifyConnectResult("toString"), false);
  assert.equal(isSpotifyConnectResult(null), false);
});

test("artist location edits are validated and normalized", () => {
  assert.deepEqual(
    toArtistLocation(watchArtistUpdateSchema.parse({ city: " Austin ", state: "texas", country: "us" })),
    { city: "Austin", state: "TX", country: "US", radiusMiles: DEFAULT_RADIUS_MILES },
  );
  // A radius without a city is dropped; clearing everything means anywhere.
  assert.deepEqual(toArtistLocation(watchArtistUpdateSchema.parse({ state: "CA", radiusMiles: 25 })), {
    city: "",
    state: "CA",
    country: "US",
    radiusMiles: null,
  });
  assert.deepEqual(toArtistLocation(watchArtistUpdateSchema.parse({ city: "", state: "" })), {
    city: "",
    state: "",
    country: "US",
    radiusMiles: null,
  });
  assert.throws(() => watchArtistUpdateSchema.parse({ city: "Austin", radiusMiles: 0 }));
  assert.throws(() => watchArtistUpdateSchema.parse({ city: "Austin", radiusMiles: 501 }));
  assert.throws(() => watchArtistUpdateSchema.parse({ city: "Austin", radiusMiles: 12.5 }));
  assert.throws(() => watchArtistUpdateSchema.parse({ country: "USA" }));
  assert.throws(() => watchArtistUpdateSchema.parse({ city: "x".repeat(121) }));
});

test("radius is accepted on artist creation and the account import", () => {
  const rule = watchRuleSchema.parse({ kind: "artist", label: "Phoebe Bridgers", city: "Austin", radiusMiles: 25 });
  assert.equal(rule.kind === "artist" ? rule.radiusMiles : null, 25);
  assert.ok(spotifyImportSchema.parse({ account: true, selectedArtistIds: ["a"] }));
  assert.throws(() => spotifyImportSchema.parse({ selectedArtistIds: ["a"] }));
});

test("location changes are detected, including radius", () => {
  const before = { city: "Austin", state: "TX", country: "US", radius_miles: 50 };
  assert.equal(locationChanged(before, { city: "austin", state: "TX", country: "US", radiusMiles: 50 }), false);
  assert.equal(locationChanged(before, { city: "Austin", state: "TX", country: "US", radiusMiles: 25 }), true);
  assert.equal(locationChanged(before, { city: "", state: "", country: "US", radiusMiles: null }), true);
});

test("saved shows clearly outside the new location are picked for removal", () => {
  const austin = { city: "Austin", state: "TX", country: "US", radiusMiles: 50 };
  // Same city, and a listed city inside the radius, stay.
  assert.equal(isOutsideLocation({ city: "Austin", state: "TX", country: "US" }, austin), false);
  assert.equal(isOutsideLocation({ city: "San Antonio", state: "TX", country: "US" }, { ...austin, radiusMiles: 100 }), false);
  // San Antonio is about 75 miles away.
  assert.equal(isOutsideLocation({ city: "San Antonio", state: "TX", country: "US" }, austin), true);
  assert.equal(isOutsideLocation({ city: "Chicago", state: "IL", country: "US" }, austin), true);
  // Shows we can't place are kept.
  assert.equal(isOutsideLocation({ city: "Round Rock", state: "TX", country: "US" }, austin), false);
  assert.equal(isOutsideLocation({ city: null, state: null, country: null }, austin), false);
  // Another country is always outside.
  assert.equal(isOutsideLocation({ city: "London", state: null, country: "GB" }, austin), true);

  // An unlisted city has no center, so it matches by name.
  const marfa = { city: "Marfa", state: "TX", country: "US", radiusMiles: 50 };
  assert.equal(isOutsideLocation({ city: "Marfa", state: "TX", country: "US" }, marfa), false);
  assert.equal(isOutsideLocation({ city: "Austin", state: "TX", country: "US" }, marfa), true);
  assert.equal(isOutsideLocation({ city: null, state: "TX", country: "US" }, marfa), false);

  const texas = { city: "", state: "TX", country: "US", radiusMiles: null };
  assert.equal(isOutsideLocation({ city: "Dallas", state: "TX", country: "US" }, texas), false);
  assert.equal(isOutsideLocation({ city: "Tulsa", state: "OK", country: "US" }, texas), true);

  const anywhere = { city: "", state: "", country: "US", radiusMiles: null };
  assert.equal(isOutsideLocation({ city: "Chicago", state: "IL", country: "US" }, anywhere), false);
});

test("typed locations resolve to listed cities and states", () => {
  assert.deepEqual(parseLocationText("austin", null), {
    city: "Austin",
    state: "TX",
    country: "US",
    radiusMiles: DEFAULT_RADIUS_MILES,
  });
  assert.deepEqual(parseLocationText("Texas", 25), { city: "", state: "TX", country: "US", radiusMiles: null });
  assert.deepEqual(parseLocationText("Marfa", 25), { city: "Marfa", state: "", country: "US", radiusMiles: 25 });
  assert.deepEqual(parseLocationText("  ", 25), { city: "", state: "", country: "US", radiusMiles: null });
});
