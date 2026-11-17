"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ANYWHERE, type LocationValue } from "@/lib/locations";

/**
 * The user's saved home location: loaded from /api/profile and used as the
 * default for new artists and imports.
 */
export function useHomeLocation() {
  const [home, setHome] = useState<LocationValue>(ANYWHERE);
  const saveCount = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/profile", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as { home?: LocationValue };
        // Don't overwrite a location the user already changed while this loaded.
        if (!cancelled && response.ok && body.home && saveCount.current === 0) setHome(body.home);
      })
      .catch(() => {
        // Without a saved location the form starts at "Anywhere".
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveHome = useCallback(async (next: LocationValue) => {
    const saveId = ++saveCount.current;
    setHome(next);
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: next.city || undefined,
        state: next.state || undefined,
        country: next.country || "US",
        radiusMiles: next.radiusMiles ?? undefined,
      }),
    });
    const body = (await response.json()) as { home?: LocationValue; error?: string };
    if (!response.ok || body.error) throw new Error(body.error ?? "Couldn't save your location");
    // Only the latest save gets to set the value shown.
    if (saveId === saveCount.current && body.home) setHome(body.home);
  }, []);

  return { home, saveHome };
}

/** When Spotify sends the user back (`?spotify=…`), run `onReturn` once, e.g. to open the watchlist. */
export function useSpotifyReturn(onReturn: () => void) {
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    if (new URLSearchParams(window.location.search).has("spotify")) onReturn();
  }, [onReturn]);
}
