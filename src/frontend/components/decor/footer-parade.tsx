"use client";

import { ART } from "@/frontend/lib/assets/manifest";
import { PixelDecor } from "./pixel-decor";

/**
 * A short procession along the top edge of the footer — the last thing on the
 * page, and the one place a bit of idle wildlife costs nothing.
 *
 * Laid out in normal flow rather than absolutely, unlike the rest of the decor:
 * the footer's top edge is a real boundary and the parade should push it down a
 * little rather than overlap the contact block above it. Nothing below depends
 * on its height, so it is the one arrangement that can afford to take up space.
 */
const PARADE = [
  { asset: ART.mobs.pipfowl, label: "pipfowl", delay: 0 },
  { asset: ART.decor.flowerPot, label: "flowerPot", delay: null },
  { asset: ART.mobs.glowmite, label: "glowmite", delay: 0.9 },
  { asset: ART.mobs.stonewarden, label: "stonewarden", delay: null },
  { asset: ART.decor.sapling, label: "sapling", delay: null },
  { asset: ART.mobs.burrower, label: "burrower", delay: 1.6 },
] as const;

export function FooterParade() {
  return (
    <div
      aria-hidden
      className="pointer-events-none hidden items-end justify-center gap-[calc(var(--mc-unit)*2)] py-[var(--mc-unit)] md:flex"
    >
      {PARADE.map((p) => (
        <PixelDecor
          key={p.label}
          asset={p.asset}
          label={p.label}
          scale={2}
          // Only the creatures bob. A floating flowerpot is a physics bug, not
          // charm — the props stay planted so the movement reads as alive.
          float={p.delay !== null}
          delay={p.delay ?? 0}
        />
      ))}
    </div>
  );
}
