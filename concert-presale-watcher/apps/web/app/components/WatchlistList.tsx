"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { WatchArtist, WatchRule } from "@/lib/types";

const artistDetail = (artist: WatchArtist): string => {
  const city = artist.city?.trim() || "";
  const state = artist.state?.trim() || "";
  const country = artist.country?.trim() || "US";

  if (city && state) return `Artist · ${city}, ${state}`;
  if (city) return `Artist · ${city}${country !== "US" ? `, ${country}` : ""}`;
  if (state) return `Artist · anywhere in ${state}`;
  return "Artist";
};

const ruleDetail = (rule: WatchRule): string => {
  if (rule.kind === "venue") {
    const place = [rule.city, rule.state].filter(Boolean).join(", ");
    return place && !rule.label.includes(place) ? `Venue · ${place}` : "Venue";
  }
  return rule.radius_miles ? `Area · within ${rule.radius_miles} mi` : "Area";
};

interface Row {
  key: string;
  name: string;
  detail: string;
  onRemove: () => void;
}

interface WatchlistListProps {
  artists: WatchArtist[];
  rules: WatchRule[];
  onRemoveArtist: (id: string) => Promise<void>;
  onRemoveRule: (id: string) => Promise<void>;
  loading?: boolean;
}

/** Everything the user follows, as one hairline-separated list. */
export default function WatchlistList({
  artists,
  rules,
  onRemoveArtist,
  onRemoveRule,
  loading,
}: WatchlistListProps) {
  const rows: Row[] = [
    ...artists.map((artist) => ({
      key: `artist-${artist.id}`,
      name: artist.name,
      detail: artistDetail(artist),
      onRemove: () => void onRemoveArtist(artist.id),
    })),
    ...rules
      .filter((rule) => rule.kind !== "artist")
      .map((rule) => ({
        key: `rule-${rule.id}`,
        name: rule.label,
        detail: ruleDetail(rule),
        onRemove: () => void onRemoveRule(rule.id),
      })),
  ];

  if (loading && rows.length === 0) {
    return (
      <ul className="divide-y" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="flex min-h-11 flex-col justify-center gap-2 py-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </li>
        ))}
      </ul>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-dashed px-4 py-6 text-center">
        <span className="text-sm text-foreground">Not following anything yet</span>
        <span className="text-[13px] text-muted-foreground">Add an artist above to get started</span>
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.key} className="flex min-h-11 items-center gap-3 py-1.5">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm leading-5 text-foreground">{row.name}</span>
            <span className="truncate text-xs leading-4 text-muted-foreground">{row.detail}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={row.onRemove}
            aria-label={`Stop following ${row.name}`}
          >
            <X aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
