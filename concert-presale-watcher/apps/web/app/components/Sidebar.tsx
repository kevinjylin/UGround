"use client";

import Link from "next/link";
import { Activity, Bell, Heart, LogOut, X } from "lucide-react";
import styles from "../dashboard/dashboard.module.css";

type SettingsTab = "watchlist" | "notifications";

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenSettings: (tab: SettingsTab) => void;
  onLogout: () => void;
}

export default function Sidebar({
  mobileOpen,
  onCloseMobile,
  onOpenSettings,
  onLogout,
}: SidebarProps) {
  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className={styles.sidebarBackdrop}
          aria-label="Close navigation"
          onClick={onCloseMobile}
        />
      ) : null}
      <aside
        className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}
        aria-label="Dashboard navigation"
      >
        <div className={styles.sidebarHeader}>
          <Link href="/" className={styles.brand} onClick={onCloseMobile}>
            UGround
          </Link>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.sidebarClose}`}
            aria-label="Close navigation"
            onClick={onCloseMobile}
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        <nav className={styles.sidebarNav} aria-label="Primary">
          <Link
            href="/dashboard"
            className={`${styles.sidebarItem} ${styles.sidebarItemActive}`}
            aria-current="page"
            aria-label="Feed"
            onClick={onCloseMobile}
          >
            <Activity aria-hidden="true" size={18} />
            <span className={styles.sidebarLabel}>Feed</span>
          </Link>
        </nav>

        <div className={styles.sidebarDivider} />

        <div className={styles.sidebarNav} aria-label="Quick actions">
          <button
            type="button"
            className={styles.sidebarItem}
            aria-label="Watchlist"
            onClick={() => {
              onOpenSettings("watchlist");
              onCloseMobile();
            }}
          >
            <Heart aria-hidden="true" size={18} />
            <span className={styles.sidebarLabel}>Watchlist</span>
          </button>
          <button
            type="button"
            className={styles.sidebarItem}
            aria-label="Notifications"
            onClick={() => {
              onOpenSettings("notifications");
              onCloseMobile();
            }}
          >
            <Bell aria-hidden="true" size={18} />
            <span className={styles.sidebarLabel}>Notifications</span>
          </button>
        </div>

        <div className={styles.sidebarUser}>
          <div className={styles.sidebarAvatar} aria-hidden="true">
            UG
          </div>
          <div className={styles.sidebarUserMeta}>
            <span>Studio</span>
            <small>Presale desk</small>
          </div>
          <button
            type="button"
            className={styles.sidebarLogout}
            aria-label="Log out"
            onClick={onLogout}
          >
            <LogOut aria-hidden="true" size={17} />
            <span className={styles.sidebarLabel}>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
