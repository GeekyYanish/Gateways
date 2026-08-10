"use client";

import { ART } from "@/frontend/lib/assets/manifest";
import { PixelDecor } from "./pixel-decor";

/**
 * Creatures idling along the bottom of the hero, on the panorama's meadow band.
 *
 * Positioned in percentages rather than at fixed offsets so they keep their
 * spacing across the whole range of hero widths — the scene behind them is
 * tileable and has no fixed landmarks to line up with.
 *
 * The float delays are deliberately uneven. Evenly spaced offsets produce a
 * visible wave travelling along the row, which reads as one animation applied to
 * three things; prime-ish fractions of a second read as three creatures that
 * happen to be near each other.
 *
 * This sits at the DEFAULT stacking level inside the hero, under the `z-10`
 * copy wrapper — a creature drifting in front of the wordmark would be a bug,
 * and the hero's own layout and animation are untouched by this component.
 */
const CREATURES = [
  { asset: ART.mobs.pipfowl, label: "pipfowl", left: "12%", delay: 0, flip: false },
  { asset: ART.mobs.burrower, label: "burrower", left: "78%", delay: 1.3, flip: true },
  { asset: ART.mobs.glowmite, label: "glowmite", left: "34%", delay: 2.1, flip: false },
] as const;

export function MeadowCreatures() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--mc-unit)*2)] hidden h-0 md:block"
    >
      {CREATURES.map((c) => (
        <PixelDecor
          key={c.label}
          asset={c.asset}
          label={c.label}
          scale={2}
          float
          delay={c.delay}
          flip={c.flip}
          className="absolute bottom-0"
          // Percentage positioning has to be inline — the values are data here,
          // and Tailwind cannot generate a class per arbitrary percentage.
          style={{ left: c.left }}
        />
      ))}
    </div>
  );
}
