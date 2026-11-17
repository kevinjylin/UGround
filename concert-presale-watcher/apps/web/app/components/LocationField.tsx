"use client";

import { useMemo, useState } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_RADIUS_MILES,
  formatLocationValue,
  locationFromSuggestion,
  type LocationValue,
  parseLocationText,
  RADIUS_OPTIONS,
  searchConcertMarkets,
  US_CONCERT_MARKETS,
  US_STATE_SUGGESTIONS,
} from "@/lib/locations";
import type { LocationSuggestion } from "@/lib/types";
import AutocompleteCombobox, { type ComboboxOption } from "./AutocompleteCombobox";

const LOCATION_BY_ID = new Map<string, LocationSuggestion>(
  [...US_CONCERT_MARKETS, ...US_STATE_SUGGESTIONS].map((location) => [location.id, location]),
);

const locationToOption = (location: LocationSuggestion): ComboboxOption => ({
  id: location.id,
  label: location.label,
  description: location.kind === "state" ? "All cities" : undefined,
  kind: "location",
});

interface LocationFieldProps {
  id: string;
  label: string;
  value: LocationValue;
  /** Called once a location is settled: picked from the list, typed and left, or a new radius. */
  onChange: (next: LocationValue) => void;
  disabled?: boolean;
}

/** City or state picker, with a radius once there's a city to measure from. */
export default function LocationField({ id, label, value, onChange, disabled }: LocationFieldProps) {
  // Text being typed. Null when the field shows the saved value.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? formatLocationValue(value);
  const options = useMemo(() => searchConcertMarkets(draft ?? "").map(locationToOption), [draft]);
  const radius = value.radiusMiles ?? DEFAULT_RADIUS_MILES;
  const radiusChoices: number[] = RADIUS_OPTIONS.includes(radius as (typeof RADIUS_OPTIONS)[number])
    ? [...RADIUS_OPTIONS]
    : [...RADIUS_OPTIONS, radius].sort((a, b) => a - b);

  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    const next = parseLocationText(draft, value.radiusMiles);
    if (formatLocationValue(next) !== formatLocationValue(value) || next.country !== value.country) {
      onChange(next);
    }
  };

  const select = (option: ComboboxOption) => {
    const location = LOCATION_BY_ID.get(option.id);
    if (!location) return;
    setDraft(null);
    onChange(locationFromSuggestion(location, value.radiusMiles));
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
      <AutocompleteCombobox
        id={id}
        label={label}
        value={text}
        placeholder="Anywhere"
        disabled={disabled}
        options={options}
        emptyMessage="No match. The city you typed will be used"
        showEmptyMessage={Boolean(draft?.trim())}
        onValueChange={setDraft}
        onSelect={select}
        onCommit={commit}
      />
      {value.city ? (
        <Field className="gap-2">
          <FieldLabel id={`${id}-radius-label`}>Within</FieldLabel>
          <Select
            value={String(radius)}
            disabled={disabled}
            onValueChange={(next) => onChange({ ...value, radiusMiles: Number(next) })}
          >
            <SelectTrigger aria-labelledby={`${id}-radius-label`} className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {radiusChoices.map((miles) => (
                <SelectItem key={miles} value={String(miles)}>
                  {miles} mi
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}
    </div>
  );
}
