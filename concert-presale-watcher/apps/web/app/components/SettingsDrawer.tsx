"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import type {
  NotificationSettingsResponse,
  PollResult,
  WatchArtist,
} from "../../lib/types";
import NotificationSettingsPanel from "./NotificationSettingsPanel";
import WatchlistList from "./WatchlistList";
import WatchlistPanel from "./WatchlistPanel";
import styles from "../dashboard/dashboard.module.css";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const getFocusable = (root: HTMLElement | null): HTMLElement[] => {
  if (!root) return [];

  return Array.from(root.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true",
  );
};

interface SettingsDrawerProps {
  open: boolean;
  artists: WatchArtist[];
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
  onAddArtist: (name: string) => Promise<void>;
  onRemoveArtist: (id: string) => Promise<void>;
  onImportSpotify: (ids: string) => Promise<void>;
  onPoll: (secret: string) => Promise<void>;
  onSaveNotificationSettings: (input: {
    discordWebhook?: string;
    discordEnabled: boolean;
    email?: string;
    emailEnabled: boolean;
    phone?: string;
    smsEnabled: boolean;
  }) => Promise<void>;
  onTestDiscord: () => Promise<void>;
  onSendEmailConfirmation: () => Promise<void>;
  onSendSmsConfirmation: () => Promise<void>;
  onConfirmSms: (code: string) => Promise<void>;
}

export default function SettingsDrawer({
  open,
  artists,
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
  onImportSpotify,
  onPoll,
  onSaveNotificationSettings,
  onTestDiscord,
  onSendEmailConfirmation,
  onSendSmsConfirmation,
  onConfirmSms,
}: SettingsDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      const firstFocusable = getFocusable(drawerRef.current)[0];
      (firstFocusable ?? drawerRef.current)?.focus();
    });

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, onClose]);

  const trapFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;

    const focusable = getFocusable(drawerRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      drawerRef.current?.focus();
      return;
    }

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  return (
    <div className={styles.settingsLayer}>
      <button
        type="button"
        className={styles.settingsBackdrop}
        aria-label="Close settings"
        onClick={onClose}
      />
      <aside
        ref={drawerRef}
        className={styles.settingsDrawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        tabIndex={-1}
        onKeyDown={trapFocus}
      >
        <header className={styles.drawerHeader}>
          <div>
            <p className={styles.drawerKicker}>Settings</p>
            <h2 id="settings-title">Watchlist and alerts</h2>
          </div>
          <button
            type="button"
            className={`${styles.secondaryButton} ${styles.buttonSmall}`}
            onClick={onClose}
          >
            Close
          </button>
        </header>

        <div className={styles.drawerContent}>
          <WatchlistPanel
            busy={busy}
            city={city}
            stateRegion={stateRegion}
            country={country}
            onCityChange={onCityChange}
            onStateChange={onStateChange}
            onCountryChange={onCountryChange}
            onAdd={onAddArtist}
            onImportSpotify={onImportSpotify}
            onPoll={onPoll}
            polling={polling}
            lastPoll={lastPoll}
          />

          <section className={styles.panel}>
            <h2>Followed Artists</h2>
            <WatchlistList
              artists={artists}
              onRemove={onRemoveArtist}
              loading={busy}
            />
          </section>

          <NotificationSettingsPanel
            settings={notificationSettings}
            busy={busy}
            onSave={onSaveNotificationSettings}
            onTestDiscord={onTestDiscord}
            onSendEmailConfirmation={onSendEmailConfirmation}
            onSendSmsConfirmation={onSendSmsConfirmation}
            onConfirmSms={onConfirmSms}
          />
        </div>
      </aside>
    </div>
  );
}
