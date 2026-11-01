"use client";

import Link from "next/link";
import { Bell, ChevronsUpDown, ListMusic, LogOut, Rss, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Dot } from "@/components/status-dot";
import { relativeTime } from "@/lib/format";
import type { SourceStatus } from "@/lib/types";
import Logo from "./Logo";

type SettingsTab = "watchlist" | "notifications" | "account";

const sourceName: Record<SourceStatus["source_slug"], string> = {
  ticketmaster: "Ticketmaster",
  songkick: "Songkick",
  bandsintown: "Bandsintown",
  eventbrite: "Eventbrite",
  axs: "AXS",
  dice: "DICE",
};

interface AppSidebarProps {
  userEmail: string | null;
  watchCount: number;
  sources: SourceStatus[];
  onOpenSettings: (tab: SettingsTab) => void;
  onLogout: () => void;
}

export default function AppSidebar({
  userEmail,
  watchCount,
  sources,
  onOpenSettings,
  onLogout,
}: AppSidebarProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  const open = (tab: SettingsTab) => {
    if (isMobile) setOpenMobile(false);
    onOpenSettings(tab);
  };
  const enabledSources = sources.filter((source) => source.enabled);

  return (
    <Sidebar collapsible="offcanvas" aria-label="Dashboard navigation">
      <SidebarHeader className="h-14 justify-center px-4">
        <Link href="/" className="w-fit rounded-md" aria-label="UGround home">
          <Logo size={20} />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive className="h-9">
                  <Link href="/dashboard" aria-current="page">
                    <Rss />
                    <span>Feed</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="h-9" onClick={() => open("watchlist")}>
                  <ListMusic />
                  <span>Watchlist</span>
                </SidebarMenuButton>
                {watchCount > 0 ? (
                  <SidebarMenuBadge className="font-mono text-xs font-normal text-faint">
                    {watchCount}
                  </SidebarMenuBadge>
                ) : null}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="h-9" onClick={() => open("notifications")}>
                  <Bell />
                  <span>Notifications</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton className="h-9" onClick={() => open("account")}>
                  <Settings />
                  <span>Account</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {enabledSources.length > 0 ? (
          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="text-[13px] font-normal text-faint">
              Sources
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <ul className="grid gap-0.5">
                {enabledSources.map((source) => (
                  <li
                    key={source.source_slug}
                    className="flex h-8 items-center gap-2.5 px-2 text-[13px] text-sidebar-foreground"
                  >
                    <span className="flex size-4 items-center justify-center">
                      <Dot tone={source.stale ? "warning" : "positive"} />
                    </span>
                    <span className="truncate">{sourceName[source.source_slug]}</span>
                    <span className="ml-auto font-mono text-xs text-faint">
                      {source.last_success_at
                        ? relativeTime(source.last_success_at).replace(" ago", "")
                        : "never"}
                    </span>
                  </li>
                ))}
              </ul>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-[13px] font-medium uppercase"
                  >
                    {(userEmail ?? "U").charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {userEmail ?? "Signed in"}
                  </span>
                  <ChevronsUpDown className="text-faint" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? "top" : "right"}
                align="end"
                sideOffset={8}
                className="w-60"
              >
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                  {userEmail ?? "Signed in"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => open("account")}>
                  <Settings />
                  Account settings
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onLogout}>
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
