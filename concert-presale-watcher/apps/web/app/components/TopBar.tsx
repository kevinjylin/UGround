"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dot } from "@/components/status-dot";
import { cn } from "@/lib/cn";

export type SourceHealth = "healthy" | "degraded" | "unknown";

interface TopBarProps {
  lastCheckedText: string;
  refreshQueued: boolean;
  busy: boolean;
  polling: boolean;
  onRefresh: () => void;
  sourceSummary: string;
  sourceHealth: SourceHealth;
}

export default function TopBar({
  lastCheckedText,
  refreshQueued,
  busy,
  polling,
  onRefresh,
  sourceSummary,
  sourceHealth,
}: TopBarProps) {
  const tone =
    sourceHealth === "healthy" ? "positive" : sourceHealth === "degraded" ? "warning" : "muted";

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 sm:px-6">
      <SidebarTrigger className="-ml-1.5 text-muted-foreground" />
      <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
      <span className="text-sm font-medium">Feed</span>

      <div className="ml-auto flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              className="hidden items-center gap-2 rounded-md text-[13px] text-muted-foreground sm:inline-flex"
            >
              <Dot tone={tone} />
              <span aria-live="polite">
                {refreshQueued ? "Refresh queued" : lastCheckedText}
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {refreshQueued
              ? "Your checks moved to the front of the queue for the next run"
              : sourceSummary}
          </TooltipContent>
        </Tooltip>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={busy || polling || refreshQueued}
        >
          <RefreshCw aria-hidden="true" className={cn(polling && "animate-spin")} />
          {polling ? "Refreshing" : refreshQueued ? "Queued" : "Refresh"}
        </Button>
      </div>
    </header>
  );
}
