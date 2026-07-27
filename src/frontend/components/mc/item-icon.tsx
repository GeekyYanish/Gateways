"use client";

import type { ItemName } from "@/frontend/lib/assets/manifest";
import { cn } from "@/frontend/lib/utils";

/**
 * Original pixel glyphs for the item set.
 *
 * `<PixelImage>` is still the right component for anything that will one day be
 * a real PNG, but these are UI furniture that has to look finished NOW — a
 * signpost chip or a hotbar slot with a magenta "art pending" checkerboard in
 * it reads as broken rather than as pending. Drawn on a 16×16 grid with
 * `shapeRendering="crispEdges"`, so they are pixel art in the same sense as the
 * rest of the project and they stay sharp at any `--mc-scale`.
 *
 * All designs are original — generic tools and objects, no game's item sprites.
 */

type Glyph = { d: string; fill: string }[];

const ICONS: Record<ItemName, Glyph> = {
  // Angled pick head on a timber haft.
  pickaxe: [
    { d: "M2 3h3v2H2z M5 4h2v2H5z M9 4h2v2H9z M11 3h3v2h-3z", fill: "#9aa7b0" },
    { d: "M7 5h2v2H7z", fill: "#c3ced6" },
    { d: "M7 7h2v7H7z", fill: "#8b5a2b" },
    { d: "M7 7h1v7H7z", fill: "#a9713a" },
  ],
  // Boxy camera body with a lens and a flash.
  camera: [
    { d: "M2 5h12v8H2z", fill: "#3a4149" },
    { d: "M2 5h12v1H2z", fill: "#525b64" },
    { d: "M5 3h4v2H5z", fill: "#2b3138" },
    { d: "M6 7h4v4H6z", fill: "#1b2026" },
    { d: "M7 8h2v2H7z", fill: "#3ddfe0" },
    { d: "M11 6h2v2h-2z", fill: "#ffd166" },
  ],
  // Open book, two pages and a spine.
  book: [
    { d: "M2 3h5v10H2z M9 3h5v10H9z", fill: "#ece0f5" },
    { d: "M2 3h5v1H2z M9 3h5v1H9z", fill: "#ffffff" },
    { d: "M7 2h2v12H7z", fill: "#8b2f4a" },
    { d: "M3 5h3v1H3z M3 7h3v1H3z M10 5h3v1h-3z M10 7h3v1h-3z", fill: "#a394b5" },
  ],
  // Straight blade, crossguard, wrapped grip.
  sword: [
    { d: "M7 1h2v9H7z", fill: "#c3ced6" },
    { d: "M7 1h1v9H7z", fill: "#eef3f7" },
    { d: "M4 10h8v2H4z", fill: "#f2b233" },
    { d: "M7 12h2v3H7z", fill: "#6d5732" },
  ],
  // Ringed dial with a red north needle.
  compass: [
    { d: "M4 2h8v2H4z M2 4h2v8H2z M12 4h2v8h-2z M4 12h8v2H4z", fill: "#8b8f96" },
    { d: "M4 4h8v8H4z", fill: "#1b2026" },
    { d: "M7 5h2v3H7z", fill: "#d63b2f" },
    { d: "M7 8h2v3H7z", fill: "#ece0f5" },
  ],
  // Two-handled cup on a plinth.
  trophy: [
    { d: "M4 2h8v5H4z", fill: "#f2b233" },
    { d: "M4 2h8v1H4z", fill: "#ffd166" },
    { d: "M2 3h2v3H2z M12 3h2v3h-2z", fill: "#ab7614" },
    { d: "M6 7h4v3H6z", fill: "#ab7614" },
    { d: "M4 10h8v2H4z M3 12h10v2H3z", fill: "#f2b233" },
  ],
  // Workbench: plank top, tool grid, legs.
  craftingTable: [
    { d: "M2 3h12v3H2z", fill: "#9c7f4e" },
    { d: "M2 3h12v1H2z", fill: "#b89a63" },
    { d: "M2 6h12v6H2z", fill: "#6d5732" },
    { d: "M4 7h3v2H4z M9 7h3v2H9z M4 10h3v1H4z M9 10h3v1H9z", fill: "#3a2f1c" },
    { d: "M2 12h2v2H2z M12 12h2v2h-2z", fill: "#57462a" },
  ],
  // Banded chest with a clasp.
  chest: [
    { d: "M2 4h12v9H2z", fill: "#8b5a2b" },
    { d: "M2 4h12v3H2z", fill: "#a9713a" },
    { d: "M2 7h12v1H2z", fill: "#5c3a1a" },
    { d: "M7 6h2v4H7z", fill: "#f2b233" },
    { d: "M2 4h12v1H2z", fill: "#c08a4e" },
  ],
  // Folded parchment with a route marked on it.
  map: [
    { d: "M2 3h12v10H2z", fill: "#d9c89a" },
    { d: "M2 3h12v1H2z", fill: "#eadfb8" },
    { d: "M6 3h1v10H6z M10 3h1v10h-1z", fill: "#bfae7f" },
    { d: "M3 6h3v1H3z M8 8h4v1H8z", fill: "#8b5a2b" },
    { d: "M11 5h2v2h-2z", fill: "#d63b2f" },
  ],
  // Glowing orb in a cradle.
  warpOrb: [
    { d: "M5 3h6v2H5z M3 5h10v6H3z M5 11h6v2H5z", fill: "#5f1490" },
    { d: "M5 5h6v6H5z", fill: "#a02ce0" },
    { d: "M6 6h4v4H6z", fill: "#c964ff" },
    { d: "M7 7h2v2H7z", fill: "#f3ddfb" },
  ],
};

export function ItemIcon({
  item,
  className,
  size = 20,
}: {
  item: ItemName;
  className?: string;
  /** Rendered edge length in px. Whole numbers keep the 16-grid on pixel bounds. */
  size?: number;
}) {
  const glyph = ICONS[item];
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      {glyph.map((part, i) => (
        <path key={i} d={part.d} fill={part.fill} />
      ))}
    </svg>
  );
}
