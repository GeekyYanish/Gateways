"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PixelImage } from "./pixel-image";
import { ART, type ItemName } from "@/lib/assets/manifest";
import { cn } from "@/lib/utils";

/**
 * A clickable world-map location marker (mockup SCREEN 6).
 *
 * Positioned by percentage so it tracks the map at any resolution. Rendered as
 * a real <Link>, so it is keyboard-focusable, opens in a new tab on
 * middle-click, and is crawlable — a div with onClick would lose all three.
 */
export function Signpost({
  label,
  item,
  href,
  xPct,
  yPct,
  className,
  onActivate,
}: {
  label: string;
  item: ItemName;
  href: string;
  xPct: number;
  yPct: number;
  className?: string;
  onActivate?: () => void;
}) {
  return (
    <motion.div
      className={cn("absolute z-10", className)}
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        // Anchor the sign's bottom-centre at the coordinate, like a post in
        // the ground rather than a floating box.
        transform: "translate(-50%, -100%)",
      }}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <Link
        href={href}
        onClick={onActivate}
        className={cn(
          "group flex items-center gap-[calc(var(--mc-unit)*0.6)]",
          "px-[calc(var(--mc-unit)*0.9)] py-[calc(var(--mc-unit)*0.6)]",
          "bg-mc-planks border-[length:var(--mc-bevel)] border-mc-planks-dark bevel",
          "[--bevel-light:var(--color-mc-planks-light)] [--bevel-dark:var(--color-mc-planks-dark)]",
          "whitespace-nowrap no-underline",
          "transition-transform duration-100 ease-block",
          "hover:-translate-y-[3px] hover:brightness-110",
          "active:translate-y-[var(--mc-bevel)] active:bevel-pressed",
          "min-h-[40px]",
        )}
      >
        <span className="grid place-items-center w-[22px] h-[22px] shrink-0">
          <PixelImage
            asset={ART.items[item]}
            label={item}
            className="w-full h-full object-contain"
            alt=""
          />
        </span>
        <span className="font-pixel text-[10px] uppercase tracking-wide text-white drop-shadow-[2px_2px_0_rgba(0,0,0,0.6)]">
          {label}
        </span>
      </Link>

      {/* The post below the sign. Decorative only. */}
      <span
        aria-hidden
        className="block mx-auto w-[calc(var(--mc-unit)*0.75)] h-[calc(var(--mc-unit)*1.5)] bg-mc-planks-dark"
      />
    </motion.div>
  );
}
