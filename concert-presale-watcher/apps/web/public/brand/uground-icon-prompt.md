# UGround record + signal mark

Generated with the built-in image generation tool. `uground-icon.png` is the production master. Two open concentric grooves and a solid center connect music with discovery and alerts. The mark uses UGround's ember-orange/graphite palette.

## Research and direction

Reviewed Spotify, Bandcamp, DICE, Shazam, SoundCloud, Tidal, Apple Music, and Linear. The design uses their general principles of silhouette, spacing, and restraint, with original geometry rather than copied brand elements.

- https://newsroom.spotify.com/media-kit/logo-and-brand-assets/
- https://bandcamp.com/buttons
- https://apps.apple.com/us/app/dice-live-shows/id898358948
- https://linear.app/brand
- https://app.urlgeni.us/blog/one-deep-link-that-opens-itunes-on-ios-and-spotify-on-android

## Social card

The social preview was updated with the built-in image tool, using the existing card as an edit target and the new mark as its reference. Exported at 1200 × 630.

Use case: precise-object-edit. Image 1 is the UGround social card edit target. Image 2 is the exact new logo reference. Replace ONLY the small orange ticket symbol in the upper left of image 1 with the concentric record-and-signal logo from image 2, in the same position and same visual dimensions. Preserve the reference logo's two open rings and solid center and upper-right radial opening precisely. Match the charcoal background to the card. Preserve the existing UGround wordmark, all headline and subtitle text, layout, photo, palette, and landscape aspect ratio. No text changes or additional marks. Output the updated landscape social card.

## Exports

Run `node scripts/export-brand-icons.mjs` from `apps/web`. It exports the site icon, multi-resolution RGBA favicon (16–256 px), Apple icon, and installable app icons. The maskable version has additional safe-area padding.

## Generation prompt

Use case: logo-brand.
Design a finished, exceptionally polished professional app icon / brand symbol for UGround, a contemporary independent live-music discovery and concert-alert product. The existing website has warm charcoal #121211, ember orange #F05A28, restrained off-white typography, editorial serif headings, and a sophisticated underground live-music sensibility.
Art direction: a distinctive abstract RECORD / SIGNAL emblem, engineered with the economy and optical refinement of real established app identities. One memorable nearly circular compact silhouette formed from TWO thick nested circular arcs and a solid circular center. A single deliberately wide radial interruption at approximately two o'clock breaks both arcs, opening the rings toward the upper right, suggesting a sound escaping a record groove and an early signal. The inner circle remains whole. The two arcs share a perfectly concentric center, same bold weight, broad equal negative gaps, and precise flat radial ends. Restrained, confident, ownable, balanced; the interruption supplies one simple distinctive gesture. It must read as an abstract music/discovery symbol, not a literal letter or a power button. Prioritize a beautiful single silhouette over illustrating features.
Composition: one symbol only, dead center, occupying 72 percent of the square. 1024 x 1024 square. Solid ember-orange mark on perfectly flat warm charcoal edge-to-edge canvas. No rounded outer container baked into the artwork: platform applies its own mask.
Production treatment: immaculate vector-like geometry with smooth antialiased edges. Absolutely uniform flat fills in #F05A28 and #121211, no texture, gradients, lighting, bevel, grain, gloss, shadows, 3D. Bold shapes and openings must remain distinct at 16 to 32 pixels. No wordmark, letters, ticket outline, equalizer bars, musical-note clip art, bell, headphones, sparkles, mockup, presentation sheet, watermark. Do not reproduce any existing brand logo. This is a standalone final asset, not a concept board.

