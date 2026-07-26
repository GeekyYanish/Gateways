import type { AssetSpec } from "./manifest";

/**
 * Deterministic inline-SVG placeholders.
 *
 * Generated at the asset's exact intrinsic dimensions so a missing file
 * occupies precisely the box the real art will occupy — no layout shift on
 * delivery. Colour is hashed from the asset key, so the same asset is always
 * the same colour across reloads and across screens (a stable visual identity
 * while the art is pending), and different assets are visually distinct.
 *
 * These are data URIs rather than files: zero network requests, and they work
 * before /public/art exists at all.
 */

/**
 * FNV-1a, then an avalanche mix.
 *
 * Plain FNV-1a alone clusters badly for our inputs: keys that share a prefix
 * ("demo_common"/"demo_rare", "prospector"/"botanist") land on the same entry,
 * which defeats the point of colour-coding placeholders. The xorshift-multiply
 * finisher spreads those neighbours across the palette.
 */
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491);
  h ^= h >>> 13;
  h = Math.imul(h, 0x3ad3e29b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Placeholder fills, drawn from the Minecraft palette in globals.css. */
const PALETTE = [
  { bg: "#5fa73f", edge: "#3d6b28" }, // grass
  { bg: "#8b5a2b", edge: "#5c3a1a" }, // dirt
  { bg: "#7f7f7f", edge: "#565656" }, // stone
  { bg: "#a02ce0", edge: "#5f1490" }, // portal
  { bg: "#17c07b", edge: "#0d7d4e" }, // emerald
  { bg: "#3ddfe0", edge: "#1f9799" }, // diamond
  { bg: "#f2b233", edge: "#ab7614" }, // gold
  { bg: "#d63b2f", edge: "#92211a" }, // redstone
  { bg: "#9c7f4e", edge: "#6d5732" }, // planks
  { bg: "#2b1b3d", edge: "#0d0812" }, // obsidian
];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build a placeholder SVG data URI for an asset.
 * @param label Text drawn on the placeholder — normally the manifest key.
 */
export function placeholderDataUri(spec: AssetSpec, label: string): string {
  const { w, h, kind, note } = spec;
  const pal = PALETTE[hash(label) % PALETTE.length];

  // Checkerboard cell size scales with the asset so a 16px tile shows ~2 cells
  // while a 2048px map shows a readable grid rather than moiré.
  const cell = Math.max(2, Math.round(Math.min(w, h) / 8));
  const tiny = Math.min(w, h) < 40;

  // Font size that fits the box; skipped entirely on tiny sprites where any
  // text would be illegible mush.
  const fontSize = Math.max(6, Math.min(Math.round(w / Math.max(label.length, 6)), Math.round(h / 5), 28));

  const textBlock = tiny
    ? ""
    : `
    <text x="50%" y="${h / 2 - fontSize * 0.15}" fill="#ffffff" fill-opacity="0.92"
          font-family="monospace" font-size="${fontSize}" font-weight="bold"
          text-anchor="middle" dominant-baseline="middle">${escapeXml(label)}</text>
    <text x="50%" y="${h / 2 + fontSize * 1.35}" fill="#ffffff" fill-opacity="0.55"
          font-family="monospace" font-size="${Math.max(6, fontSize * 0.62)}"
          text-anchor="middle" dominant-baseline="middle">${w}×${h}${note ? " " + escapeXml(note) : ""}</text>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">
  <defs>
    <pattern id="c" width="${cell * 2}" height="${cell * 2}" patternUnits="userSpaceOnUse">
      <rect width="${cell * 2}" height="${cell * 2}" fill="${pal.bg}"/>
      <rect width="${cell}" height="${cell}" fill="${pal.edge}" fill-opacity="0.55"/>
      <rect x="${cell}" y="${cell}" width="${cell}" height="${cell}" fill="${pal.edge}" fill-opacity="0.55"/>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#c)"/>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="none"
        stroke="${pal.edge}" stroke-width="${Math.max(1, cell / 2)}"
        stroke-dasharray="${cell * 1.5} ${cell}"/>
  ${textBlock}
  ${kind === "tile" ? `<rect width="${w}" height="${h}" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="1"/>` : ""}
</svg>`;

  // encodeURIComponent rather than base64: smaller for SVG, and readable in
  // devtools when debugging which placeholder rendered.
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}

/**
 * Placeholder for a parallax SCENE LAYER.
 *
 * A flat checkerboard is useless here: with every layer looking identical you
 * cannot see whether parallax is working, nor judge depth ordering. So each
 * layer kind draws a characteristic silhouette instead —
 *   sky     → gradient wash
 *   far     → low rolling hill band
 *   mid     → taller jagged ridge
 *   fore    → chunky blocky ground with columns
 *   overlay → soft radial glow
 * — which makes layer separation obvious at a glance and lets depth values be
 * tuned before any real art arrives.
 */
export function sceneLayerPlaceholder(opts: {
  key: string;
  layer: "sky" | "far" | "mid" | "fore" | "overlay";
  w: number;
  h: number;
  tile?: boolean;
  /** [near, far] hex pair from the scene, so placeholders match its palette. */
  palette?: [string, string];
}): string {
  const { key, layer, w, h, tile } = opts;
  // Scene palette when supplied; hashed fallback only for one-off layers.
  const pal = opts.palette
    ? { bg: opts.palette[0], edge: opts.palette[1] }
    : PALETTE[hash(key) % PALETTE.length];
  const step = Math.max(8, Math.round(w / 48)); // blocky, not smooth

  // Deterministic pseudo-random from the key, so a layer looks the same on
  // every reload (a shifting silhouette would look like a rendering bug).
  let seed = hash(key);
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const blockyBand = (baseY: number, amp: number, fill: string, opacity = 1) => {
    const pts: string[] = [`0,${h}`];
    let y = baseY;
    for (let x = 0; x <= w; x += step) {
      // Step up or down by whole blocks only — this is what reads as voxel.
      y = Math.max(
        baseY - amp,
        Math.min(baseY + amp, y + (rnd() < 0.5 ? -1 : 1) * step * (rnd() < 0.3 ? 2 : 1)),
      );
      pts.push(`${x},${Math.round(y / step) * step}`);
    }
    pts.push(`${w},${h}`);
    return `<polygon points="${pts.join(" ")}" fill="${fill}" fill-opacity="${opacity}"/>`;
  };

  /**
   * Atmospheric perspective: distant bands sit lighter and hazier, near bands
   * darker and solid. Without this every silhouette is the same flat colour and
   * the stack reads as one shape rather than receding planes.
   */
  const shade = (hex: string, amount: number) => {
    const n = parseInt(hex.slice(1), 16);
    const mix = (c: number) => Math.round(c + (amount > 0 ? (255 - c) * amount : c * amount));
    return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
  };

  let body = "";
  switch (layer) {
    case "sky":
      body = `<rect width="${w}" height="${h}" fill="url(#sky)"/>`;
      break;
    case "far":
      // Lifted toward the sky colour — reads as distance.
      body = blockyBand(h * 0.62, h * 0.08, shade(pal.edge, 0.28), 0.9);
      break;
    case "mid":
      body = blockyBand(h * 0.52, h * 0.14, shade(pal.edge, 0.1), 0.95);
      break;
    case "fore":
      body =
        blockyBand(h * 0.42, h * 0.1, shade(pal.edge, -0.35), 1) +
        // Chunky columns so the nearest layer clearly moves the most.
        Array.from({ length: 6 }, (_, i) => {
          const x = (i / 6) * w + rnd() * (w / 12);
          const cw = step * 3;
          const ch = h * (0.18 + rnd() * 0.22);
          return `<rect x="${Math.round(x)}" y="${Math.round(h - ch)}" width="${cw}" height="${Math.round(ch)}" fill="${shade(pal.edge, -0.5)}"/>`;
        }).join("");
      break;
    case "overlay":
      body = `<rect width="${w}" height="${h}" fill="url(#glow)"/>`;
      break;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" shape-rendering="crispEdges">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${pal.bg}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${pal.edge}" stop-opacity="0.5"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${pal.bg}" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="${pal.bg}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${body}
  <text x="${tile ? Math.round(w / 2) : 16}" y="26" fill="#ffffff" fill-opacity="0.4"
        font-family="monospace" font-size="18"
        text-anchor="${tile ? "middle" : "start"}">${escapeXml(key)} · ${layer}</text>
</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}

/**
 * Placeholder for the world map, drawn with its location hotspots visible so
 * SCREEN 6 is genuinely explorable before any art exists.
 */
export function worldMapPlaceholder(
  w: number,
  h: number,
  spots: ReadonlyArray<{ label: string; x: number; y: number }>,
): string {
  // Marker squares only — NO text labels. The real Signpost components render
  // on top of this at the same coordinates, so drawing the names here too
  // duplicates every label on screen.
  const pins = spots
    .map((s) => {
      const cx = (s.x / 100) * w;
      const cy = (s.y / 100) * h;
      const r = Math.round(Math.min(w, h) / 70);
      return `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" fill="#8b5a2b" fill-opacity="0.85" stroke="#5c3a1a" stroke-width="${Math.max(2, r / 3)}"/>`;
    })
    .join("");

  const grid = Math.round(Math.min(w, h) / 24);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">
  <defs>
    <pattern id="g" width="${grid}" height="${grid}" patternUnits="userSpaceOnUse">
      <rect width="${grid}" height="${grid}" fill="#3d6b28"/>
      <rect width="${grid - 2}" height="${grid - 2}" fill="#5fa73f"/>
    </pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <text x="50%" y="${Math.round(h * 0.05)}" fill="#ffffff" fill-opacity="0.45" font-family="monospace"
        font-size="${Math.round(h / 44)}" text-anchor="middle">village-map.png — ${w}×${h} placeholder</text>
  ${pins}
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}`;
}
