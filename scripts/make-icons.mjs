// Draws the app icons (a white check mark on a blue rounded square) and saves
// them as PNG files, with no image libraries: each pixel's color is computed
// from simple geometry, then written using Node's built-in zlib.
//
// Run: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";

const BLUE = [59, 91, 219]; // matches --accent in app/globals.css
const WHITE = [255, 255, 255];

/** Distance from point p to the line segment a–b. */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Is (x, y) inside a rounded square from 0 to 1 with corner radius r? */
function inRoundedSquare(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

/**
 * Color of a point in the icon, in 0–1 coordinates.
 * `fullBleed`: maskable icons fill the whole square (the OS rounds the corners)
 * and keep the check mark inside the central "safe zone".
 */
function colorAt(x, y, fullBleed) {
  const inBackground = fullBleed || inRoundedSquare(x, y, 0.22);
  if (!inBackground) return null; // transparent
  // Shrink the check mark toward the center for maskable icons.
  const s = fullBleed ? 0.75 : 1;
  const ux = (x - 0.5) / s + 0.5, uy = (y - 0.5) / s + 0.5;
  const check = [[0.27, 0.52], [0.43, 0.68], [0.74, 0.34]];
  const d = Math.min(
    distToSegment(ux, uy, ...check[0], ...check[1]),
    distToSegment(ux, uy, ...check[1], ...check[2]),
  );
  return d < 0.065 ? WHITE : BLUE;
}

function renderPng(size, fullBleed) {
  const SAMPLES = 4; // 4×4 samples per pixel smooths the edges (anti-aliasing)
  const rows = [];
  for (let py = 0; py < size; py++) {
    const row = Buffer.alloc(1 + size * 4); // first byte: PNG filter type 0 (none)
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const c = colorAt((px + (sx + 0.5) / SAMPLES) / size, (py + (sy + 0.5) / SAMPLES) / size, fullBleed);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a += 1; }
        }
      }
      const n = SAMPLES * SAMPLES;
      const o = 1 + px * 4;
      if (a > 0) { row[o] = r / a; row[o + 1] = g / a; row[o + 2] = b / a; }
      row[o + 3] = Math.round((a / n) * 255);
    }
    rows.push(row);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", renderPng(192, false));
writeFileSync("public/icons/icon-512.png", renderPng(512, false));
writeFileSync("public/icons/maskable-512.png", renderPng(512, true));
// iOS home-screen icon: iOS rounds corners itself, so use the full-bleed version.
writeFileSync("app/apple-icon.png", renderPng(180, true));
writeFileSync("app/icon.png", renderPng(64, false)); // browser tab icon
console.log("Icons written.");
