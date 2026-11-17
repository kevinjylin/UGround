import test from "node:test";
import assert from "node:assert";
import {
  FeedQueryError,
  defaultFeedQuery,
  feedSearchParams,
  parseFeedRequest,
  parseFeedSource,
  parseUserStateBody,
} from "./feedQuery";

const RULE_ID = "0b7f3c1e-8f7a-4d1e-9c55-2f3a4b5c6d7e";

test("parseFeedRequest", async (t) => {
  await t.test("defaults to the first page of upcoming shows", () => {
    assert.deepStrictEqual(parseFeedRequest(new URLSearchParams()), {
      ...defaultFeedQuery,
      limit: 50,
      offset: 0,
    });
  });

  await t.test("reads every field", () => {
    const parsed = parseFeedRequest(
      new URLSearchParams(
        `view=past&filter=saved&sort=date_soonest&q=%20Empty%20Bottle%20&source=rule:${RULE_ID}&limit=20&offset=40`,
      ),
    );
    assert.strictEqual(parsed.view, "past");
    assert.strictEqual(parsed.filter, "saved");
    assert.strictEqual(parsed.sort, "date_soonest");
    assert.strictEqual(parsed.q, "Empty Bottle");
    assert.deepStrictEqual(parsed.source, { kind: "rule", id: RULE_ID });
    assert.strictEqual(parsed.limit, 20);
    assert.strictEqual(parsed.offset, 40);
  });

  await t.test("falls back on unknown view, filter and sort", () => {
    const parsed = parseFeedRequest(new URLSearchParams("view=everything&filter=x&sort=y"));
    assert.strictEqual(parsed.view, "upcoming");
    assert.strictEqual(parsed.filter, "all");
    assert.strictEqual(parsed.sort, "recent_change");
  });

  await t.test("caps the search length", () => {
    const parsed = parseFeedRequest(new URLSearchParams({ q: "a".repeat(500) }));
    assert.strictEqual(parsed.q.length, 100);
  });

  await t.test("rejects bad paging", () => {
    assert.throws(() => parseFeedRequest(new URLSearchParams("limit=-1")), FeedQueryError);
    assert.throws(() => parseFeedRequest(new URLSearchParams("limit=500")), FeedQueryError);
    assert.throws(() => parseFeedRequest(new URLSearchParams("offset=abc")), FeedQueryError);
  });
});

test("parseFeedSource", () => {
  assert.deepStrictEqual(parseFeedSource("artist"), { kind: "artist", id: null });
  assert.deepStrictEqual(parseFeedSource(`artist:${RULE_ID}`), { kind: "artist", id: RULE_ID });
  assert.strictEqual(parseFeedSource("rule:not-a-uuid"), null);
  assert.strictEqual(parseFeedSource("rule"), null);
  assert.strictEqual(parseFeedSource(`venue:${RULE_ID}`), null);
  assert.strictEqual(parseFeedSource(null), null);
});

test("feedSearchParams round-trips through parseFeedRequest", () => {
  const query = {
    view: "hidden" as const,
    filter: "onsale" as const,
    sort: "artist_az" as const,
    q: "chicago",
    source: { kind: "rule" as const, id: RULE_ID },
  };
  const params = feedSearchParams(query, { limit: 25, offset: 50, counts: true });
  assert.strictEqual(params.get("counts"), "1");
  const parsed = parseFeedRequest(params);
  assert.deepStrictEqual(parsed, { ...query, limit: 25, offset: 50 });
  assert.strictEqual(feedSearchParams(defaultFeedQuery).toString(), "");
});

test("parseUserStateBody", () => {
  assert.strictEqual(parseUserStateBody({ state: "going" }), "going");
  assert.strictEqual(parseUserStateBody({ state: "interested" }), "interested");
  assert.strictEqual(parseUserStateBody({ state: "hidden" }), "hidden");
  assert.strictEqual(parseUserStateBody({ state: null }), null);
  assert.strictEqual(parseUserStateBody({ state: "maybe" }), undefined);
  assert.strictEqual(parseUserStateBody({}), undefined);
  assert.strictEqual(parseUserStateBody(null), undefined);
});
