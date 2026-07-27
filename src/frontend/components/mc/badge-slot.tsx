"use client";

import { badgeAsset } from "@/frontend/lib/assets/manifest";
import { PixelImage } from "./pixel-image";
import { cn } from "@/frontend/lib/utils";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

const RARITY_RING: Record<Rarity, string> = {
  common: "border-rarity-common",
  uncommon: "border-rarity-uncommon",
  rare: "border-rarity-rare",
  epic: "border-rarity-epic",
  legendary: "border-rarity-legendary",
};

const RARITY_GLOW: Record<Rarity, string> = {
  common: "",
  uncommon: "shadow-[0_0_12px_-2px_var(--color-rarity-uncommon)]",
  rare: "shadow-[0_0_14px_-2px_var(--color-rarity-rare)]",
  epic: "shadow-[0_0_16px_-2px_var(--color-rarity-epic)]",
  legendary: "shadow-[0_0_20px_-2px_var(--color-rarity-legendary)]",
};

/**
 * One achievement badge in the inventory grid (mockup SCREEN 7).
 *
 * Locked badges show `???` rather than the art, and — importantly — do not
 * leak the achievement's name or description into the DOM for secret ones,
 * since that would be trivially readable in devtools.
 */
export function BadgeSlot({
  code,
  name,
  description,
  rarity = "common",
  unlocked,
  secret,
  size = 64,
  className,
  onClick,
}: {
  code: string;
  name: string;
  description?: string;
  rarity?: Rarity;
  unlocked: boolean;
  secret?: boolean;
  size?: number;
  className?: string;
  onClick?: () => void;
}) {
  const hidden = !unlocked && secret;
  const displayName = hidden ? "Hidden achievement" : name;

  const inner = (
    <>
      <span
        className={cn(
          "grid place-items-center w-full h-full",
          !unlocked && "opacity-45 grayscale",
        )}
      >
        {hidden ? (
          <span aria-hidden className="font-pixel text-[14px] text-mc-text-dim">
            ???
          </span>
        ) : (
          <PixelImage
            asset={badgeAsset(code)}
            label={code}
            alt=""
            className="w-[78%] h-[78%] object-contain"
          />
        )}
      </span>

      {!unlocked && !hidden ? (
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center text-[16px] text-mc-text-dim/80"
        >
          🔒
        </span>
      ) : null}
    </>
  );

  const shell = cn(
    "relative grid place-items-center shrink-0",
    "bg-mc-slot bevel-inset border-[length:var(--mc-bevel)]",
    unlocked ? RARITY_RING[rarity] : "border-mc-border",
    unlocked && RARITY_GLOW[rarity],
    onClick && "cursor-pointer hover:brightness-125 transition-[filter] duration-100",
    className,
  );

  const label = unlocked
    ? `${displayName}${description ? `. ${description}` : ""}. ${rarity}, unlocked.`
    : `${displayName}. Locked.`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={displayName}
        className={shell}
        style={{ width: size, height: size }}
      >
        {inner}
      </button>
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      title={displayName}
      className={shell}
      style={{ width: size, height: size }}
    >
      {inner}
    </span>
  );
}
