"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ItemIcon } from "./item-icon";
import type { ItemName } from "@/lib/assets/manifest";
import { cn } from "@/lib/utils";

/**
 * A clickable world-map location marker.
 *
 * Rendered as a real `<Link>`, so it is keyboard-focusable, opens in a new tab
 * on middle-click, and is crawlable — a div with onClick would lose all three.
 * `onSelect` runs alongside navigation for the map's own selection state; it
 * does not replace the href.
 *
 * Positioned by percentage so it tracks the map through pan and zoom without
 * the viewport having to do per-child maths.
 *
 * The chip **counter-scales** with the map. Without that, zooming to 2.5×
 * inflates the label to the size of a building and the map disappears behind
 * its own furniture; labels are UI, and UI should hold its size while the
 * terrain under it grows.
 */
export function Signpost({
  label,
  item,
  href,
  xPct,
  yPct,
  className,
  onActivate,
  onSelect,
  onHover,
  selected = false,
  dimmed = false,
  scale = 1,
  lift = 18,
  dx = 0,
  compact = false,
}: {
  label: string;
  item: ItemName;
  href: string;
  xPct: number;
  yPct: number;
  className?: string;
  onActivate?: () => void;
  /** Fired on click and on focus, before navigation. */
  onSelect?: () => void;
  onHover?: (hovering: boolean) => void;
  selected?: boolean;
  /** Another marker is selected — recede so the chosen one reads. */
  dimmed?: boolean;
  /** Current map scale, so the chip can cancel it out. */
  scale?: number;
  /**
   * Screen px between the anchor point and the chip. The caller raises this to
   * separate labels that would otherwise overlap; the leader line stretches to
   * match, so a displaced chip still visibly belongs to its building.
   */
  lift?: number;
  /**
   * Sideways offset for the chip, in screen px. Applied to the chip ALONE — the
   * leader line stays directly over the building, so a jogged label still reads
   * as belonging to it.
   */
  dx?: number;
  /**
   * Icon-only pin, no text. For narrow viewports: the chips hold a constant
   * on-screen size, so seven ~200px labels simply do not fit across 390px and
   * end up stacked on top of one another and clipped by the frame. The name
   * still reaches assistive tech through `aria-label`, and the detail card
   * shows it once a pin is chosen.
   */
  compact?: boolean;
}) {
  return (
    /**
     * TWO elements, and the split is load-bearing. Framer Motion owns
     * `transform` on whatever it animates — the `y` below compiles to a
     * transform, so a `style={{ transform }}` on the same element is silently
     * overwritten the moment the entrance tween runs. Putting the layout
     * transform on a plain outer div and the animated one inside keeps each
     * system to its own element, per the project's one-owner-per-property rule.
     */
    <div
      className={cn("absolute z-10", className)}
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        // Anchor the chip's bottom-centre at the coordinate, and undo the map's
        // zoom so the label keeps a constant on-screen size.
        transform: `translate(-50%, -100%) scale(${1 / scale})`,
        transformOrigin: "50% 100%",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: dimmed ? 0.45 : 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div
          className="flex justify-center"
          style={dx ? { transform: `translateX(${dx}px)` } : undefined}
        >
          <Link
            href={href}
            aria-label={compact ? label : undefined}
            title={compact ? label : undefined}
            onClick={(e) => {
              // Plain left-click selects on the map instead of leaving it. Modified
              // clicks and middle-clicks fall through to the browser so "open in
              // new tab" still works.
              if (
                onSelect &&
                !e.metaKey &&
                !e.ctrlKey &&
                !e.shiftKey &&
                e.button === 0
              ) {
                e.preventDefault();
                onSelect();
                return;
              }
              onActivate?.();
            }}
            onFocus={() => onSelect?.()}
            onPointerEnter={() => onHover?.(true)}
            onPointerLeave={() => onHover?.(false)}
            className={cn(
              "group flex items-center justify-center gap-[calc(var(--mc-unit)*0.7)]",
              compact
                ? "h-[38px] w-[38px] p-0"
                : "px-[calc(var(--mc-unit)*1)] py-[calc(var(--mc-unit)*0.6)]",
              "rounded-[6px] border-2 no-underline whitespace-nowrap",
              "bg-mc-void/92 shadow-[0_4px_0_0_rgba(0,0,0,0.55)]",
              "transition-[transform,border-color,filter] duration-100 ease-block",
              "hover:-translate-y-[3px] hover:brightness-125",
              "active:translate-y-0",
              "min-h-[38px]",
              selected
                ? "border-mc-gold shadow-[0_0_0_2px_rgba(242,178,51,0.35),0_4px_0_0_rgba(0,0,0,0.55)]"
                : "border-mc-border hover:border-mc-gold-light",
            )}
          >
            <ItemIcon item={item} size={20} />
            {compact ? null : (
              <span
                className={cn(
                  "font-pixel text-[10px] uppercase tracking-wide",
                  "drop-shadow-[2px_2px_0_rgba(0,0,0,0.75)]",
                  selected ? "text-mc-gold-light" : "text-white",
                )}
              >
                {label}
              </span>
            )}
          </Link>
        </div>

        {/* Leader line down to the building, so the chip reads as pinned to a
          place rather than floating over one. Its height is what absorbs the
          de-overlap offset. Decorative. */}
        <span
          aria-hidden
          className={cn(
            "mx-auto block w-[2px]",
            selected ? "bg-mc-gold" : "bg-mc-border",
          )}
          style={{ height: Math.max(6, lift) }}
        />
        <span
          aria-hidden
          className={cn(
            "mx-auto block h-[6px] w-[6px] rotate-45",
            selected ? "bg-mc-gold" : "bg-mc-border",
          )}
        />
      </motion.div>
    </div>
  );
}
