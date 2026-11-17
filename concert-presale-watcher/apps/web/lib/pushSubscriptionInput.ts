import { z } from "zod";

const base64Url = z.string().trim().regex(/^[A-Za-z0-9_-]+={0,2}$/, "Invalid subscription key.");

/** The JSON a browser's PushSubscription.toJSON() produces. */
export const pushSubscribeSchema = z.object({
  endpoint: z
    .string()
    .trim()
    .url()
    .max(1000)
    .refine((value) => value.startsWith("https://"), "Push endpoint must use https."),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: base64Url.min(16).max(200),
    auth: base64Url.min(8).max(100),
  }),
});

/** Body for unsubscribe and status: just the browser's endpoint. */
export const pushEndpointSchema = z.object({
  endpoint: z.string().trim().url().max(1000),
});

/** "Chrome on macOS" style label, so a user can tell their browsers apart. */
export const userAgentLabel = (userAgent: string | null): string | null => {
  if (!userAgent) return null;
  const ua = userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua) || /FxiOS\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua) || /CriOS\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os;
};
