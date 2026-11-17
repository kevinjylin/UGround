/** Browser push delivery over the Web Push protocol, signed with VAPID keys. */

import { sendNotification } from "web-push";
import { env } from "./env";
import { logger } from "./logger";
import {
  countPushSubscriptions,
  deletePushSubscriptionsByIds,
  listPushSubscriptions,
  markPushSubscriptionsUsed,
  type PushSubscriptionRecord,
} from "./store/pushSubscriptions";

export interface PushPayload {
  title: string;
  body: string;
  /** Where a tap on the notification goes. */
  url: string | null;
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

const FALLBACK_URL = "/dashboard";
const FALLBACK_SUBJECT = "https://www.uground.app";
const TITLE_MAX = 120;
const BODY_MAX = 400;
/** Push services hold an undelivered message this long (seconds) before dropping it. */
const PUSH_TTL_SECONDS = 24 * 60 * 60;

/** VAPID settings, or null when push isn't set up on this server. */
export const getVapidConfig = (source: {
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
  vapidSubject?: string;
  appUrl?: string;
} = env): VapidConfig | null => {
  if (!source.vapidPublicKey || !source.vapidPrivateKey) {
    return null;
  }
  // web-push only accepts an https: URL or a mailto: address as the subject.
  const subject =
    source.vapidSubject ??
    (source.appUrl?.startsWith("https://") ? source.appUrl : FALLBACK_SUBJECT);
  return { publicKey: source.vapidPublicKey, privateKey: source.vapidPrivateKey, subject };
};

export const isPushConfigured = (): boolean => getVapidConfig() !== null;

const truncate = (value: string, max: number): string => {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
};

/**
 * Keep the click target to an app path or an http(s) link. Anything else
 * (javascript:, data:, protocol-relative) falls back to the dashboard.
 */
export const safePushUrl = (url: string | null, appUrl = env.appUrl): string => {
  if (!url) return FALLBACK_URL;
  const value = url.trim();
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) {
    return value;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return FALLBACK_URL;
    if (appUrl && parsed.origin === new URL(appUrl).origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    return FALLBACK_URL;
  }
};

/** The JSON body public/sw.js reads in its push handler. */
export const buildPushMessage = (payload: PushPayload): string =>
  JSON.stringify({
    title: truncate(payload.title, TITLE_MAX) || "UGround",
    body: truncate(payload.body, BODY_MAX),
    url: safePushUrl(payload.url),
  });

/** 404 and 410 mean the browser unsubscribed or the subscription expired. */
export const isGonePushError = (error: unknown): boolean => {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return status === 404 || status === 410;
};

export type PushSender = (subscription: PushSubscriptionRecord, message: string) => Promise<void>;

export interface PushDeliveryResult {
  delivered: string[];
  gone: string[];
  failed: string[];
}

/** Send one message to each subscription and sort out which ones worked. */
export const deliverToSubscriptions = async (
  subscriptions: PushSubscriptionRecord[],
  message: string,
  send: PushSender,
): Promise<PushDeliveryResult> => {
  const result: PushDeliveryResult = { delivered: [], gone: [], failed: [] };
  await Promise.all(
    subscriptions.map(async (subscription) => {
      const { id } = subscription;
      try {
        await send(subscription, message);
        result.delivered.push(id);
      } catch (error) {
        if (isGonePushError(error)) {
          result.gone.push(id);
        } else {
          result.failed.push(id);
          logger.warn(`[push] delivery failed subscription=${id}`, error);
        }
      }
    }),
  );
  return result;
};

const webPushSender = (vapid: VapidConfig): PushSender => async (subscription, message) => {
  await sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    message,
    { vapidDetails: vapid, TTL: PUSH_TTL_SECONDS, urgency: "high", timeout: 10_000 },
  );
};

export interface PushUserDeps {
  vapid: VapidConfig | null;
  list: (userId: string) => Promise<PushSubscriptionRecord[]>;
  send: (vapid: VapidConfig) => PushSender;
  removeGone: (ids: string[]) => Promise<void>;
  markUsed: (ids: string[]) => Promise<void>;
}

const defaultDeps = (): PushUserDeps => ({
  vapid: getVapidConfig(),
  list: listPushSubscriptions,
  send: webPushSender,
  removeGone: deletePushSubscriptionsByIds,
  markUsed: markPushSubscriptionsUsed,
});

/** sendPushToUser with its collaborators passed in; used directly by tests. */
export const sendPushToUserWith = async (
  userId: string,
  payload: PushPayload,
  deps: PushUserDeps,
): Promise<boolean> => {
  if (!deps.vapid) return false;
  try {
    const subscriptions = await deps.list(userId);
    if (subscriptions.length === 0) return false;
    const result = await deliverToSubscriptions(
      subscriptions,
      buildPushMessage(payload),
      deps.send(deps.vapid),
    );
    await Promise.all([deps.removeGone(result.gone), deps.markUsed(result.delivered)]);
    return result.delivered.length > 0;
  } catch (error) {
    logger.error(`[push] send failed user=${userId}`, error);
    return false;
  }
};

/** True when the user has at least one browser subscribed and push is set up on the server. */
export const hasPushSubscription = async (userId: string): Promise<boolean> => {
  if (!isPushConfigured()) return false;
  try {
    return (await countPushSubscriptions(userId)) > 0;
  } catch (error) {
    logger.error(`[push] subscription lookup failed user=${userId}`, error);
    return false;
  }
};

/** Send to every browser the user subscribed. True when at least one accepted it. */
export const sendPushToUser = async (userId: string, payload: PushPayload): Promise<boolean> =>
  sendPushToUserWith(userId, payload, defaultDeps());
