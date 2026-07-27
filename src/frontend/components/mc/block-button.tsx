"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/frontend/lib/utils";

/**
 * The single button primitive for the whole app.
 *
 * The 3D block look comes from the `bevel` utility (two inset edges + a drop),
 * driven by the --bevel-light / --bevel-dark custom properties each variant
 * sets. On :active the element translates down by the bevel width and swaps to
 * `bevel-pressed`, so it physically depresses like a Minecraft button.
 *
 * Hover/press feedback is pure CSS rather than Framer Motion: it must respond
 * on the very first paint, and a spring on a 40ms press reads as mush.
 */
const blockButton = cva(
  [
    "relative inline-flex items-center justify-center gap-[calc(var(--mc-unit)*0.5)]",
    "font-pixel uppercase tracking-wider text-center",
    "border-0 select-none cursor-pointer",
    "transition-[transform,filter] duration-75 ease-block",
    "bevel",
    // The press: shift down by exactly the bevel width so the drop shadow
    // disappears under the button rather than the edges sliding.
    "active:translate-y-[var(--mc-bevel)] active:bevel-pressed",
    "hover:brightness-110",
    "disabled:cursor-not-allowed disabled:brightness-50 disabled:saturate-50",
    "disabled:active:translate-y-0 disabled:active:bevel",
    "focus-visible:z-10",
  ],
  {
    variants: {
      variant: {
        primary: "bg-mc-portal text-white [--bevel-light:var(--color-mc-portal-light)] [--bevel-dark:var(--color-mc-portal-dark)]",
        // Deep violet. `primary` is the bright brand purple, which blows out
        // against the landing page's daylight sky — this is the same hue two
        // stops down, so white type on it actually holds contrast outdoors.
        portal: "bg-mc-portal-deep text-white [--bevel-light:var(--color-mc-portal)] [--bevel-dark:var(--color-mc-portal-ink)]",
        emerald: "bg-mc-emerald text-mc-obsidian [--bevel-light:var(--color-mc-emerald-light)] [--bevel-dark:var(--color-mc-emerald-dark)]",
        stone: "bg-mc-stone text-white [--bevel-light:var(--color-mc-stone-light)] [--bevel-dark:var(--color-mc-stone-dark)]",
        gold: "bg-mc-gold text-mc-obsidian [--bevel-light:var(--color-mc-gold-light)] [--bevel-dark:var(--color-mc-gold-dark)]",
        danger: "bg-mc-redstone text-white [--bevel-light:var(--color-mc-redstone-light)] [--bevel-dark:var(--color-mc-redstone-dark)]",
        dirt: "bg-mc-planks text-white [--bevel-light:var(--color-mc-planks-light)] [--bevel-dark:var(--color-mc-planks-dark)]",
        ghost: "bg-mc-panel text-mc-text [--bevel-light:var(--color-mc-panel-light)] [--bevel-dark:var(--color-mc-panel-dark)]",
      },
      size: {
        // Font sizes are integer px so Press Start 2P glyphs land on whole
        // pixels. Min-heights clear 44px on mobile for touch targets.
        sm: "text-[10px] px-[calc(var(--mc-unit)*1.5)] py-[calc(var(--mc-unit)*0.75)] min-h-[36px]",
        md: "text-[12px] px-[calc(var(--mc-unit)*2)] py-[calc(var(--mc-unit)*1)] min-h-[44px]",
        lg: "text-[14px] px-[calc(var(--mc-unit)*3)] py-[calc(var(--mc-unit)*1.5)] min-h-[52px]",
        xl: "text-[16px] px-[calc(var(--mc-unit)*4)] py-[calc(var(--mc-unit)*2)] min-h-[60px]",
        icon: "text-[12px] w-[44px] h-[44px] p-0",
      },
      block: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export interface BlockButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof blockButton> {
  /** Renders a loading state and blocks interaction. */
  loading?: boolean;
}

export const BlockButton = forwardRef<HTMLButtonElement, BlockButtonProps>(
  function BlockButton(
    { className, variant, size, block, loading, disabled, children, ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={props.type ?? "button"}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(blockButton({ variant, size, block }), className)}
        {...props}
      >
        {loading ? (
          <>
            {/* aria-hidden: the label below carries the meaning for AT. */}
            <span aria-hidden className="animate-pulse">
              ▖▘▝▗
            </span>
            <span className="sr-only">Loading</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

export { blockButton };
