"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FeedFilter, FeedSort, FeedView } from "@/lib/feedQuery";

export type EventFilter = FeedFilter;
export type EventSort = FeedSort;

interface FilterOption {
  id: EventFilter;
  label: string;
  count: number;
}

export interface SourceOption {
  /** formatFeedSource() value. */
  value: string;
  label: string;
}

interface FeedToolbarProps {
  sort: EventSort;
  filters: FilterOption[];
  onSortChange: (sort: EventSort) => void;
  search: string;
  onSearchChange: (value: string) => void;
  /** formatFeedSource() value, or "" for everything. */
  source: string;
  venueSources: SourceOption[];
  areaSources: SourceOption[];
  hasArtistSource: boolean;
  onSourceChange: (value: string) => void;
  view: FeedView;
  viewCounts: Record<FeedView, number>;
  onViewChange: (view: FeedView) => void;
}

const ALL_SOURCES = "__all";

const viewLabel: Record<FeedView, string> = {
  upcoming: "Upcoming",
  past: "Past",
  hidden: "Hidden",
};

/** Lives inside the feed's <Tabs>, which owns the selected filter. */
export default function FeedToolbar({
  sort,
  filters,
  onSortChange,
  search,
  onSearchChange,
  source,
  venueSources,
  areaSources,
  hasArtistSource,
  onSourceChange,
  view,
  viewCounts,
  onViewChange,
}: FeedToolbarProps) {
  const showSourceFilter =
    venueSources.length + areaSources.length + (hasArtistSource ? 1 : 0) > 1 || source !== "";

  return (
    // Grid children default to min-width auto, which lets the tab strip push
    // the whole toolbar wider than a phone screen instead of scrolling.
    <div className="grid min-w-0 gap-3 [&>*]:min-w-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && search) {
                event.preventDefault();
                onSearchChange("");
              }
            }}
            placeholder="Search artist, venue or city"
            aria-label="Search shows by artist, venue or city"
            maxLength={100}
            className="pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
          />
          {search ? (
            <Button
              variant="ghost"
              size="icon-xs"
              className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
            >
              <X aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex">
          {showSourceFilter ? (
            <Select
              value={source || ALL_SOURCES}
              onValueChange={(value) => onSourceChange(value === ALL_SOURCES ? "" : value)}
            >
              <SelectTrigger size="sm" aria-label="Found by" className="w-full min-w-0 sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value={ALL_SOURCES}>Everything</SelectItem>
                {hasArtistSource ? <SelectItem value="artist">Artists you follow</SelectItem> : null}
                {venueSources.length > 0 ? (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Venues</SelectLabel>
                      {venueSources.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                ) : null}
                {areaSources.length > 0 ? (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Areas</SelectLabel>
                      {areaSources.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                ) : null}
              </SelectContent>
            </Select>
          ) : null}

          <Select value={view} onValueChange={(value) => onViewChange(value as FeedView)}>
            <SelectTrigger
              size="sm"
              aria-label="Which shows"
              className={showSourceFilter ? "w-full min-w-0 sm:w-36" : "col-span-2 w-full sm:w-36"}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {(Object.keys(viewLabel) as FeedView[]).map((option) => (
                <SelectItem key={option} value={option}>
                  <span>{viewLabel[option]}</span>
                  <span className="tabular font-mono text-xs text-muted-foreground">
                    {viewCounts[option]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList aria-label="Filter shows" className="h-9">
            {filters.map((option) => (
              <TabsTrigger key={option.id} value={option.id} className="gap-2 px-3">
                {option.label}
                <span className="tabular font-mono text-xs text-muted-foreground">
                  {option.count}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex items-center gap-2">
          <span id="sort-label" className="text-[13px] text-muted-foreground">
            Sort
          </span>
          <Select value={sort} onValueChange={(value) => onSortChange(value as EventSort)}>
            <SelectTrigger size="sm" aria-labelledby="sort-label" className="w-full min-w-40 sm:w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="recent_change">Recent change</SelectItem>
              <SelectItem value="date_soonest">
                {view === "past" ? "Show date, latest" : "Show date"}
              </SelectItem>
              <SelectItem value="artist_az">Artist A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
