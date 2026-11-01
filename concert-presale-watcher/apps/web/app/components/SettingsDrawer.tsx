"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ArtistSuggestion,
  NotificationSettingsResponse,
  PollResult,
  WatchArtist,
  WatchRule,
} from "@/lib/types";
import AccountPanel from "./AccountPanel";
import NotificationSettingsPanel from "./NotificationSettingsPanel";
import WatchlistList from "./WatchlistList";
import WatchlistPanel from "./WatchlistPanel";

type SettingsTab = "watchlist" | "notifications" | "account";

const settingsTabs: { id: SettingsTab; label: string }[] = [
  { id: "watchlist", label: "Watchlist" },
  { id: "notifications", label: "Notifications" },
  { id: "account", label: "Account" },
];

const isSettingsTab = (value: string): value is SettingsTab =>
  settingsTabs.some((tab) => tab.id === value);

interface SettingsDrawerProps {
  open: boolean;
  initialTab?: SettingsTab;
  artists: WatchArtist[];
  watchRules: WatchRule[];
  busy: boolean;
  city: string;
  stateRegion: string;
  country: string;
  notificationSettings: NotificationSettingsResponse | null;
  polling: boolean;
  lastPoll: PollResult | null;
  onClose: () => void;
  onCityChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onAddArtist: (name: string, spotifyId?: string) => Promise<void>;
  onRemoveArtist: (id: string) => Promise<void>;
  onAddWatchRule: (input: Record<string, unknown>) => Promise<void>;
  onRemoveWatchRule: (id: string) => Promise<void>;
  onImportSpotify: (ids: string) => Promise<void>;
  onPreviewSpotifyPlaylist: (url: string) => Promise<ArtistSuggestion[]>;
  onImportSpotifyPlaylist: (url: string, artistIds: string[]) => Promise<void>;
  onPoll: () => Promise<void>;
  onSaveNotificationSettings: (input: {
    discordWebhook?: string | null;
    discordEnabled: boolean;
    email?: string | null;
    emailEnabled: boolean;
    phone?: string | null;
    smsEnabled: boolean;
  }) => Promise<void>;
  onTestDiscord: () => Promise<void>;
  onSendEmailConfirmation: () => Promise<void>;
  onSendSmsConfirmation: () => Promise<void>;
  onConfirmSms: (code: string) => Promise<void>;
}

const panelClass = "mt-0 min-h-0 flex-1 overflow-y-auto px-6 pt-5 pb-6";

export default function SettingsDrawer({
  open,
  initialTab,
  artists,
  watchRules,
  busy,
  city,
  stateRegion,
  country,
  notificationSettings,
  polling,
  lastPoll,
  onClose,
  onCityChange,
  onStateChange,
  onCountryChange,
  onAddArtist,
  onRemoveArtist,
  onAddWatchRule,
  onRemoveWatchRule,
  onImportSpotify,
  onPreviewSpotifyPlaylist,
  onImportSpotifyPlaylist,
  onPoll,
  onSaveNotificationSettings,
  onTestDiscord,
  onSendEmailConfirmation,
  onSendSmsConfirmation,
  onConfirmSms,
}: SettingsDrawerProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab ?? "watchlist");
  const [shownFor, setShownFor] = useState<{ open: boolean; tab?: SettingsTab }>({
    open,
    tab: initialTab,
  });

  // Each time the sheet opens (or is reopened on another section), start on the requested tab.
  if (shownFor.open !== open || shownFor.tab !== initialTab) {
    setShownFor({ open, tab: initialTab });
    if (open) setActiveTab(initialTab ?? "watchlist");
  }

  const followCount = artists.length + watchRules.filter((rule) => rule.kind !== "artist").length;

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent
        side="right"
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-[480px]"
        onEscapeKeyDown={(event) => {
          // Escape inside an open autocomplete closes the list, not the sheet.
          const target = event.target as HTMLElement | null;
          if (target?.getAttribute("role") === "combobox" && target.getAttribute("aria-expanded") === "true") {
            event.preventDefault();
          }
        }}
      >
        <SheetHeader className="gap-1 px-6 pt-5 pb-4">
          <SheetTitle className="text-base leading-6">Settings</SheetTitle>
          <SheetDescription className="sr-only">
            What you follow, where alerts go, and your account data
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            if (isSettingsTab(value)) setActiveTab(value);
          }}
          className="min-h-0 flex-1 gap-0"
        >
          <div className="border-b px-6 pb-4">
            <TabsList className="w-full">
              {settingsTabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="watchlist" className={panelClass}>
            <div className="flex flex-col gap-8">
              <WatchlistPanel
                busy={busy}
                city={city}
                stateRegion={stateRegion}
                country={country}
                onCityChange={onCityChange}
                onStateChange={onStateChange}
                onCountryChange={onCountryChange}
                onAdd={onAddArtist}
                onAddWatchRule={onAddWatchRule}
                onImportSpotify={onImportSpotify}
                onPreviewSpotifyPlaylist={onPreviewSpotifyPlaylist}
                onImportSpotifyPlaylist={onImportSpotifyPlaylist}
                onPoll={onPoll}
                polling={polling}
                lastPoll={lastPoll}
              />

              <section aria-labelledby="settings-following-heading" className="flex flex-col gap-2">
                <h3
                  id="settings-following-heading"
                  className="flex items-baseline gap-2 text-[15px] leading-6 font-medium text-foreground"
                >
                  Following
                  <span className="font-mono text-xs font-normal text-faint tabular">
                    {followCount}
                  </span>
                </h3>
                <WatchlistList
                  artists={artists}
                  rules={watchRules}
                  onRemoveArtist={onRemoveArtist}
                  onRemoveRule={onRemoveWatchRule}
                  loading={busy}
                />
              </section>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className={panelClass}>
            <NotificationSettingsPanel
              settings={notificationSettings}
              busy={busy}
              onSave={onSaveNotificationSettings}
              onTestDiscord={onTestDiscord}
              onSendEmailConfirmation={onSendEmailConfirmation}
              onSendSmsConfirmation={onSendSmsConfirmation}
              onConfirmSms={onConfirmSms}
            />
          </TabsContent>

          <TabsContent value="account" className={panelClass}>
            <AccountPanel />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
