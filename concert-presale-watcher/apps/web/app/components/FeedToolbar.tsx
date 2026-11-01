"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

export type EventFilter = "all" | "onsale" | "scheduled" | "changed_today";
export type EventSort = "recent_change" | "date_soonest" | "artist_az";

interface FilterOption {
  id: EventFilter;
  label: string;
  count: number;
}

interface FeedToolbarProps {
  sort: EventSort;
  filters: FilterOption[];
  onSortChange: (sort: EventSort) => void;
}

/** Lives inside the feed's <Tabs>, which owns the selected filter. */
export default function FeedToolbar({ sort, filters, onSortChange }: FeedToolbarProps) {
  return (
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
            <SelectItem value="date_soonest">Show date</SelectItem>
            <SelectItem value="artist_az">Artist A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
