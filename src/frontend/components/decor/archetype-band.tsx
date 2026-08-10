"use client";

import { ART, SKIN_IDS } from "@/frontend/lib/assets/manifest";
import { PixelDecor } from "./pixel-decor";

/**
 * The five character archetypes standing in a row.
 *
 * Placed above the Register CTA because that is the moment the page asks someone
 * to become one of them — showing the cast right before the ask is the argument.
 *
 * Reuses `ART.skinsFull`, which already exists for the character-creation
 * carousel. Same manifest entry, same placeholder, so when those renders land
 * they land in both places at once.
 *
 * Decorative despite depicting real, named archetypes: the names are not shown,
 * and the character picker on `/create-character` is where they are actually
 * introduced. Announcing five unlabelled figures here would tell a screen-reader
 * user nothing they can act on.
 */
export function ArchetypeBand() {
  return (
    <div
      aria-hidden
      className="pointer-events-none mb-[calc(var(--mc-unit)*2)] hidden items-end justify-center gap-[calc(var(--mc-unit)*2)] md:flex"
    >
      {SKIN_IDS.map((id, i) => (
        <PixelDecor
          key={id}
          asset={ART.skinsFull[id]}
          label={id}
          // scale={1} — intrinsic 128×256, drawn 1:1.
          //
          // NOT sized by CSS height. Constraining these to, say, 120px would be
          // a 0.47x draw, and `image-rendering: pixelated` downscaling is
          // nearest-neighbour: it discards rows and columns outright, so limbs
          // and facial features come out broken rather than merely soft. The
          // integer rule cuts both ways — 1x is the smallest legal size, so the
          // band is 256px tall on desktop and simply absent below `md`.
          scale={1}
          float
          // Staggered so the row breathes rather than pulsing as one object.
          delay={i * 0.35}
        />
      ))}
    </div>
  );
}
