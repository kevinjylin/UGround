import re

with open("concert-presale-watcher/apps/web/app/dashboard/dashboard.module.css", "r") as f:
    css = f.read()

def replace_block(pattern, replacement, text):
    new_text = re.sub(pattern, replacement, text, flags=re.MULTILINE | re.DOTALL)
    if new_text == text:
        print(f"Warning: No match found for pattern:\n{pattern}")
    return new_text

# Polish 1: Gradient Border
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
  position: relative;
  overflow: hidden;
}''', css)

css = replace_block(r'\.eventCard,\n\.listItem \{[^\}]+\}', '''.eventCard,
.listItem {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
  position: relative;
  overflow: hidden;
}''', css)

# Make sure .settingsDrawer has position: relative and overflow: hidden
# It already has position: relative and overflow: hidden according to earlier output:
# .settingsDrawer {
#   position: relative;
#   z-index: 1;
#   grid-column: 2;
#   height: 100svh;
#   min-width: 0;
#   overflow: hidden; ... }

# Add the gradient border definition at the end of the file
gradient_border_css = '''
.utilityBar::before,
.toolbar::before,
.panel::before,
.eventCard::before,
.settingsDrawer::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.4px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.45) 0%,
    rgba(255, 255, 255, 0.15) 20%,
    rgba(255, 255, 255, 0) 40%,
    rgba(255, 255, 255, 0) 60%,
    rgba(255, 255, 255, 0.15) 80%,
    rgba(255, 255, 255, 0.45) 100%
  );
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
'''
css += gradient_border_css

# Polish 2: Dashed rule under the utility bar
polish_2_css = '''
@media (min-width: 860px) {
  .utilityActions {
    border-left: 1px dashed rgba(255, 255, 255, 0.2);
    padding-left: 14px;
  }
}
'''
css += polish_2_css

# Polish 3: Decorative grid square inside the main feed panel
# We look for .eventPanel
css = replace_block(r'\.eventPanel \{[^\}]+\}', '''.eventPanel {
  min-height: 320px;
  position: relative;
  overflow: hidden;
}

.eventPanel::after {
  content: "";
  position: absolute;
  top: 18px;
  right: 18px;
  width: 140px;
  aspect-ratio: 1;
  border: 1px dashed rgba(255, 255, 255, 0.16);
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px),
    linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  background-size: 22px 22px;
  transform: rotate(7deg);
  opacity: 0.4;
  pointer-events: none;
  z-index: 0;
}
.eventPanel > * {
  position: relative;
  z-index: 1;
}''', css)

# Polish 4: Bigger feed heading
css = replace_block(r'\.panel h2, \.feedHeader h2, \.drawerHeader h2 \{[^\}]+\}', '''.panel h2, .drawerHeader h2 {
  margin: 0 0 12px;
  font-family: var(--font-instrument-serif), serif;
  font-style: italic;
  font-weight: 400;
  letter-spacing: -0.015em;
  font-size: clamp(28px, 3.2vw, 40px);
  line-height: 0.95;
  color: #fff;
}

.feedHeader h2 {
  margin: 0 0 12px;
  font-family: var(--font-instrument-serif), serif;
  font-style: italic;
  font-weight: 400;
  letter-spacing: -0.015em;
  font-size: clamp(36px, 4.5vw, 56px);
  line-height: 0.95;
  color: #fff;
}''', css)

with open("concert-presale-watcher/apps/web/app/dashboard/dashboard.module.css", "w") as f:
    f.write(css)

print("Polish applied.")
