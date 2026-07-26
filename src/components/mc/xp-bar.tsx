"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * XP / level progress bar (mockup SCREEN 7 bottom).
 *
 * Framer Motion rather than GSAP: this is a single component reacting to a
 * state change, which is exactly the boundary set in ANIMATION.md. A spring
 * makes the fill feel like it "lands" rather than sliding linearly.
 *
 * The spring animates a raw number, and width is derived via useTransform, so
 * React re-renders are not involved in the animation frames.
 */

export interface XpBarProps {
  /** XP within the current level. */
  current: number;
  /** XP needed to reach the next level. */
  required: number;
  level: number;
  title?: string;
  className?: string;
  /** Hide the numeric readout (used in the compact mobile header). */
  compact?: boolean;
}

export function XpBar({
  current,
  required,
  level,
  title,
  className,
  compact,
}: XpBarProps) {
  // Guard against a zero/negative denominator — max level has no "next".
  const pct = required > 0 ? Math.min(100, Math.max(0, (current / required) * 100)) : 100;

  return (
    <div className={cn("flex flex-col gap-[calc(var(--mc-unit)*0.5)]", className)}>
      <div className="flex items-baseline justify-between gap-[var(--mc-unit)]">
        <span className="font-pixel text-[11px] uppercase text-mc-emerald-light">
          Level {level}
          {title ? (
            <span className="text-mc-text-dim normal-case"> · {title}</span>
          ) : null}
        </span>
        {!compact ? (
          <span className="text-[15px] text-mc-text-dim tabular-nums">
            {current} / {required} XP
          </span>
        ) : null}
      </div>

      {/* role=progressbar with explicit now/min/max — a bare styled div is
          invisible to assistive tech. */}
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Level ${level} progress: ${current} of ${required} XP`}
        className="relative h-[calc(var(--mc-unit)*1.25)] w-full bg-mc-slot bevel-inset overflow-hidden"
      >
        {/* scaleX, not width.
            Framer cannot interpolate width between 0 (px) and a percentage —
            mixed units make it bail and leave the element at its initial value,
            which silently renders every bar empty. scaleX is unitless, animates
            correctly, and is GPU-composited rather than triggering layout.
            The element is full-width and scaled down from the left origin. */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: pct / 100 }}
          transition={{ type: "spring", stiffness: 90, damping: 18, mass: 0.6 }}
          style={{ transformOrigin: "left center" }}
          className={cn(
            "h-full w-full bg-mc-emerald",
            // Lighter top edge so the fill reads as a raised bar, not a flat rect.
            "shadow-[inset_0_var(--mc-bevel)_0_0_var(--color-mc-emerald-light)]",
          )}
        />
      </div>
    </div>
  );
}
