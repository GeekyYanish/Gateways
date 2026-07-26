"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The inventory frame — container for every dialog, card and section.
 *
 * Deliberately not a 9-slice border-image: that requires the art file to exist,
 * and it does not yet. Instead the frame is pure CSS (a bevelled border built
 * from the palette), which means it works today, scales with --mc-scale, and
 * needs no asset at all. When ui/panel.png arrives it can be layered on as a
 * texture via <BlockTexture> without changing any consumer.
 */
const blockPanel = cva(
  ["relative", "border-solid", "border-mc-border"],
  {
    variants: {
      variant: {
        // The standard dark inventory panel from the mockup.
        panel: "bg-mc-panel [--bevel-light:var(--color-mc-panel-light)] [--bevel-dark:var(--color-mc-panel-dark)] bevel",
        // Recessed area — item slots, text fields, list wells.
        slot: "bg-mc-slot bevel-inset",
        // Raised stone block, for headers and toolbars.
        stone: "bg-mc-stone [--bevel-light:var(--color-mc-stone-light)] [--bevel-dark:var(--color-mc-stone-dark)] bevel",
        // Highlight panel for achievements/announcements.
        gold: "bg-mc-panel border-mc-gold [--bevel-light:var(--color-mc-gold)] [--bevel-dark:var(--color-mc-gold-dark)] bevel",
        portal: "bg-mc-obsidian border-mc-portal [--bevel-light:var(--color-mc-portal-light)] [--bevel-dark:var(--color-mc-portal-dark)] bevel",
        ghost: "bg-transparent border-transparent",
      },
      padded: {
        none: "p-0",
        sm: "p-[calc(var(--mc-unit)*1)]",
        md: "p-[calc(var(--mc-unit)*1.5)]",
        lg: "p-[calc(var(--mc-unit)*2.5)]",
      },
    },
    defaultVariants: { variant: "panel", padded: "md" },
  },
);

export interface BlockPanelProps
  // `title` is omitted because HTMLAttributes types it as the tooltip string,
  // while ours is a rendered header node.
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof blockPanel> {
  /** Optional pixel-font header rendered as a bevelled strip. */
  title?: React.ReactNode;
  /** Right-aligned content in the header strip. */
  action?: React.ReactNode;
}

export function BlockPanel({
  className,
  variant,
  padded,
  title,
  action,
  children,
  ...props
}: BlockPanelProps) {
  return (
    <div
      className={cn(
        blockPanel({ variant, padded: title ? "none" : padded }),
        "border-[length:var(--mc-bevel)]",
        className,
      )}
      {...props}
    >
      {title ? (
        <>
          <div
            className={cn(
              "flex items-center justify-between gap-[var(--mc-unit)]",
              "px-[calc(var(--mc-unit)*1.5)] py-[var(--mc-unit)]",
              "border-b-[length:var(--mc-bevel)] border-mc-border",
              "bg-mc-panel-dark",
            )}
          >
            <h2 className="font-pixel text-[12px] uppercase tracking-wider text-mc-text">
              {title}
            </h2>
            {action}
          </div>
          <div className={cn(blockPanel({ variant: "ghost", padded: padded ?? "md" }))}>
            {children}
          </div>
        </>
      ) : (
        children
      )}
    </div>
  );
}

export { blockPanel };
