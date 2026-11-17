"use client";

import { useState } from "react";
import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ANYWHERE, DEFAULT_RADIUS_MILES, type LocationValue } from "@/lib/locations";
import type { WatchArtist, WatchRule } from "@/lib/types";
import LocationField from "./LocationField";

const artistDetail = (artist: WatchArtist): string => {
  const city = artist.city?.trim() || "";
  const state = artist.state?.trim() || "";
  const country = artist.country?.trim() || "US";
  const within = artist.radius_miles ? `within ${artist.radius_miles} mi of ` : "";

  if (city && state) return `Artist · ${within}${city}, ${state}`;
  if (city) return `Artist · ${within}${city}${country !== "US" ? `, ${country}` : ""}`;
  if (state) return `Artist · anywhere in ${state}`;
  return "Artist · anywhere";
};

const artistLocation = (artist: WatchArtist): LocationValue => {
  const city = artist.city?.trim() || "";
  return {
    city,
    state: artist.state?.trim() || "",
    country: artist.country?.trim() || "US",
    radiusMiles: city ? (artist.radius_miles ?? DEFAULT_RADIUS_MILES) : null,
  };
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
  artist?: WatchArtist;
}

interface WatchlistListProps {
  artists: WatchArtist[];
  rules: WatchRule[];
  onRemoveArtist: (id: string) => Promise<void>;
  onRemoveRule: (id: string) => Promise<void>;
  onUpdateArtistLocation: (id: string, location: LocationValue) => Promise<void>;
  loading?: boolean;
}

function ArtistLocationEditor({
  artist,
  onSave,
  onCancel,
}: {
  artist: WatchArtist;
  onSave: (location: LocationValue) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<LocationValue>(() => artistLocation(artist));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(value);
    } catch (caught) {
      setError((caught as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 pt-1 pb-3">
      <LocationField
        id={`edit-${artist.id}`}
        label={`Where to watch ${artist.name}`}
        value={value}
        onChange={setValue}
        disabled={saving}
      />
      <p className="text-[13px] leading-5 text-muted-foreground">
        Saved shows clearly outside the new location are removed. Shows near it appear after the
        next check.
      </p>
      {error ? (
        <p role="alert" className="text-[13px] leading-5 text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        {value.city || value.state ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto text-muted-foreground"
            onClick={() => setValue(ANYWHERE)}
            disabled={saving}
          >
            Watch anywhere
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Everything the user follows, as one hairline-separated list. */
export default function WatchlistList({
  artists,
  rules,
  onRemoveArtist,
  onRemoveRule,
  onUpdateArtistLocation,
  loading,
}: WatchlistListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const rows: Row[] = [
    ...artists.map((artist) => ({
      key: `artist-${artist.id}`,
      name: artist.name,
      detail: artistDetail(artist),
      onRemove: () => void onRemoveArtist(artist.id),
      artist,
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
      {rows.map((row) => {
        const editing = row.artist !== undefined && editingId === row.artist.id;
        return (
          <li key={row.key} className="flex flex-col">
            <div className="flex min-h-11 items-center gap-1 py-1.5">
              <div className="flex min-w-0 flex-1 flex-col pr-2">
                <span className="truncate text-sm leading-5 text-foreground">{row.name}</span>
                <span className="truncate text-xs leading-4 text-muted-foreground">{row.detail}</span>
              </div>
              {row.artist ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground"
                  onClick={() => setEditingId(editing ? null : (row.artist as WatchArtist).id)}
                  aria-label={`Change where ${row.name} is watched`}
                  aria-expanded={editing}
                >
                  <MapPin aria-hidden="true" />
                </Button>
              ) : null}
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
            </div>
            {editing && row.artist ? (
              <ArtistLocationEditor
                key={row.artist.updated_at}
                artist={row.artist}
                onCancel={() => setEditingId(null)}
                onSave={async (location) => {
                  await onUpdateArtistLocation((row.artist as WatchArtist).id, location);
                  setEditingId(null);
                }}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
