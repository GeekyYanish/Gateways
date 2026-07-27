"use client";

import { cn } from "@/frontend/lib/utils";

/**
 * A lantern on a timber post, flanking the portal at the threshold.
 *
 * Built from stacked blocks rather than a sprite: it has to sit at whatever
 * height the layout gives it and tint the ground under it, and a fixed-size
 * PNG would do neither. Every measurement is in `--mc-unit`, so it rescales
 * with the rest of the pixel UI at each `--mc-scale` breakpoint.
 *
 * The flicker is CSS (`animate-portal-pulse`), not GSAP: it is a single
 * property looping on one element with no coordination to anything else, which
 * is the component case, not the timeline case. It also means the flame keeps
 * moving if the page's JS timelines are never built.
 */
export function Lantern({
  className,
  side = "left",
}: {
  className?: string;
  /** Which way the mounting arm points, so a pair frames the portal. */
  side?: "left" | "right";
}) {
  return (
    <div
      aria-hidden
      className={cn("relative flex flex-col items-center", className)}
    >
      {/* Warm pool of light. Sits behind everything and is the reason the
          lantern reads as a light source rather than a lit object. */}
      <div
        className="pointer-events-none absolute inset-x-[-260%] top-[-16%] h-[62%] -z-10 animate-portal-pulse"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(255,196,92,0.42) 0%, rgba(242,178,51,0.16) 34%, transparent 68%)",
        }}
      />

      {/* --- head ---------------------------------------------------------- */}
      {/* Peaked cap. */}
      <div className="h-[calc(var(--mc-unit)*0.6)] w-[calc(var(--mc-unit)*2)] bg-mc-dirt-dark" />
      <div className="h-[calc(var(--mc-unit)*0.5)] w-[calc(var(--mc-unit)*3.25)] bg-mc-dirt" />
      {/* Glazed body: amber pane inside a dark frame. */}
      <div className="relative h-[calc(var(--mc-unit)*3)] w-[calc(var(--mc-unit)*2.75)] bg-mc-dirt-dark p-[calc(var(--mc-unit)*0.4)]">
        <div
          className="h-full w-full animate-portal-pulse"
          style={{
            background:
              "linear-gradient(180deg, #fefbe3 0%, #ffd166 38%, #f2b233 68%, #ab7614 100%)",
          }}
        />
      </div>
      <div className="h-[calc(var(--mc-unit)*0.5)] w-[calc(var(--mc-unit)*3.25)] bg-mc-dirt" />

      {/* --- post ---------------------------------------------------------- */}
      <div className="relative w-[calc(var(--mc-unit)*1.75)] flex-1 min-h-[calc(var(--mc-unit)*4)] bg-mc-dirt">
        {/* Lit edge faces the portal, shadowed edge faces away. */}
        <div className="absolute inset-y-0 left-0 w-[var(--mc-bevel)] bg-mc-dirt-light" />
        <div className="absolute inset-y-0 right-0 w-[var(--mc-bevel)] bg-mc-dirt-dark" />
        {/* Support arm, pointing inward toward the portal. */}
        <div
          className={cn(
            "absolute top-[8%] h-[calc(var(--mc-unit)*0.5)] w-[calc(var(--mc-unit)*1.25)] bg-mc-dirt-dark",
            side === "left" ? "left-full" : "right-full",
          )}
        />
      </div>

      {/* --- stone footing -------------------------------------------------- */}
      <div className="h-[calc(var(--mc-unit)*1)] w-[calc(var(--mc-unit)*2.75)] bg-mc-path [--bevel-dark:var(--color-mc-path-dark)] [--bevel-light:var(--color-mc-path-light)] bevel" />
      <div className="h-[calc(var(--mc-unit)*0.85)] w-[calc(var(--mc-unit)*3.75)] bg-mc-path-dark [--bevel-dark:#3f3a33] [--bevel-light:var(--color-mc-path)] bevel" />
    </div>
  );
}
