"use client";

import { ART, type SkinId } from "@/lib/assets/manifest";
import { PixelImage } from "./pixel-image";
import { cn } from "@/lib/utils";

/**
 * Character skin bust, used in headers, leaderboard rows and toasts.
 * `full` switches to the 128×256 standing render for character creation.
 */
export function PixelAvatar({
  skinId,
  size = 40,
  full = false,
  framed = true,
  className,
  alt,
}: {
  skinId: SkinId;
  /** Rendered box in px. Kept a multiple of 8 so 64px art scales evenly. */
  size?: number;
  full?: boolean;
  framed?: boolean;
  className?: string;
  alt?: string;
}) {
  const asset = full ? ART.skinsFull[skinId] : ART.skins[skinId];

  return (
    <span
      className={cn(
        "inline-grid place-items-center overflow-hidden shrink-0",
        framed && "bg-mc-slot bevel-inset",
        className,
      )}
      style={{ width: size, height: full ? size * 2 : size }}
    >
      <PixelImage
        asset={asset}
        label={skinId}
        alt={alt ?? `${skinId} avatar`}
        className="w-full h-full object-contain"
      />
    </span>
  );
}
