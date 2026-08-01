"use client";

import { motion } from "framer-motion";
import { cn } from "@/frontend/lib/utils";

/**
 * "YOU" — the player's live position on the 2D map.
 *
 * Positioned in PERCENTAGES like `Signpost`, and counter-scaled by the map's
 * zoom so it stays a constant size on screen.
 *
 * It deliberately does NOT look like a signpost. Signposts are places you can
 * travel to; this is you, and at a glance the two must never be confused — so
 * this one is emerald where they are dark, sits ON its coordinate rather than
 * hanging above it, and carries a pointer down to the exact spot instead of a
 * leader line. It is also the only marker that moves.
 *
 * Not interactive, and not a link — there is nowhere to go. It is exposed to
 * assistive tech as an image with a written position instead, because "where am
 * I" is a real question and the canvas behind it is `aria-hidden`.
 */
export function PlayerMarker({
  xPct,
  yPct,
  headingDeg,
  scale,
  where,
  className,
}: {
  xPct: number;
  yPct: number;
  /** Facing, in screen degrees clockwise from up — already projected. */
  headingDeg: number;
  /** Current map zoom, so the marker can cancel it out. */
  scale: number;
  /** Human-readable location, e.g. "in the Village Square". */
  where: string;
  className?: string;
}) {
  return (
    <div
      className={cn("pointer-events-none absolute z-30", className)}
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        // Anchor the pointer's TIP on the coordinate, with the chip stacked
        // above it — so the label never covers the place it is labelling.
        transform: `translate(-50%, -100%) scale(${1 / (scale || 1)})`,
        transformOrigin: "50% 100%",
      }}
      role="img"
      aria-label={`You are here, ${where}`}
    >
      <div className="flex flex-col items-center">
        {/* The label. Press Start 2P, which the design system reserves for
            headings and short labels — three characters qualifies. */}
        <div
          className={cn(
            "flex items-center gap-[4px] px-[7px] py-[5px]",
            "bg-mc-emerald text-mc-obsidian bevel border-0",
            "[--bevel-light:var(--color-mc-emerald-light)] [--bevel-dark:var(--color-mc-emerald-dark)]",
            "shadow-[0_3px_0_0_rgba(0,0,0,0.55)]",
          )}
        >
          {/* Facing arrow, rotated in SCREEN space — the caller has already put
              the world heading through the map projection, which matters
              because isometric skews direction as well as position, and the
              rotation control turns it further. */}
          <span
            aria-hidden
            className="relative block h-[12px] w-[12px]"
            style={{ transform: `rotate(${headingDeg}deg)` }}
          >
            <span
              className={cn(
                "absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2",
                "border-x-[5px] border-b-[9px] border-x-transparent border-b-mc-obsidian",
              )}
            />
          </span>
          <span className="font-pixel text-[10px] uppercase tracking-wider">You</span>
        </div>

        {/* Pointer tip, joining the chip to the exact coordinate. */}
        <span
          aria-hidden
          className={cn(
            "h-0 w-0 border-x-[7px] border-t-[9px] border-x-transparent border-t-mc-emerald",
            "drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]",
          )}
        />

        {/* Sonar ping on the spot itself. The map is dense with pins and a
            static dot does not find your eye; movement does. Framer honours the
            route group's MotionConfig, so this stops under reduced motion and
            everything above stays perfectly legible without it. */}
        <span aria-hidden className="relative block h-0 w-0">
          <motion.span
            className={cn(
              "absolute left-1/2 top-0 h-[20px] w-[20px] -translate-x-1/2 -translate-y-1/2",
              "rounded-full border-2 border-mc-emerald-light",
            )}
            initial={{ scale: 0.5, opacity: 0.8 }}
            animate={{ scale: 2.2, opacity: 0 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
          />
          <span
            className={cn(
              "absolute left-1/2 top-0 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2",
              "border-2 border-mc-void bg-mc-emerald-light",
            )}
          />
        </span>
      </div>
    </div>
  );
}
