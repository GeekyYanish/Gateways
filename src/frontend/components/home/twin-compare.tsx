"use client";

import { BlockPanel, PixelImage } from "@/frontend/components/mc";
import { ART } from "@/frontend/lib/assets/manifest";

/**
 * The theme's single strongest image: one object, seen twice.
 *
 * Left is the physical thing. Right is its voxel twin. Between them runs the
 * live-data link that makes the pair a *twin* rather than a copy — the whole
 * argument of the theme compressed into one row.
 *
 * Both halves come from `ART.twins`, declared at identical intrinsic sizes, so
 * the generated placeholders already occupy the exact boxes the real art will,
 * and nothing shifts on delivery. Neither path is written here — that rule has
 * no exceptions.
 *
 * The connector stacks to a vertical arrow on narrow screens; two 256px panels
 * side by side on a 375px phone would each be unreadably small.
 */
export function TwinCompare() {
  return (
    <div className="flex flex-col items-stretch gap-[var(--mc-unit)] md:flex-row md:items-center md:justify-center">
      <TwinPanel
        asset={ART.twins.physical}
        label="Physical"
        caption="The object as it exists"
      />

      <div
        className="flex shrink-0 flex-row items-center justify-center gap-[calc(var(--mc-unit)*0.5)] py-[var(--mc-unit)] md:flex-col md:py-0"
        aria-hidden
      >
        {/* text-mc-info, matching the arrow below it — this label sits on the
            page itself, not on art, and the raw diamond block colour is ~1.5:1
            against the light theme's sky. */}
        <span className="font-pixel text-[8px] uppercase tracking-[0.16em] text-mc-info md:text-[9px]">
          Live data
        </span>
        <span className="font-pixel text-[14px] text-mc-info md:text-[18px]">
          <span className="md:hidden">▼</span>
          <span className="hidden md:inline">▶</span>
        </span>
      </div>

      <TwinPanel
        asset={ART.twins.mirrored}
        label="Digital twin"
        caption="The same object, continuously rendered"
      />
    </div>
  );
}

function TwinPanel({
  asset,
  label,
  caption,
}: {
  asset: (typeof ART.twins)[keyof typeof ART.twins];
  label: string;
  caption: string;
}) {
  return (
    <BlockPanel
      variant="slot"
      padded="sm"
      className="flex flex-1 flex-col items-center gap-[var(--mc-unit)] md:max-w-[320px]"
    >
      <PixelImage
        asset={asset}
        label={label}
        // Sized by CSS rather than an integer `scale`: the box is layout-driven
        // here, and a fixed 256px would overflow a 375px viewport.
        className="h-auto w-full max-w-[256px]"
      />
      <div className="flex flex-col items-center gap-[calc(var(--mc-unit)*0.25)] pb-[calc(var(--mc-unit)*0.5)] text-center">
        <p className="font-pixel text-[9px] uppercase tracking-[0.14em] text-mc-accent md:text-[10px]">
          {label}
        </p>
        <p className="text-[16px] leading-snug text-mc-text-dim">{caption}</p>
      </div>
    </BlockPanel>
  );
}
