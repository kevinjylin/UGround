# UGround icon

Generated with the built-in image generation tool. The PNG in this directory is the final master; app/icon.png, app/apple-icon.png, and app/favicon.ico are resized exports.

Favicon export: each embedded PNG must be RGBA (PNG color type 6), even with an opaque background. Use Sharp's `.ensureAlpha().png()` when resizing the master into ICO frames; RGB PNG frames fail Next.js image decoding.

## Initial prompt

Use case: logo-brand
Asset type: production app icon for UGround, a concert discovery and ticket-alert app.
Primary request: Create one exceptional modern icon, a distinctive chunky geometric U monogram subtly formed from an audio waveform. A single unified orange symbol, with upright sides of slightly unequal heights, a confident curved lower bowl, and one deliberate vertical notch/cut suggesting rhythm. The U must remain instantly legible. Design should feel like an independent live-music brand: confident, minimal, precise, memorable.
Scene/backdrop: solid warm near-black #121211 filling the entire square edge to edge. No outer rounded tile; the operating system will mask it.
Color palette: flat ember orange #F05A28 symbol on warm charcoal #121211, only those two colors plus edge antialiasing.
Style/medium: professional vector-like brand design, clean mathematically smooth contours, flat filled shapes, no outlines.
Composition/framing: square 1024 by 1024 icon, symbol optically centered and occupying approximately 72% of both width and height, generous balanced negative space. One icon only, front-on.
Text: no wordmark, no letters apart from the designed U symbol.
Constraints: must be recognizable at 24px. No notification dot, no underline, no green, no gradients, no 3D, no bevel, no glow, no shadow, no textures, no thin details, no musical-note clipart, no headphones, no presentation sheet, no mockup, no border, no watermark.

## Final refinement prompt

Refine this UGround app icon. Keep the warm charcoal square, ember orange color, unequal outer arm heights, thick rounded silhouette, size and placement. Remove the central upward orange prong entirely so the negative space inside is ONE wide uninterrupted U-shaped opening. The result must read unmistakably as a U, not W. The left outer arm stays taller than the right, suggesting two audio levels. Flatten the orange and charcoal fills to perfectly uniform colors #F05A28 and #121211 with clean antialiased edges. No grain, glow, gradients, shadows, border, wordmark, or extra marks. One polished minimal app icon filling a square canvas.

