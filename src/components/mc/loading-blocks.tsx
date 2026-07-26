"use client";

import { cn } from "@/lib/utils";

/**
 * Block-stacking loading indicator.
 *
 * Pure CSS animation (not Framer/GSAP) so it costs nothing and works inside
 * Suspense fallbacks, which render before client JS has necessarily hydrated.
 * The animation-delay staggering creates the "blocks dropping in" read.
 *
 * The reduced-motion rule in globals.css collapses the animation duration, so
 * this becomes a static row of blocks — still a clear "busy" affordance.
 */
export function LoadingBlocks({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center gap-[var(--mc-unit)]", className)}
    >
      <div className="flex gap-[4px]" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "block w-[12px] h-[12px] bg-mc-portal",
              "animate-[float_0.9s_ease-in-out_infinite]",
            )}
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
      <span className="font-pixel text-[10px] uppercase tracking-wide text-mc-text-dim">
        {label}
      </span>
    </div>
  );
}

/** Full-viewport variant for route-level Suspense boundaries. */
export function LoadingScreen({ label }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[50vh]">
      <LoadingBlocks label={label} />
    </div>
  );
}
