import re

with open("concert-presale-watcher/apps/web/app/dashboard/dashboard.module.css", "r") as f:
    css = f.read()

# Helper function to replace a block using regex
def replace_block(pattern, replacement, text):
    new_text = re.sub(pattern, replacement, text, flags=re.MULTILINE | re.DOTALL)
    if new_text == text:
        print(f"Warning: No match found for pattern:\n{pattern}")
    return new_text

# 1. .dashboardPage
css = replace_block(r'\.dashboardPage \{[^\}]+\}', '''.dashboardPage {
  min-height: 100svh;
  color: #fff;
  font-family: var(--font-barlow), system-ui, sans-serif;
  font-weight: 300;
  padding: clamp(18px, 3vw, 28px);
}''', css)

# .shell
css = replace_block(r'\.shell \{[^\}]+\}', '''.shell {
  width: min(1180px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 18px;
}''', css)

# 2. .utilityBar, .toolbar, .panel
css = replace_block(r'\.utilityBar,\n\.toolbar,\n\.panel \{[^\}]+\}', '''.utilityBar,
.toolbar,
.panel {
  border: 0;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.055);
  backdrop-filter: blur(34px);
  -webkit-backdrop-filter: blur(34px);
  box-shadow:
    4px 4px 24px rgba(0, 0, 0, 0.32),
    inset 0 1px 1px rgba(255, 255, 255, 0.16);
}''', css)

# .utilityBar padding
css = replace_block(r'\.utilityBar \{[^}]+padding: 12px 14px;[^}]+\}', '''.utilityBar {
  position: sticky;
  top: 0;
  z-index: 20;
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 18px;
}''', css)

# 3. .brand
css = replace_block(r'\.brand \{[^\}]+\}', '''.brand {
  color: #fff;
  flex-shrink: 0;
  font-family: var(--font-geist-mono), monospace;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}''', css)

# 4. .utilityStats
css = replace_block(r'\.utilityStats \{[^\}]+\}', '''.utilityStats {
  color: rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  min-width: 0;
  font-size: 13px;
}''', css)

css = replace_block(r'\.utilityStats span:not\(:last-child\)::after \{[^\}]+\}', '''.utilityStats span:not(:last-child)::after {
  content: "";
  width: 3px;
  height: 3px;
  border-radius: var(--r-full);
  background: rgba(255, 255, 255, 0.34);
  margin-left: 10px;
}''', css)


# 5. .filterPill
css = replace_block(r'\.filterPill \{[^\}]+\}', '''.filterPill {
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
  border-radius: 999px;
  min-height: 36px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}''', css)

css = replace_block(r'\.filterPillActive \{[^\}]+\}', '''.filterPillActive {
  border-color: #fff;
  background: #fff;
  color: #070707;
}''', css)

css = replace_block(r'\.filterPillActive span \{[^\}]+\}', '''.filterPillActive span {
  color: rgba(7, 7, 7, 0.6);
}''', css)


# 6. .sortControl
css = replace_block(r'\.sortControl \{[^\}]+\}', '''.sortControl {
  color: rgba(255, 255, 255, 0.5);
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-family: var(--font-geist-mono), monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}''', css)


# 7. headings
# Currently: .panel h2  and .feedHeader h2  and .drawerHeader h2
css = replace_block(r'\.panel h2 \{[^\}]+\}', '''.panel h2, .feedHeader h2, .drawerHeader h2 {
  margin: 0 0 12px;
  font-family: var(--font-instrument-serif), serif;
  font-style: italic;
  font-weight: 400;
  letter-spacing: -0.015em;
  font-size: clamp(28px, 3.2vw, 40px);
  line-height: 0.95;
  color: #fff;
}''', css)

css = replace_block(r'\.feedHeader h2 \{[^\}]+\}', '''.feedHeader h2 {
  margin: 0;
}''', css)

# Remove the separate .drawerHeader h2 block completely since it's now grouped
css = replace_block(r'\n\.drawerHeader h2 \{[^\}]+\}', '', css)


# 8. .feedHeader span
css = replace_block(r'\.feedHeader span \{[^\}]+\}', '''.feedHeader span {
  color: rgba(255, 255, 255, 0.5);
  font-family: var(--font-geist-mono), monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}''', css)


# 9. .eventCard, .listItem
css = replace_block(r'\.eventCard,\n\.listItem \{[^\}]+\}', '''.eventCard,
.listItem {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
}''', css)

# 10. event typography
css = replace_block(r'\.eventArtist \{[^\}]+\}', '''.eventArtist {
  color: #fff;
  font-family: var(--font-instrument-serif), serif;
  font-style: italic;
  font-weight: 400;
  font-size: 22px;
  line-height: 1.05;
  overflow-wrap: anywhere;
}''', css)

css = replace_block(r'\.eventTitle \{[^\}]+\}', '''.eventTitle {
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  font-weight: 300;
  overflow-wrap: anywhere;
}''', css)

css = replace_block(r'\.eventMeta \{[^\}]+\}', '''.eventMeta {
  color: rgba(255, 255, 255, 0.5);
  font-family: var(--font-geist-mono), monospace;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  line-height: 1.45;
}''', css)

css = replace_block(r'\.activityLine \{[^\}]+\}', '''.activityLine {
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
}''', css)

css = replace_block(r'\.activityMuted,\n\.alertTime \{[^\}]+\}', '''.activityMuted,
.alertTime {
  color: rgba(255, 255, 255, 0.42);
}''', css)


# 11. .ticketLink
css = replace_block(r'\.ticketLink \{[^\}]+\}', '''.ticketLink {
  flex-shrink: 0;
  background: #fff;
  color: #070707;
  border: 0;
  border-radius: 999px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  white-space: nowrap;
  transition: box-shadow 220ms ease, transform 220ms ease, background 220ms ease;
}''', css)

css = replace_block(r'\.ticketLink:hover \{[^\}]+\}', '''.ticketLink:hover {
  box-shadow: 0 0 28px rgba(255, 255, 255, 0.18);
  transform: translateY(-1px);
}''', css)


# 12. .timelineToggle
css = replace_block(r'\.timelineToggle \{[^\}]+\}', '''.timelineToggle {
  width: fit-content;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-family: var(--font-geist-mono), monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: underline;
  text-underline-offset: 4px;
  cursor: pointer;
  font-weight: 700;
  padding: 2px 0;
}''', css)

# 13. .alertTimeline
css = replace_block(r'\.alertTimeline \{[^\}]+\}', '''.alertTimeline {
  border-left: 1px dashed rgba(255, 255, 255, 0.2);
  display: grid;
  gap: 8px;
  list-style: none;
  margin: 6px 0 0 6px;
  padding-left: 12px;
}''', css)


# 14. Status badges
css = replace_block(r'\.statusBadge \{[^\}]+\}', '''.statusBadge {
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  border-radius: 999px;
  padding: 3px 10px;
  font-family: var(--font-geist-mono), monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  min-height: 0;
}''', css)

css = replace_block(r'\.statusBadgeOnsale \{[^\}]+\}', '''.statusBadgeOnsale {
  border-color: rgba(111, 214, 149, 0.34);
  background: rgba(111, 214, 149, 0.1);
  color: rgba(226, 255, 235, 0.88);
}''', css)

css = replace_block(r'\.statusBadgeCancelled \{[^\}]+\}', '''.statusBadgeCancelled {
  border-color: rgba(255, 109, 109, 0.38);
  background: rgba(255, 109, 109, 0.1);
  color: rgba(255, 214, 214, 0.92);
}''', css)

css = replace_block(r'\.statusBadgePostponed \{[^\}]+\}', '''.statusBadgePostponed,
.statusBadgeRescheduled {
  border-color: rgba(244, 196, 122, 0.34);
  background: rgba(244, 196, 122, 0.1);
  color: rgba(255, 232, 188, 0.92);
}''', css)

css = replace_block(r'\.statusBadgeRescheduled \{[^\}]+\}', '', css)


css = replace_block(r'\.alertBadge \{[^\}]+\}', '''.alertBadge {
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  border-radius: 999px;
  padding: 3px 10px;
  font-family: var(--font-geist-mono), monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}''', css)

css = replace_block(r'\.alertBadgeNew \{[^\}]+\}', '''.alertBadgeNew {
  border-color: rgba(244, 196, 122, 0.34);
  background: rgba(244, 196, 122, 0.1);
  color: rgba(255, 232, 188, 0.92);
}''', css)

css = replace_block(r'\.alertBadgeStatus \{[^\}]+\}', '''.alertBadgeStatus {
  border-color: rgba(244, 196, 122, 0.34);
  background: rgba(244, 196, 122, 0.1);
  color: rgba(255, 232, 188, 0.92);
}''', css)

css = replace_block(r'\.alertBadgeTicket \{[^\}]+\}', '''.alertBadgeTicket {
  border-color: rgba(111, 214, 149, 0.34);
  background: rgba(111, 214, 149, 0.1);
  color: rgba(226, 255, 235, 0.88);
}''', css)

css = replace_block(r'\.alertBadgeUrgent \{[^\}]+\}', '''.alertBadgeUrgent {
  border-color: rgba(255, 109, 109, 0.38);
  background: rgba(255, 109, 109, 0.1);
  color: rgba(255, 214, 214, 0.92);
}''', css)


# 15. Channel chips
css = replace_block(r'\.channelChip \{[^\}]+\}', '''.channelChip {
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.6);
  border-radius: 999px;
  padding: 2px 9px;
  font-family: var(--font-geist-mono), monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}''', css)

css = replace_block(r'\.channelChipSent \{[^\}]+\}', '''.channelChipSent {
  border-color: rgba(111, 214, 149, 0.3);
  background: rgba(111, 214, 149, 0.08);
  color: rgba(226, 255, 235, 0.84);
}''', css)


css = replace_block(r'\.channelChipStored,\n\.pill \{[^\}]+\}', '''.channelChipStored,
.pill {
  border-color: rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.6);
}''', css)


# 16. Inputs
css = replace_block(r'\.dashboardPage input,\n\.dashboardPage textarea,\n\.dashboardPage select \{[^\}]+\}', '''.dashboardPage input,
.dashboardPage select {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.32);
  color: #fff;
  min-height: 46px;
  padding: 0 16px;
  font-family: inherit;
  font-weight: 300;
}

.dashboardPage textarea {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 18px;
  background: rgba(0, 0, 0, 0.32);
  color: #fff;
  min-height: 96px;
  padding: 12px 16px;
  font-family: inherit;
  font-weight: 300;
  resize: vertical;
}''', css)

css = replace_block(r'\.dashboardPage textarea \{[^\}]+\}', '', css)


css = replace_block(r'\.dashboardPage input::placeholder,\n\.dashboardPage textarea::placeholder \{[^\}]+\}', '''.dashboardPage input::placeholder,
.dashboardPage textarea::placeholder {
  color: rgba(255, 255, 255, 0.42);
}''', css)

css = replace_block(r'\.dashboardPage input:focus-visible,\n\.dashboardPage textarea:focus-visible,\n\.dashboardPage select:focus-visible \{[^\}]+\}', '''.dashboardPage input:focus-visible,
.dashboardPage textarea:focus-visible,
.dashboardPage select:focus-visible {
  border-color: rgba(255, 255, 255, 0.52);
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.12);
  outline: none;
}''', css)


# 17. Buttons
css = replace_block(r'\.primaryButton,\n\.secondaryButton,\n\.dangerButton,\n\.logoutButton \{[^\}]+\}', '''.primaryButton,
.secondaryButton,
.dangerButton,
.logoutButton {
  border-radius: 999px;
  min-height: 44px;
  padding: 0 18px;
  font-size: 13px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  text-decoration: none;
  transition: box-shadow 220ms ease, transform 220ms ease, background 220ms ease;
}''', css)

css = replace_block(r'\.primaryButton,\n\.logoutButton,\n\.utilityActions \.secondaryButton,\n\.toolbarActions \.secondaryButton \{[^\}]+\}', '''.primaryButton,
.logoutButton {
  border: 1px solid #fff;
  background: #fff;
  color: #070707;
}''', css)

css = replace_block(r'\.secondaryButton \{[^\}]+\}', '''.secondaryButton {
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}''', css)

css = replace_block(r'\.dangerButton \{[^\}]+\}', '''.dangerButton {
  border: 1px solid rgba(255, 109, 109, 0.38);
  background: rgba(255, 109, 109, 0.1);
  color: rgba(255, 214, 214, 0.92);
}''', css)

css = replace_block(r'\.primaryButton:hover,\n\.logoutButton:hover,\n\.utilityActions \.secondaryButton:hover,\n\.toolbarActions \.secondaryButton:hover \{[^\}]+\}', '''.primaryButton:hover,
.logoutButton:hover,
.secondaryButton:hover {
  box-shadow: 0 0 34px rgba(255, 255, 255, 0.16);
  transform: translateY(-1px);
}''', css)

css = replace_block(r'\.secondaryButton:hover \{[^\}]+\}', '', css)

css = replace_block(r'\.dangerButton:hover \{[^\}]+\}', '''.dangerButton:hover {
  box-shadow: 0 0 30px rgba(255, 109, 109, 0.18);
  transform: translateY(-1px);
}''', css)

# 18. .buttonSmall
css = replace_block(r'\.buttonSmall \{[^\}]+\}', '''.buttonSmall {
  min-height: 36px;
  padding: 0 14px;
  font-size: 12px;
}''', css)

# 19. .fieldsetSection
css = replace_block(r'\.fieldsetSection \{[^\}]+\}', '''.fieldsetSection {
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: 18px;
  margin-top: 14px;
  padding: 14px;
}''', css)

css = replace_block(r'\.fieldsetSection legend \{[^\}]+\}', '''.fieldsetSection legend {
  color: rgba(255, 255, 255, 0.5);
  font-family: var(--font-geist-mono), monospace;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  padding: 0 7px;
  text-transform: uppercase;
}''', css)

# 20. .helpText
css = replace_block(r'\.helpText \{[^\}]+\}', '''.helpText {
  color: rgba(255, 255, 255, 0.58);
  font-size: 14px;
  line-height: 1.5;
  margin-top: 10px;
}''', css)

# 21. .checkRow
css = replace_block(r'\.checkRow \{[^\}]+\}', '''.checkRow {
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--text-sm);
}''', css)

css = replace_block(r'\.checkRow input \{[^\}]+\}', '''.checkRow input {
  accent-color: #fff;
  height: 16px;
  min-height: auto;
  padding: 0;
  width: auto;
}''', css)


# 22. .advancedSection summary
css = replace_block(r'\.advancedSection summary \{[^\}]+\}', '''.advancedSection summary {
  color: rgba(255, 255, 255, 0.6);
  font-family: var(--font-geist-mono), monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  font-weight: 600;
}''', css)


# 23. .listItem strong, .listItem p
css = replace_block(r'\.listItem strong \{[^\}]+\}', '''.listItem strong {
  color: #fff;
  font-size: 14px;
}''', css)

css = replace_block(r'\.listItem p \{[^\}]+\}', '''.listItem p {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  line-height: 1.45;
}''', css)


# 24. .spotifyId
css = replace_block(r'\.spotifyId \{[^\}]+\}', '''.spotifyId {
  color: rgba(255, 255, 255, 0.42);
  font-family: var(--font-geist-mono), monospace;
  font-size: 11px;
}''', css)


# 25. .emptyState
css = replace_block(r'\.emptyState \{[^\}]+\}', '''.emptyState {
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: 18px;
  color: rgba(255, 255, 255, 0.55);
  display: grid;
  gap: 6px;
  padding: 36px 20px;
  text-align: center;
}''', css)

css = replace_block(r'\.emptyStateTitle \{[^\}]+\}', '''.emptyStateTitle {
  color: rgba(255, 255, 255, 0.86);
  font-family: var(--font-instrument-serif), serif;
  font-style: italic;
  font-weight: 400;
  font-size: 22px;
}''', css)

css = replace_block(r'\.emptyStateHint \{[^\}]+\}', '''.emptyStateHint {
  color: rgba(255, 255, 255, 0.55);
  font-size: 13px;
  line-height: 1.5;
  margin: 0 auto;
  max-width: 320px;
}''', css)


# 26. Drawer styles
css = replace_block(r'\.settingsDrawer \{[^\}]+\}', '''.settingsDrawer {
  position: relative;
  z-index: 1;
  grid-column: 2;
  height: 100svh;
  min-width: 0;
  overflow: hidden;
  background: rgba(15, 15, 15, 0.92);
  border-left: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(34px);
  box-shadow: -18px 0 60px rgba(0, 0, 0, 0.5);
  display: grid;
  grid-template-rows: auto 1fr;
}''', css)

css = replace_block(r'\.drawerHeader \{[^\}]+\}', '''.drawerHeader {
  border-bottom: 1px dashed rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--text-sm);
  padding: 16px;
}''', css)

css = replace_block(r'\.drawerKicker \{[^\}]+\}', '''.drawerKicker {
  color: rgba(255, 255, 255, 0.5);
  font-family: var(--font-geist-mono), "Fira Mono", monospace;
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}''', css)

css = replace_block(r'\.drawerContent \{[^\}]+\}', '''.drawerContent {
  display: grid;
  align-content: start;
  gap: 16px;
  overflow-y: auto;
  padding: 18px;
}''', css)


# 27. .errorBanner
css = replace_block(r'\.errorBanner \{[^\}]+\}', '''.errorBanner {
  border: 1px solid rgba(255, 109, 109, 0.38);
  border-radius: 18px;
  background: rgba(255, 109, 109, 0.1);
  color: rgba(255, 214, 214, 0.92);
  padding: 14px 16px;
  font-size: 14px;
}''', css)

# 28. .statPanel
css = replace_block(r'\.statAccent \{[^\}]+\}', '''.statAccent {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 8px;
  height: 8px;
  border-radius: var(--r-full);
  background: rgba(255, 255, 255, 0.7);
}''', css)

css = replace_block(r'\.skeleton \{[^\}]+\}', '''.skeleton {
  animation: shimmer 1.5s ease-in-out infinite;
  background: rgba(255, 255, 255, 0.06);
}''', css)


# Additional fixes to ensure exact properties that could be missed
css = css.replace('.timelineItem p {\n  color: var(--ink-2);', '.timelineItem p {\n  color: rgba(255, 255, 255, 0.5);')

with open("concert-presale-watcher/apps/web/app/dashboard/dashboard.module.css", "w") as f:
    f.write(css)

print("Rewriting done.")
