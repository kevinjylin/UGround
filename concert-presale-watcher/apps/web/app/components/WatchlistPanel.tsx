"use client";

import { FormEvent, useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { relativeTime } from "@/lib/format";
import { searchConcertMarkets, US_CONCERT_MARKETS, US_STATE_SUGGESTIONS } from "@/lib/locations";
import type { ArtistSuggestion, LocationSuggestion, PollResult, VenueSuggestion } from "@/lib/types";
import AutocompleteCombobox, { type ComboboxOption } from "./AutocompleteCombobox";

const formatLocation = (city: string, stateRegion: string, country: string): string => {
  const parts = [city, stateRegion].map((part) => part.trim()).filter(Boolean);
  if (parts.length > 0) {
    return parts.join(", ");
  }

  return country.trim() && country.trim() !== "US" ? country.trim() : "";
};

const artistToOption = (artist: ArtistSuggestion): ComboboxOption => ({
  id: artist.id,
  label: artist.name,
  imageUrl: artist.imageUrl,
  kind: "artist",
});

const locationToOption = (location: LocationSuggestion): ComboboxOption => ({
  id: location.id,
  label: location.label,
  description: location.kind === "state" ? "All cities" : undefined,
  kind: "location",
});

const venueToOption = (venue: VenueSuggestion): ComboboxOption => ({
  id: venue.id,
  label: venue.name,
  description: [venue.city, venue.state].filter(Boolean).join(", ") || undefined,
  kind: "location",
});

const AREA_RADIUS_OPTIONS = ["10", "25", "50", "100"] as const;

const LOCATION_BY_ID = new Map<string, LocationSuggestion>(
  [...US_CONCERT_MARKETS, ...US_STATE_SUGGESTIONS].map((location) => [location.id, location]),
);

const textareaClass =
  "min-h-20 w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30";

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-sm font-medium text-foreground">{title}</h4>
      {description ? (
        <p className="text-[13px] leading-5 text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

interface WatchlistPanelProps {
  busy: boolean;
  city: string;
  stateRegion: string;
  country: string;
  onCityChange: (v: string) => void;
  onStateChange: (v: string) => void;
  onCountryChange: (v: string) => void;
  onAdd: (name: string, spotifyId?: string) => Promise<void>;
  onAddWatchRule: (input: Record<string, unknown>) => Promise<void>;
  onImportSpotify: (ids: string) => Promise<void>;
  onPreviewSpotifyPlaylist: (url: string) => Promise<ArtistSuggestion[]>;
  onImportSpotifyPlaylist: (url: string, artistIds: string[]) => Promise<void>;
  onPoll: () => Promise<void>;
  polling: boolean;
  lastPoll: PollResult | null;
}

export default function WatchlistPanel({
  busy,
  city,
  stateRegion,
  country,
  onCityChange,
  onStateChange,
  onCountryChange,
  onAdd,
  onAddWatchRule,
  onImportSpotify,
  onPreviewSpotifyPlaylist,
  onImportSpotifyPlaylist,
  onPoll,
  polling,
  lastPoll,
}: WatchlistPanelProps) {
  const [artistName, setArtistName] = useState("");
  const [selectedArtist, setSelectedArtist] = useState<ArtistSuggestion | null>(null);
  const [artistSuggestions, setArtistSuggestions] = useState<ArtistSuggestion[]>([]);
  const [artistSearchLoading, setArtistSearchLoading] = useState(false);
  const [artistSearchError, setArtistSearchError] = useState<string | null>(null);
  const [locationInput, setLocationInput] = useState(() =>
    formatLocation(city, stateRegion, country),
  );
  const [spotifyIds, setSpotifyIds] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [playlistArtists, setPlaylistArtists] = useState<ArtistSuggestion[]>([]);
  const [selectedPlaylistArtists, setSelectedPlaylistArtists] = useState<string[]>([]);
  const [ruleKind, setRuleKind] = useState<"venue" | "location">("venue");
  const [venueInput, setVenueInput] = useState("");
  const [selectedVenue, setSelectedVenue] = useState<VenueSuggestion | null>(null);
  const [venueSuggestions, setVenueSuggestions] = useState<VenueSuggestion[]>([]);
  const [venueSearchLoading, setVenueSearchLoading] = useState(false);
  const [venueSearchError, setVenueSearchError] = useState<string | null>(null);
  const [areaInput, setAreaInput] = useState("");
  const [selectedArea, setSelectedArea] = useState<LocationSuggestion | null>(null);
  const [radiusMiles, setRadiusMiles] = useState<string>("50");
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleError, setRuleError] = useState<string | null>(null);
  const uid = useId();

  const artistOptions = useMemo(() => artistSuggestions.map(artistToOption), [artistSuggestions]);
  const locationOptions = useMemo(
    () => searchConcertMarkets(locationInput).map(locationToOption),
    [locationInput],
  );
  const venueOptions = useMemo(() => venueSuggestions.map(venueToOption), [venueSuggestions]);
  // Areas center on a known city, so states aren't offered here.
  const areaOptions = useMemo(
    () =>
      searchConcertMarkets(areaInput)
        .filter((location) => location.kind === "city")
        .map(locationToOption),
    [areaInput],
  );

  useEffect(() => {
    const query = venueInput.trim();

    if (query.length < 2 || selectedVenue?.name === venueInput) {
      setVenueSuggestions([]);
      setVenueSearchLoading(false);
      setVenueSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setVenueSearchLoading(true);
      setVenueSearchError(null);

      void fetch(`/api/search/venues?q=${encodeURIComponent(query)}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = (await response.json()) as { venues?: VenueSuggestion[]; error?: string };
          if (!response.ok || body.error) {
            throw new Error(body.error ?? "Venue search is unavailable right now.");
          }
          setVenueSuggestions(body.venues ?? []);
        })
        .catch((error) => {
          if ((error as Error).name === "AbortError") return;
          setVenueSuggestions([]);
          setVenueSearchError((error as Error).message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setVenueSearchLoading(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [venueInput, selectedVenue]);

  useEffect(() => {
    const query = artistName.trim();

    if (query.length < 2 || selectedArtist?.name === artistName) {
      setArtistSuggestions([]);
      setArtistSearchLoading(false);
      setArtistSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setArtistSearchLoading(true);
      setArtistSearchError(null);

      void fetch(`/api/search/artists?q=${encodeURIComponent(query)}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = (await response.json()) as {
            artists?: ArtistSuggestion[];
            error?: string;
          };

          if (!response.ok || body.error) {
            throw new Error(body.error ?? "Spotify search unavailable");
          }

          setArtistSuggestions(body.artists ?? []);
        })
        .catch((error) => {
          if ((error as Error).name === "AbortError") {
            return;
          }

          setArtistSuggestions([]);
          setArtistSearchError((error as Error).message);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setArtistSearchLoading(false);
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [artistName, selectedArtist]);

  const handleAddArtist = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = artistName.trim();
    if (!trimmedName) {
      return;
    }

    await onAdd(trimmedName, selectedArtist?.id);
    setArtistName("");
    setSelectedArtist(null);
    setArtistSuggestions([]);
  };

  const handleImport = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onImportSpotify(spotifyIds);
    setSpotifyIds("");
  };

  const handlePlaylistPreview = async () => {
    const artists = await onPreviewSpotifyPlaylist(playlistUrl);
    setPlaylistArtists(artists);
    setSelectedPlaylistArtists(artists.map((artist) => artist.id));
  };

  const handlePlaylistImport = async () => {
    await onImportSpotifyPlaylist(playlistUrl, selectedPlaylistArtists);
    setPlaylistUrl("");
    setPlaylistArtists([]);
    setSelectedPlaylistArtists([]);
  };

  const handleArtistValueChange = (value: string) => {
    setArtistName(value);
    if (selectedArtist && selectedArtist.name !== value) {
      setSelectedArtist(null);
    }
  };

  const handleAdditionalRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (ruleKind === "location" && !selectedArea) {
      setRuleError("Pick a city from the list to center the area on.");
      return;
    }

    setRuleSaving(true);
    setRuleError(null);
    try {
      if (ruleKind === "venue") {
        await onAddWatchRule({
          kind: "venue",
          label: selectedVenue?.name ?? venueInput.trim(),
          ticketmasterVenueId: selectedVenue?.id,
          city: selectedVenue?.city ?? undefined,
          state: selectedVenue?.state ?? undefined,
          country: selectedVenue?.country ?? "US",
        });
        setVenueInput("");
        setSelectedVenue(null);
        setVenueSuggestions([]);
      } else if (selectedArea) {
        await onAddWatchRule({
          kind: "location",
          label: selectedArea.label,
          city: selectedArea.city,
          state: selectedArea.state,
          country: selectedArea.country,
          radiusMiles: Number(radiusMiles),
        });
        setAreaInput("");
        setSelectedArea(null);
      }
    } catch (error) {
      setRuleError((error as Error).message);
    } finally {
      setRuleSaving(false);
    }
  };

  const handleVenueValueChange = (value: string) => {
    setVenueInput(value);
    setRuleError(null);
    if (selectedVenue && selectedVenue.name !== value) setSelectedVenue(null);
  };

  const handleVenueSelect = (option: ComboboxOption) => {
    const venue = venueSuggestions.find((item) => item.id === option.id);
    if (!venue) return;
    setSelectedVenue(venue);
    setVenueInput(venue.name);
    setVenueSuggestions([]);
    setVenueSearchError(null);
  };

  const handleAreaValueChange = (value: string) => {
    setAreaInput(value);
    setRuleError(null);
    if (selectedArea && selectedArea.label !== value) setSelectedArea(null);
  };

  const handleAreaSelect = (option: ComboboxOption) => {
    const location = LOCATION_BY_ID.get(option.id);
    if (!location) return;
    setSelectedArea(location);
    setAreaInput(location.label);
  };

  const handleArtistSelect = (option: ComboboxOption) => {
    const artist = artistSuggestions.find((item) => item.id === option.id);
    if (!artist) {
      return;
    }

    setSelectedArtist(artist);
    setArtistName(artist.name);
    setArtistSuggestions([]);
    setArtistSearchError(null);
  };

  const handleLocationValueChange = (value: string) => {
    setLocationInput(value);
    onCityChange(value.trim());
    onStateChange("");
    onCountryChange("US");
  };

  const handleLocationSelect = (option: ComboboxOption) => {
    const location = LOCATION_BY_ID.get(option.id);
    if (!location) {
      return;
    }

    setLocationInput(location.label);
    onCityChange(location.city);
    onStateChange(location.state);
    onCountryChange(location.country);
  };

  const togglePlaylistArtist = (artistId: string, checked: boolean) => {
    setSelectedPlaylistArtists((current) =>
      checked ? [...current, artistId] : current.filter((id) => id !== artistId),
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-col gap-4" onSubmit={handleAddArtist}>
        <SectionHeading
          title="Follow an artist"
          description="Search Spotify or type any name. Add a city to only hear about shows near it."
        />
        <AutocompleteCombobox
          id={`${uid}-artist`}
          label="Artist"
          value={artistName}
          placeholder="Search artists"
          required
          disabled={busy}
          options={artistOptions}
          loading={artistSearchLoading}
          error={artistSearchError}
          emptyMessage="No Spotify match. The name you typed will be used"
          showEmptyMessage={
            artistName.trim().length >= 2 && !selectedArtist && !artistSearchLoading
          }
          statusMessage={selectedArtist ? `Matched on Spotify: ${selectedArtist.name}` : null}
          onValueChange={handleArtistValueChange}
          onSelect={handleArtistSelect}
        />
        <AutocompleteCombobox
          id={`${uid}-location`}
          label="City or state (optional)"
          value={locationInput}
          placeholder="Anywhere"
          disabled={busy}
          options={locationOptions}
          emptyMessage="No match. The city you typed will be used"
          showEmptyMessage={Boolean(locationInput.trim())}
          onValueChange={handleLocationValueChange}
          onSelect={handleLocationSelect}
        />
        <Button type="submit" disabled={busy} className="self-start">
          {busy ? "Adding…" : "Add to watchlist"}
        </Button>
      </form>

      <Collapsible className="flex flex-col">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="group/more -ml-2.5 self-start text-muted-foreground"
          >
            Venues, areas, and Spotify import
            <ChevronDown
              aria-hidden="true"
              className="transition-transform duration-200 group-data-[state=open]/more:rotate-180"
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="flex flex-col gap-6 pt-4">
          <form className="flex flex-col gap-4" onSubmit={handleAdditionalRule}>
            <SectionHeading
              title="Follow a venue or area"
              description="Hear about every concert at one venue, or about shows going on sale near a city."
            />
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              value={ruleKind}
              onValueChange={(value) => {
                if (value === "venue" || value === "location") {
                  setRuleKind(value);
                  setRuleError(null);
                }
              }}
              aria-label="Watch type"
            >
              {(
                [
                  ["venue", "Venue"],
                  ["location", "Area"],
                ] as const
              ).map(([value, text]) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  className="px-3 text-muted-foreground data-[state=on]:bg-foreground/10 data-[state=on]:text-foreground"
                >
                  {text}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            {ruleKind === "venue" ? (
              <AutocompleteCombobox
                id={`${uid}-venue`}
                label="Venue"
                value={venueInput}
                placeholder="Search venues"
                required
                disabled={busy || ruleSaving}
                options={venueOptions}
                loading={venueSearchLoading}
                error={venueSearchError}
                emptyMessage="No match on Ticketmaster. Try the venue's full name"
                showEmptyMessage={
                  venueInput.trim().length >= 2 && !selectedVenue && !venueSearchLoading
                }
                statusMessage={
                  selectedVenue
                    ? `Ticketmaster venue${selectedVenue.address ? ` at ${selectedVenue.address}` : ""}`
                    : null
                }
                onValueChange={handleVenueValueChange}
                onSelect={handleVenueSelect}
              />
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                <AutocompleteCombobox
                  id={`${uid}-area`}
                  label="Near"
                  value={areaInput}
                  placeholder="Search cities"
                  required
                  disabled={busy || ruleSaving}
                  options={areaOptions}
                  emptyMessage="Not a listed city. Pick the nearest one"
                  showEmptyMessage={Boolean(areaInput.trim()) && !selectedArea}
                  onValueChange={handleAreaValueChange}
                  onSelect={handleAreaSelect}
                />
                <Field className="gap-2">
                  <FieldLabel id={`${uid}-radius-label`}>Within</FieldLabel>
                  <Select value={radiusMiles} onValueChange={setRadiusMiles}>
                    <SelectTrigger aria-labelledby={`${uid}-radius-label`} className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {AREA_RADIUS_OPTIONS.map((miles) => (
                        <SelectItem key={miles} value={miles}>
                          {miles} mi
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}

            <FieldDescription>
              {ruleKind === "venue"
                ? "The first check fills your feed quietly. After that, new shows and changes alert you."
                : "Tracks shows not on sale yet. The first check fills your feed quietly; later announcements alert you."}
            </FieldDescription>

            {ruleError ? (
              <p role="alert" className="text-[13px] leading-5 text-destructive">
                {ruleError}
              </p>
            ) : null}

            <Button
              type="submit"
              variant="outline"
              disabled={busy || ruleSaving}
              className="self-start"
            >
              {ruleSaving ? "Adding…" : ruleKind === "venue" ? "Add venue" : "Add area"}
            </Button>
          </form>

          <Separator />

          <div className="flex flex-col gap-4">
            <SectionHeading
              title="Import a Spotify playlist"
              description="Paste a public playlist, then pick which of its artists to follow."
            />
            <Field className="gap-2">
              <FieldLabel htmlFor={`${uid}-playlist`}>Playlist link</FieldLabel>
              <Input
                id={`${uid}-playlist`}
                type="url"
                value={playlistUrl}
                onChange={(event) => setPlaylistUrl(event.target.value)}
                placeholder="https://open.spotify.com/playlist/…"
              />
            </Field>
            <Button
              type="button"
              variant="outline"
              onClick={handlePlaylistPreview}
              disabled={busy || !playlistUrl.trim()}
              className="self-start"
            >
              Preview artists
            </Button>

            {playlistArtists.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-muted-foreground">Artists to follow</span>
                  <span className="font-mono text-xs text-faint tabular">
                    {selectedPlaylistArtists.length} of {playlistArtists.length}
                  </span>
                </div>
                <div
                  role="group"
                  aria-label="Artists to import"
                  className="max-h-60 divide-y overflow-y-auto rounded-lg border"
                >
                  {playlistArtists.map((artist) => {
                    const checkboxId = `${uid}-playlist-${artist.id}`;
                    return (
                      <label
                        key={artist.id}
                        htmlFor={checkboxId}
                        className="flex h-9 cursor-pointer items-center gap-3 px-3 text-sm transition-colors hover:bg-accent/60"
                      >
                        <Checkbox
                          id={checkboxId}
                          checked={selectedPlaylistArtists.includes(artist.id)}
                          onCheckedChange={(checked) =>
                            togglePlaylistArtist(artist.id, checked === true)
                          }
                        />
                        <span className="truncate">{artist.name}</span>
                      </label>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  onClick={handlePlaylistImport}
                  disabled={busy || selectedPlaylistArtists.length === 0}
                  className="self-start"
                >
                  Import {selectedPlaylistArtists.length}{" "}
                  {selectedPlaylistArtists.length === 1 ? "artist" : "artists"}
                </Button>
              </div>
            ) : null}
          </div>

          <Separator />

          <form className="flex flex-col gap-4" onSubmit={handleImport}>
            <Field className="gap-2">
              <FieldLabel htmlFor={`${uid}-spotify`}>Spotify artist IDs</FieldLabel>
              <textarea
                id={`${uid}-spotify`}
                value={spotifyIds}
                onChange={(e) => setSpotifyIds(e.target.value)}
                placeholder="4Z8W4fKeB5YxbusRsdQVPb"
                rows={3}
                className={textareaClass}
              />
              <FieldDescription className="text-[13px]">
                One per line, or separated by commas
              </FieldDescription>
            </Field>
            <Button type="submit" variant="outline" disabled={busy} className="self-start">
              {busy ? "Importing…" : "Import IDs"}
            </Button>
          </form>

          <Separator />

          <div className="flex flex-col gap-4">
            <SectionHeading
              title="Refresh"
              description="Scheduled checks run once a day. A refresh moves your checks to the front of the queue."
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void onPoll()}
              disabled={polling}
              className="self-start"
            >
              <RefreshCw aria-hidden="true" className={polling ? "animate-spin" : undefined} />
              {polling ? "Queueing…" : "Queue a refresh"}
            </Button>
            {lastPoll ? (
              <p className="text-[13px] leading-5 text-muted-foreground">
                Queued{" "}
                <span className="font-mono text-foreground tabular">{lastPoll.queuedJobs ?? 0}</span>{" "}
                source checks {relativeTime(lastPoll.endedAt)}
              </p>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
