import { Buffer } from "node:buffer";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const master = path.join(root, "public/brand/uground-icon.png");
const background = "#121211";

await mkdir(path.join(root, "public/icons"), { recursive: true });
for (const [destination, size] of [
  ["app/icon.png", 512],
  ["app/apple-icon.png", 180],
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
]) {
  await sharp(master).resize(size, size).ensureAlpha().png()
    .toFile(path.join(root, destination));
}

// Keep the mark within the central safe circle when an OS applies its mask.
await sharp(master).resize(352, 352)
  .extend({ top: 80, bottom: 80, left: 80, right: 80, background })
  .ensureAlpha().png().toFile(path.join(root, "public/icons/icon-maskable-512.png"));

// PNG-backed ICO frames must retain RGBA for Next.js image decoding.
const sizes = [16, 32, 48, 64, 128, 256];
const frames = await Promise.all(sizes.map((size) =>
  sharp(master).resize(size, size).ensureAlpha().png().toBuffer()
));
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
frames.forEach((frame, index) => {
  const entry = 6 + index * 16;
  directory[entry] = sizes[index] === 256 ? 0 : sizes[index];
  directory[entry + 1] = directory[entry];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(frame.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
});
await writeFile(path.join(root, "app/favicon.ico"), Buffer.concat([directory, ...frames]));
console.log("Exported UGround logo, favicon, Apple, and installable app icons.");
