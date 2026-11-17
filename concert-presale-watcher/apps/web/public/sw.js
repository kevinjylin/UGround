/* UGround service worker: shows push notifications and opens the app on click.
   It does no caching; every request still goes to the network. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const readPayload = (event) => {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    return { body: event.data.text() };
  }
};

self.addEventListener("push", (event) => {
  const payload = readPayload(event);
  const title = typeof payload.title === "string" && payload.title ? payload.title : "UGround";
  const body = typeof payload.body === "string" ? payload.body : "";
  const url = typeof payload.url === "string" && payload.url ? payload.url : "/dashboard";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      data: { url },
    }),
  );
});

const openUrl = async (rawUrl) => {
  const target = new URL(rawUrl, self.location.origin);
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

  if (target.origin === self.location.origin) {
    const exact = windows.find((client) => client.url === target.href);
    if (exact) return exact.focus();

    const existing = windows.find((client) => new URL(client.url).origin === target.origin);
    if (existing) {
      try {
        const navigated = await existing.navigate(target.href);
        if (navigated) return navigated.focus();
      } catch {
        // navigate() fails on a window this worker doesn't control; open a new one.
      }
    }
  }

  return self.clients.openWindow(target.href);
};

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  event.waitUntil(openUrl(typeof url === "string" ? url : "/dashboard"));
});
