"use client";

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
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
import {
  formatLocationValue,
  type LocationValue,
  RADIUS_OPTIONS,
  searchConcertMarkets,
  US_CONCERT_MARKETS,
  US_STATE_SUGGESTIONS,
} from "@/lib/locations";
import type { SpotifyAccountArtist } from "@/lib/sources/spotify";
import {
  isSpotifyConnectResult,
  SPOTIFY_RESULT_MESSAGES,
  type SpotifyConnectResult,
} from "@/lib/spotifyConnect";
import type { ArtistSuggestion, LocationSuggestion, PollResult, VenueSuggestion } from "@/lib/types";
import AutocompleteCombobox, { type ComboboxOption } from "./AutocompleteCombobox";
import LocationField from "./LocationField";

/** Most artists one import can add. */
const IMPORT_LIMIT = 50;

/** Reads `?spotify=<result>` left by the Spotify callback. Only runs in the browser. */
const readSpotifyReturn = (): SpotifyConnectResult | null => {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("spotify");
  return isSpotifyConnectResult(value) ? value : null;
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

const AREA_RADIUS_OPTIONS = RADIUS_OPTIONS.map(String);

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

function ArtistPickList({
  label,
  artists,
  selected,
  onToggle,
  detail,
  idPrefix,
}: {
  label: string;
  artists: ArtistSuggestion[];
  selected: string[];
  onToggle: (artistId: string, checked: boolean) => void;
  detail?: (artist: ArtistSuggestion) => string | null;
  idPrefix: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] text-muted-foreground">Artists to follow</span>
        <span className="font-mono text-xs text-faint tabular">
          {selected.length} of {artists.length}
        </span>
      </div>
      <div role="group" aria-label={label} className="max-h-60 divide-y overflow-y-auto rounded-lg border">
        {artists.map((artist) => {
          const checkboxId = `${idPrefix}-${artist.id}`;
          const note = detail?.(artist);
          return (
            <label
              key={artist.id}
              htmlFor={checkboxId}
              className="flex h-9 cursor-pointer items-center gap-3 px-3 text-sm transition-colors hover:bg-accent/60"
            >
              <Checkbox
                id={checkboxId}
                checked={selected.includes(artist.id)}
                onCheckedChange={(checked) => onToggle(artist.id, checked === true)}
              />
              <span className="min-w-0 flex-1 truncate">{artist.name}</span>
              {note ? <span className="shrink-0 text-xs text-muted-foreground">{note}</span> : null}
            </label>
          );
        })}
      </div>
      {selected.length > IMPORT_LIMIT ? (
        <p className="text-[13px] leading-5 text-muted-foreground">
          Pick up to {IMPORT_LIMIT} at a time.
        </p>
      ) : null}
    </div>
  );
}

const importLabel = (count: number): string => `Import ${count} ${count === 1 ? "artist" : "artists"}`;

const accountDetail = (artist: ArtistSuggestion): string | null => {
  const { followed, top } = artist as SpotifyAccountArtist;
  if (followed && top) return "Followed, top artist";
  if (followed) return "Followed";
  if (top) return "Top artist";
  return null;
};

interface WatchlistPanelProps {
  busy: boolean;
  /** Saved home location: the default for new artists and imports. */
  home: LocationValue;
  onSaveHome: (next: LocationValue) => Promise<void>;
  onAdd: (name: string, spotifyId: string | undefined, location: LocationValue) => Promise<void>;
  onAddWatchRule: (input: Record<string, unknown>) => Promise<void>;
  onImportSpotify: (ids: string, location: LocationValue) => Promise<void>;
  onPreviewSpotifyPlaylist: (url: string) => Promise<ArtistSuggestion[]>;
  onImportSpotifyPlaylist: (url: string, artistIds: string[], location: LocationValue) => Promise<void>;
  onImportSpotifyAccount: (artistIds: string[], location: LocationValue) => Promise<void>;
  onPoll: () => Promise<void>;
  polling: boolean;
  lastPoll: PollResult | null;
}

export default function WatchlistPanel({
  busy,
  home,
  onSaveHome,
  onAdd,
  onAddWatchRule,
  onImportSpotify,
  onPreviewSpotifyPlaylist,
  onImportSpotifyPlaylist,
  onImportSpotifyAccount,
  onPoll,
  polling,
  lastPoll,
}: WatchlistPanelProps) {
  const [artistName, setArtistName] = useState("");
  const [selectedArtist, setSelectedArtist] = useState<ArtistSuggestion | null>(null);
  const [artistSuggestions, setArtistSuggestions] = useState<ArtistSuggestion[]>([]);
  const [artistSearchLoading, setArtistSearchLoading] = useState(false);
  const [artistSearchError, setArtistSearchError] = useState<string | null>(null);
  const [homeError, setHomeError] = useState<string | null>(null);
  // The latest location, readable before React re-renders (e.g. Enter in the field submits the form).
  const homeRef = useRef(home);
  const [spotifyIds, setSpotifyIds] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [playlistArtists, setPlaylistArtists] = useState<ArtistSuggestion[]>([]);
  const [selectedPlaylistArtists, setSelectedPlaylistArtists] = useState<string[]>([]);
  const [playlistBusy, setPlaylistBusy] = useState(false);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [spotifyReturn] = useState(readSpotifyReturn);
  const [moreOpen, setMoreOpen] = useState(spotifyReturn !== null);
  const [accountArtists, setAccountArtists] = useState<SpotifyAccountArtist[]>([]);
  const [selectedAccountArtists, setSelectedAccountArtists] = useState<string[]>([]);
  const [accountLoading, setAccountLoading] = useState(spotifyReturn === "connected");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState<{ text: string; error: boolean } | null>(
    () =>
      spotifyReturn && spotifyReturn !== "connected"
        ? { text: SPOTIFY_RESULT_MESSAGES[spotifyReturn], error: spotifyReturn !== "denied" }
        : null,
  );
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
    homeRef.current = home;
  }, [home]);

  // Back from Spotify: drop the result from the URL, and list the account's artists.
  useEffect(() => {
    if (!spotifyReturn) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("spotify");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    if (spotifyReturn !== "connected") return;

    const controller = new AbortController();
    void fetch("/api/integrations/spotify/account-artists", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as { artists?: SpotifyAccountArtist[]; error?: string };
        if (!response.ok || body.error) throw new Error(body.error ?? SPOTIFY_RESULT_MESSAGES.error);
        const artists = body.artists ?? [];
        setAccountArtists(artists);
        setSelectedAccountArtists(
          artists.filter((artist) => artist.followed).slice(0, IMPORT_LIMIT).map((artist) => artist.id),
        );
        if (artists.length === 0) {
          setAccountMessage({ text: "No followed or top artists on that Spotify account yet.", error: false });
        }
      })
      .catch((error) => {
        if ((error as Error).name === "AbortError") return;
        setAccountMessage({ text: (error as Error).message, error: true });
      })
      .finally(() => {
        if (!controller.signal.aborted) setAccountLoading(false);
      });
    return () => controller.abort();
  }, [spotifyReturn]);

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

    await onAdd(trimmedName, selectedArtist?.id, homeRef.current);
    setArtistName("");
    setSelectedArtist(null);
    setArtistSuggestions([]);
  };

  const handleImport = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onImportSpotify(spotifyIds, homeRef.current);
    setSpotifyIds("");
  };

  const handleHomeChange = (next: LocationValue) => {
    homeRef.current = next;
    setHomeError(null);
    void onSaveHome(next).catch((error: Error) => setHomeError(error.message));
  };

  const handlePlaylistPreview = async () => {
    setPlaylistBusy(true);
    setPlaylistError(null);
    try {
      const artists = await onPreviewSpotifyPlaylist(playlistUrl);
      setPlaylistArtists(artists);
      setSelectedPlaylistArtists(artists.slice(0, IMPORT_LIMIT).map((artist) => artist.id));
    } catch (error) {
      setPlaylistError((error as Error).message);
    } finally {
      setPlaylistBusy(false);
    }
  };

  const handlePlaylistImport = async () => {
    setPlaylistBusy(true);
    setPlaylistError(null);
    try {
      await onImportSpotifyPlaylist(playlistUrl, selectedPlaylistArtists, homeRef.current);
      setPlaylistUrl("");
      setPlaylistArtists([]);
      setSelectedPlaylistArtists([]);
    } catch (error) {
      setPlaylistError((error as Error).message);
    } finally {
      setPlaylistBusy(false);
    }
  };

  const handleAccountImport = async () => {
    setAccountBusy(true);
    setAccountMessage(null);
    try {
      const count = selectedAccountArtists.length;
      await onImportSpotifyAccount(selectedAccountArtists, homeRef.current);
      setAccountArtists([]);
      setSelectedAccountArtists([]);
      setAccountMessage({
        text: `Imported ${count} ${count === 1 ? "artist" : "artists"}. The Spotify connection has been dropped.`,
        error: false,
      });
    } catch (error) {
      setAccountMessage({ text: (error as Error).message, error: true });
    } finally {
      setAccountBusy(false);
    }
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

  const togglePlaylistArtist = (artistId: string, checked: boolean) => {
    setSelectedPlaylistArtists((current) =>
      checked ? [...current, artistId] : current.filter((id) => id !== artistId),
    );
  };

  const toggleAccountArtist = (artistId: string, checked: boolean) => {
    setSelectedAccountArtists((current) =>
      checked ? [...current, artistId] : current.filter((id) => id !== artistId),
    );
  };

  const homeLabel = formatLocationValue(home);

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-col gap-4" onSubmit={handleAddArtist}>
        <SectionHeading
          title="Follow an artist"
          description="Search Spotify or type any name. Set a city to only hear about shows near it."
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
        <div className="flex flex-col gap-2">
          <LocationField
            id={`${uid}-location`}
            label="Your city or state (optional)"
            value={home}
            onChange={handleHomeChange}
            disabled={busy}
          />
          {homeError ? (
            <p role="alert" className="text-[13px] leading-5 text-destructive">
              {homeError}
            </p>
          ) : (
            <FieldDescription className="text-[13px]">
              Saved to your account. New artists and imports use it; you can change it for one
              artist under Following.
            </FieldDescription>
          )}
        </div>
        <Button type="submit" disabled={busy} className="self-start">
          {busy ? "Adding…" : "Add to watchlist"}
        </Button>
      </form>

      <Collapsible open={moreOpen} onOpenChange={setMoreOpen} className="flex flex-col">
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
              title="Import from your Spotify account"
              description="Pick from artists you follow and your top artists. UGround keeps the access for 15 minutes at most, only to finish this import."
            />
            {accountLoading ? (
              <p role="status" className="text-[13px] leading-5 text-muted-foreground">
                Loading your Spotify artists…
              </p>
            ) : accountArtists.length === 0 ? (
              <Button asChild variant="outline" className="self-start">
                <a href="/api/integrations/spotify/start">Connect Spotify</a>
              </Button>
            ) : (
              <>
                <ArtistPickList
                  label="Spotify account artists to import"
                  artists={accountArtists}
                  selected={selectedAccountArtists}
                  onToggle={toggleAccountArtist}
                  detail={accountDetail}
                  idPrefix={`${uid}-account`}
                />
                <Button
                  type="button"
                  onClick={() => void handleAccountImport()}
                  disabled={
                    busy ||
                    accountBusy ||
                    selectedAccountArtists.length === 0 ||
                    selectedAccountArtists.length > IMPORT_LIMIT
                  }
                  className="self-start"
                >
                  {accountBusy ? "Importing…" : importLabel(selectedAccountArtists.length)}
                </Button>
              </>
            )}
            {accountMessage ? (
              <p
                role={accountMessage.error ? "alert" : "status"}
                className={
                  accountMessage.error
                    ? "text-[13px] leading-5 text-destructive"
                    : "text-[13px] leading-5 text-muted-foreground"
                }
              >
                {accountMessage.text}
              </p>
            ) : null}
            {accountArtists.length > 0 ? (
              <p className="text-[13px] leading-5 text-muted-foreground">
                {homeLabel ? `Imported artists are watched near ${homeLabel}.` : "Imported artists are watched anywhere."}
              </p>
            ) : null}
          </div>

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
              onClick={() => void handlePlaylistPreview()}
              disabled={busy || playlistBusy || !playlistUrl.trim()}
              className="self-start"
            >
              Preview artists
            </Button>

            {playlistArtists.length > 0 ? (
              <>
                <ArtistPickList
                  label="Playlist artists to import"
                  artists={playlistArtists}
                  selected={selectedPlaylistArtists}
                  onToggle={togglePlaylistArtist}
                  idPrefix={`${uid}-playlist`}
                />
                <Button
                  type="button"
                  onClick={() => void handlePlaylistImport()}
                  disabled={
                    busy ||
                    playlistBusy ||
                    selectedPlaylistArtists.length === 0 ||
                    selectedPlaylistArtists.length > IMPORT_LIMIT
                  }
                  className="self-start"
                >
                  {importLabel(selectedPlaylistArtists.length)}
                </Button>
              </>
            ) : null}
            {playlistError ? (
              <p role="alert" className="text-[13px] leading-5 text-destructive">
                {playlistError}
              </p>
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
