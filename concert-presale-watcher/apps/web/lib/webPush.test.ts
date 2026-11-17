import assert from "node:assert/strict";
import test from "node:test";
import { pushSubscribeSchema, userAgentLabel } from "./pushSubscriptionInput";
import type { PushSubscriptionRecord } from "./store/pushSubscriptions";
import {
  buildPushMessage,
  deliverToSubscriptions,
  getVapidConfig,
  isGonePushError,
  isPushConfigured,
  safePushUrl,
  sendPushToUser,
  sendPushToUserWith,
  type PushUserDeps,
  type VapidConfig,
} from "./webPush";

const subscription = (id: string): PushSubscriptionRecord => ({
  id,
  user_id: "user-1",
  endpoint: `https://push.example.com/${id}`,
  p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
  auth: "tBHItJI5svbpez7KI4CCXg",
  user_agent_label: null,
  created_at: "2026-11-16T00:00:00.000Z",
  last_used_at: null,
});

const pushError = (statusCode: number) => Object.assign(new Error("push failed"), { statusCode });

const vapid: VapidConfig = { publicKey: "pub", privateKey: "priv", subject: "mailto:ops@example.com" };

test("push message keeps the fields the service worker reads and trims long text", () => {
  const message = JSON.parse(
    buildPushMessage({ title: "  Wednesday  ", body: "x".repeat(1000), url: "/dashboard?event=1" }),
  ) as { title: string; body: string; url: string };
  assert.equal(message.title, "Wednesday");
  assert.equal(message.body.length, 400);
  assert.ok(message.body.endsWith("…"));
  assert.equal(message.url, "/dashboard?event=1");

  const empty = JSON.parse(buildPushMessage({ title: " ", body: "", url: null })) as { title: string; url: string };
  assert.equal(empty.title, "UGround");
  assert.equal(empty.url, "/dashboard");
});

test("push click targets are limited to app paths and http(s) links", () => {
  assert.equal(safePushUrl("javascript:alert(1)"), "/dashboard");
  assert.equal(safePushUrl("//evil.example.com"), "/dashboard");
  assert.equal(safePushUrl("not a url"), "/dashboard");
  assert.equal(safePushUrl("https://www.ticketmaster.com/event/1"), "https://www.ticketmaster.com/event/1");
  assert.equal(safePushUrl("https://www.uground.app/dashboard#a", "https://www.uground.app"), "/dashboard#a");
});

test("VAPID config is null without both keys and falls back to an https subject", () => {
  assert.equal(getVapidConfig({}), null);
  assert.equal(getVapidConfig({ vapidPublicKey: "pub" }), null);
  assert.deepEqual(getVapidConfig({ vapidPublicKey: "pub", vapidPrivateKey: "priv", appUrl: "http://localhost:3000" }), {
    publicKey: "pub",
    privateKey: "priv",
    subject: "https://www.uground.app",
  });
  assert.equal(
    getVapidConfig({ vapidPublicKey: "pub", vapidPrivateKey: "priv", vapidSubject: "mailto:a@b.co" })?.subject,
    "mailto:a@b.co",
  );
});

test("404 and 410 from the push service mean the subscription is gone", () => {
  assert.equal(isGonePushError(pushError(404)), true);
  assert.equal(isGonePushError(pushError(410)), true);
  assert.equal(isGonePushError(pushError(429)), false);
  assert.equal(isGonePushError(new Error("timeout")), false);
  assert.equal(isGonePushError(null), false);
});

test("delivery sorts subscriptions into delivered, gone, and failed", async () => {
  const result = await deliverToSubscriptions(
    [subscription("ok"), subscription("gone"), subscription("expired"), subscription("flaky")],
    "{}",
    async (sub) => {
      if (sub.id === "gone") throw pushError(410);
      if (sub.id === "expired") throw pushError(404);
      if (sub.id === "flaky") throw pushError(500);
    },
  );
  assert.deepEqual(result.delivered, ["ok"]);
  assert.deepEqual(result.gone.sort(), ["expired", "gone"]);
  assert.deepEqual(result.failed, ["flaky"]);
});

const fakeDeps = (overrides: Partial<PushUserDeps> & { sent?: string[]; removed?: string[][]; used?: string[][] }) => {
  const sent = overrides.sent ?? [];
  const removed = overrides.removed ?? [];
  const used = overrides.used ?? [];
  const deps: PushUserDeps = {
    vapid,
    list: async () => [subscription("a"), subscription("b")],
    send: () => async (sub) => {
      sent.push(sub.id);
      if (sub.id === "b") throw pushError(410);
    },
    removeGone: async (ids) => {
      removed.push(ids);
    },
    markUsed: async (ids) => {
      used.push(ids);
    },
    ...overrides,
  };
  return { deps, sent, removed, used };
};

test("sending to a user prunes dead subscriptions and marks live ones used", async () => {
  const { deps, sent, removed, used } = fakeDeps({});
  const ok = await sendPushToUserWith("user-1", { title: "t", body: "b", url: null }, deps);
  assert.equal(ok, true);
  assert.deepEqual(sent.sort(), ["a", "b"]);
  assert.deepEqual(removed, [["b"]]);
  assert.deepEqual(used, [["a"]]);
});

test("sending returns false when no browser accepted it", async () => {
  const { deps, removed } = fakeDeps({
    send: () => async () => {
      throw pushError(410);
    },
  });
  assert.equal(await sendPushToUserWith("user-1", { title: "t", body: "b", url: null }, deps), false);
  assert.deepEqual(removed, [["a", "b"]]);

  const none = fakeDeps({ list: async () => [] });
  assert.equal(await sendPushToUserWith("user-1", { title: "t", body: "b", url: null }, none.deps), false);
});

test("sending without VAPID keys returns false and never touches the database", async () => {
  let listed = false;
  const { deps } = fakeDeps({
    vapid: null,
    list: async () => {
      listed = true;
      return [];
    },
  });
  assert.equal(await sendPushToUserWith("user-1", { title: "t", body: "b", url: null }, deps), false);
  assert.equal(listed, false);

  if (!isPushConfigured()) {
    assert.equal(await sendPushToUser("user-1", { title: "t", body: "b", url: null }), false);
  }
});

test("a database error while sending is reported as not delivered", async () => {
  const { deps } = fakeDeps({
    list: async () => {
      throw new Error("Supabase request failed (500)");
    },
  });
  assert.equal(await sendPushToUserWith("user-1", { title: "t", body: "b", url: null }, deps), false);
});

test("subscribe input requires an https endpoint and both keys", () => {
  const valid = {
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    expirationTime: null,
    keys: { p256dh: subscription("x").p256dh, auth: subscription("x").auth },
  };
  assert.equal(pushSubscribeSchema.parse(valid).endpoint, valid.endpoint);
  assert.throws(() => pushSubscribeSchema.parse({ ...valid, endpoint: "http://push.example.com/abc" }));
  assert.throws(() => pushSubscribeSchema.parse({ ...valid, keys: { p256dh: valid.keys.p256dh } }));
  assert.throws(() => pushSubscribeSchema.parse({ ...valid, keys: { ...valid.keys, auth: "not base64!" } }));
});

test("user agent labels name the browser and system", () => {
  assert.equal(
    userAgentLabel(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    ),
    "Chrome on macOS",
  );
  assert.equal(
    userAgentLabel(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
    ),
    "Safari on iOS",
  );
  assert.equal(userAgentLabel(null), null);
});
