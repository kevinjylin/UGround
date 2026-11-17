"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { StatusDot } from "@/components/status-dot";
import type { Tone } from "@/lib/eventDisplay";

type PushState =
  | "checking"
  | "unsupported"
  | "ios-install"
  | "not-configured"
  | "blocked"
  | "off"
  | "on";

const STATUS: Record<PushState, { tone: Tone; text: string }> = {
  checking: { tone: "muted", text: "Checking…" },
  unsupported: { tone: "muted", text: "Not available in this browser" },
  "ios-install": { tone: "muted", text: "Needs Home Screen" },
  "not-configured": { tone: "muted", text: "Not available yet" },
  blocked: { tone: "warning", text: "Blocked in browser settings" },
  off: { tone: "muted", text: "Off" },
  on: { tone: "positive", text: "On" },
};

const isIos = (): boolean =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  // iPadOS reports itself as a Mac; touch support gives it away.
  (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);

const isStandalone = (): boolean =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const pushSupported = (): boolean =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** VAPID public keys come base64url encoded; subscribe() wants the raw bytes. */
const base64UrlToBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
};

const sameKey = (subscription: PushSubscription, publicKey: string): boolean => {
  const current = subscription.options.applicationServerKey;
  if (!current) return true;
  const expected = base64UrlToBytes(publicKey);
  const actual = new Uint8Array(current);
  return actual.length === expected.length && actual.every((byte, i) => byte === expected[i]);
};

const postJson = async (url: string, body?: unknown): Promise<Record<string, unknown>> => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : "Something went wrong. Try again.");
  }
  return data;
};

const getRegistration = async (): Promise<ServiceWorkerRegistration> => {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
};

/** Browser notifications for this device, in the Notifications panel. Applies right away. */
export default function PushChannelCard() {
  const [state, setState] = useState<PushState>("checking");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!pushSupported()) {
      setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
      return;
    }

    try {
      const response = await fetch("/api/push/public-key");
      const data = (await response.json()) as { configured?: boolean; publicKey?: string | null };
      if (!response.ok || !data.configured || !data.publicKey) {
        setState("not-configured");
        return;
      }
      setPublicKey(data.publicKey);

      if (Notification.permission === "denied") {
        setState("blocked");
        return;
      }

      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription || Notification.permission !== "granted") {
        setState("off");
        return;
      }

      // The browser may hold a subscription saved under another account.
      const status = await postJson("/api/push/status", { endpoint: subscription.endpoint });
      setState(status.subscribed === true ? "on" : "off");
    } catch {
      setState("off");
      setMessage({ tone: "error", text: "Couldn't check notification status. Reload to try again." });
    }
  }, []);

  useEffect(() => {
    // Browser-only checks, so they run after mount.
    void refresh();
  }, [refresh]);

  const turnOn = async () => {
    if (!publicKey) return;
    setBusy(true);
    setMessage(null);
    try {
      // Ask first, while the click still counts as a user gesture (Safari requires it).
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState("blocked");
        return;
      }
      if (permission !== "granted") {
        setMessage({ tone: "info", text: "Notifications stay off until you allow them." });
        return;
      }

      const registration = await getRegistration();
      let subscription = await registration.pushManager.getSubscription();
      if (subscription && !sameKey(subscription, publicKey)) {
        await subscription.unsubscribe();
        subscription = null;
      }
      subscription ??= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(publicKey),
      });

      await postJson("/api/push/subscribe", subscription.toJSON());
      setState("on");
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error && error.message ? error.message : "Couldn't turn on notifications.",
      });
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await postJson("/api/push/unsubscribe", { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setState("off");
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error && error.message ? error.message : "Couldn't turn off notifications.",
      });
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await postJson("/api/push/test");
      setMessage({ tone: "info", text: "Test sent. It can take a few seconds to show up." });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error && error.message ? error.message : "Couldn't send the test.",
      });
    } finally {
      setBusy(false);
    }
  };

  const status = STATUS[state];
  const canToggle = state === "on" || state === "off";

  return (
    <section className="flex flex-col gap-3 py-5 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm leading-5 font-medium text-foreground">Browser notifications</h3>
          <div className="flex min-w-0 items-center gap-2">
            <StatusDot tone={status.tone}>{status.text}</StatusDot>
            {canToggle ? <span className="truncate text-[13px] leading-5 text-faint">This browser</span> : null}
          </div>
        </div>
        <Switch
          checked={state === "on"}
          onCheckedChange={(checked) => void (checked ? turnOn() : turnOff())}
          disabled={!canToggle || busy}
          aria-label="Send browser notifications on this device"
          className="mt-0.5"
        />
      </div>

      <StateNote state={state} />

      {state === "on" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void sendTest()} disabled={busy}>
            Send test
          </Button>
        </div>
      ) : null}

      {message ? (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={
            message.tone === "error"
              ? "text-[13px] leading-5 text-destructive"
              : "text-[13px] leading-5 text-muted-foreground"
          }
        >
          {message.text}
        </p>
      ) : null}
    </section>
  );
}

function StateNote({ state }: { state: PushState }) {
  const note = {
    checking: null,
    unsupported: "This browser can't show push notifications. Try a current version of Chrome, Edge, Firefox, or Safari.",
    "ios-install":
      "On iPhone and iPad, notifications only work from the Home Screen app. In Safari, tap Share, then Add to Home Screen, and open UGround from there.",
    "not-configured": "Browser notifications aren't set up on this server yet.",
    blocked:
      "Notifications for this site are blocked. Allow them in your browser's site settings, then reload this page.",
    off: "Turns on for this browser only and applies right away. Each browser you use is set up separately.",
    on: "Alerts show up on this device, even when no UGround tab is open.",
  }[state];

  return note ? <p className="text-[13px] leading-5 text-muted-foreground">{note}</p> : null;
}
