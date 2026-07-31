#!/usr/bin/env node
/**
 * Builds the splash screen's two generated artefacts from the crest artwork:
 *
 *   1. public/art/brand/gateways-crest-pixel.png — the crest redrawn as true
 *      pixel art: downsampled to 114x114 and snapped to the project's gold ramp.
 *   2. src/frontend/lib/animation/splash-mask.ts — which cells of the assembly
 *      grid contain artwork.
 *
 *   node scripts/gen-splash-mask.mjs
 *
 * WHY A SEPARATE PIXEL ASSET: the splash assembles the crest out of flying
 * blocks, and the thing it assembles INTO has to be pixel art itself — landing
 * on the original smooth artwork undoes the whole effect. Rendering all 3040
 * art pixels as individual animated DOM nodes would put ~450KB of markup in
 * every page's HTML, so instead the pixel art is baked once and the animation
 * flies in ART_PER_TILE-square chunks of it.
 *
 * WHY PRECOMPUTE THE MASK: only ~23% of the crest is opaque, so animating every
 * grid cell would waste half of them on invisible no-ops. Sampling alpha in the
 * browser instead would gate the animation behind an image decode and a canvas
 * read, and put a failure path in front of the whole site.
 *
 * Rerun this whenever the source crest changes.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "public/art/brand/Gateways_Pixel.png");
const ART_OUT = path.join(ROOT, "public/art/brand/gateways-crest-pixel.png");
const MASK_PNG_OUT = path.join(ROOT, "public/art/brand/gateways-crest-aperture.png");
const MASK_OUT = path.join(ROOT, "src/frontend/lib/animation/splash-mask.ts");

/**
 * Pixel-art resolution. The GATEWAYS wordmark is what sets this floor: at 66 it
 * degrades into an unreadable bar, at 114 the letterforms run together, and at
 * 152 they separate cleanly. Going further (190+) reads no better at the sizes
 * we actually draw, and would force display sizes too wide for a phone — every
 * on-screen size has to be a whole multiple of this number.
 */
const ART = 152;

/**
 * Art pixels per flying block. The assembly grid is therefore ART / ART_PER_TILE
 * = 38 cells a side. Must divide ART exactly (152 = 8 x 19, so: 1, 2, 4, 8, 19,
 * 38, 76, 152) or blocks would carry fractional pixels and show seams.
 */
const ART_PER_TILE = 4;
const GRID = ART / ART_PER_TILE;

/** Below this the cell is treated as empty rather than faintly tinted. */
const ALPHA_FLOOR = 55;

/**
 * The gold ramp, straight from the @theme tokens in globals.css
 * (--color-mc-gold-light / --color-mc-gold / --color-mc-gold-dark). Snapping to
 * three steps is what makes the result read as deliberate pixel art rather than
 * a blurry downscale — the anti-aliased midtones in the source otherwise turn
 * into muddy noise at this resolution.
 */
const RAMP = [
  { name: "gold-light", rgb: [255, 209, 102] },
  { name: "gold", rgb: [242, 178, 51] },
  { name: "gold-dark", rgb: [171, 118, 20] },
];

const { data, info } = await sharp(SOURCE)
  .resize(ART, ART, { kernel: "lanczos3" })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

if (info.width !== ART || info.height !== ART) {
  throw new Error(`Expected ${ART}x${ART}, got ${info.width}x${info.height}.`);
}

// --- 1. Quantise into the pixel-art asset -----------------------------------

const out = Buffer.alloc(ART * ART * 4);
/** Per-art-pixel opacity, reused below to decide which grid cells get a block. */
const filled = new Uint8Array(ART * ART);

for (let i = 0; i < ART * ART; i++) {
  const alpha = data[i * 4 + 3];
  if (alpha < ALPHA_FLOOR) continue;

  filled[i] = 1;
  // Weight luminance by coverage so half-covered edge pixels drop to the dark
  // step instead of reading as full-strength gold.
  const lum =
    (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) *
    (alpha / 255);
  const [r, g, b] = RAMP[lum > 150 ? 0 : lum > 85 ? 1 : 2].rgb;
  out[i * 4] = r;
  out[i * 4 + 1] = g;
  out[i * 4 + 2] = b;
  out[i * 4 + 3] = 255;
}

await sharp(out, { raw: { width: ART, height: ART, channels: 4 } })
  .png({ palette: true, compressionLevel: 9 })
  .toFile(ART_OUT);

// --- 1b. The aperture silhouette --------------------------------------------

/**
 * The splash ends by zooming into the crest and revealing the page through it,
 * which needs a SOLID shape — the crest is line art, so masking with it directly
 * would open a few hairline slits instead of a window.
 *
 * Flood-fill the transparent space inward from the border: anything the fill
 * cannot reach is enclosed by the artwork, i.e. inside the crest. Union that
 * with the artwork itself and the result is a filled silhouette whose centre is
 * solid enough to cover the viewport once it scales up.
 */
const outside = new Uint8Array(ART * ART);
const queue = [];
const pushIfClear = (x, y) => {
  const i = y * ART + x;
  if (!filled[i] && !outside[i]) {
    outside[i] = 1;
    queue.push(i);
  }
};
for (let x = 0; x < ART; x++) {
  pushIfClear(x, 0);
  pushIfClear(x, ART - 1);
}
for (let y = 0; y < ART; y++) {
  pushIfClear(0, y);
  pushIfClear(ART - 1, y);
}
for (let head = 0; head < queue.length; head++) {
  const i = queue[head];
  const x = i % ART;
  const y = (i / ART) | 0;
  if (x > 0) pushIfClear(x - 1, y);
  if (x < ART - 1) pushIfClear(x + 1, y);
  if (y > 0) pushIfClear(x, y - 1);
  if (y < ART - 1) pushIfClear(x, y + 1);
}

const maskBuf = Buffer.alloc(ART * ART * 4);
let apertureCells = 0;
for (let i = 0; i < ART * ART; i++) {
  if (!filled[i] && outside[i]) continue; // genuinely outside the crest
  apertureCells++;
  // Only alpha is read by CSS masking; the colour is irrelevant.
  maskBuf[i * 4] = 255;
  maskBuf[i * 4 + 1] = 255;
  maskBuf[i * 4 + 2] = 255;
  maskBuf[i * 4 + 3] = 255;
}

await sharp(maskBuf, { raw: { width: ART, height: ART, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toFile(MASK_PNG_OUT);

// --- 2. Which grid cells carry a block --------------------------------------

const rows = [];
for (let gy = 0; gy < GRID; gy++) {
  let row = "";
  for (let gx = 0; gx < GRID; gx++) {
    row += cellHasArt(gx, gy) ? "#" : ".";
  }
  rows.push(row);
}

function cellHasArt(gx, gy) {
  for (let y = gy * ART_PER_TILE; y < (gy + 1) * ART_PER_TILE; y++) {
    for (let x = gx * ART_PER_TILE; x < (gx + 1) * ART_PER_TILE; x++) {
      if (filled[y * ART + x]) return true;
    }
  }
  return false;
}

const blocks = rows.reduce((n, row) => n + [...row].filter((c) => c === "#").length, 0);
const artPixels = filled.reduce((n, v) => n + v, 0);

const file = `/**
 * GENERATED FILE — do not edit by hand.
 * Run \`node scripts/gen-splash-mask.mjs\` to regenerate from the crest art.
 *
 * Which cells of the splash's assembly grid contain artwork.
 * '#' = a block flies in here, '.' = empty (not rendered at all).
 *
 * ${blocks} of ${GRID * GRID} cells carry a block; each one is a
 * ${ART_PER_TILE}x${ART_PER_TILE} chunk of the ${ART}x${ART} pixel-art crest
 * (${artPixels} opaque art pixels in total).
 */

/** Assembly cells per side — how many blocks fly in across the crest's width. */
export const SPLASH_GRID = ${GRID};

/** Side length of the generated pixel-art crest, in art pixels. */
export const SPLASH_ART_SIZE = ${ART};

/** Art pixels per flying block (SPLASH_ART_SIZE / SPLASH_GRID). */
export const SPLASH_ART_PER_TILE = ${ART_PER_TILE};

/** Number of blocks the splash actually animates. */
export const SPLASH_BLOCK_COUNT = ${blocks};

export const SPLASH_MASK: readonly string[] = [
${rows.map((r) => `  "${r}",`).join("\n")}
];
`;

await writeFile(MASK_OUT, file, "utf8");

console.log(`Wrote ${path.relative(ROOT, ART_OUT)} — ${ART}x${ART}, ${artPixels} art pixels.`);
console.log(
  `Wrote ${path.relative(ROOT, MASK_PNG_OUT)} — aperture silhouette, ` +
    `${Math.round((apertureCells / (ART * ART)) * 100)}% coverage.`,
);
console.log(
  `Wrote ${path.relative(ROOT, MASK_OUT)} — ${GRID}x${GRID} grid, ${blocks} blocks ` +
    `of ${ART_PER_TILE}x${ART_PER_TILE} pixels each.`,
);
