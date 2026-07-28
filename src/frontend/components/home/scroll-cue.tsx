"use client";

import { useEffect, useState } from "react";
import { cn } from "@/frontend/lib/utils";

/**
 * The "scroll" hint under the hero.
 *
 * It bobs up and down to say the page continues below the fold, and it STOPS
 * while the visitor is actually scrolling — once they are moving, the hint has
 * done its job, and a marker still waving during the gesture competes with the
 * content it was pointing at. It resumes after a short pause, so someone who
 * stops halfway still has the cue.
 *
 * Pausing is `animation-play-state`, not unmounting or restarting the
 * animation: it freezes mid-bob and continues from that exact position, where a
 * remount would make the cue visibly snap back to the top of its cycle every
 * time scrolling stopped.
 *
 * The idle timer is deliberately longer than the scroll-event gap (browsers
 * fire these ~16ms apart during a fling): 220ms is comfortably past the end of a
 * momentum scroll without feeling laggy when the user genuinely stops.
 */
const IDLE_MS = 220;

export function ScrollCue({ className }: { className?: string }) {
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    let timer = 0;

    const onScroll = () => {
      setScrolling(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setScrolling(false), IDLE_MS);
    };

    // passive: never calls preventDefault, so the browser can keep scrolling
    // on the compositor thread.
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={cn(
        "flex flex-col items-center gap-[calc(var(--mc-unit)*0.5)] animate-scroll-hint",
        scrolling && "[animation-play-state:paused]",
        className,
      )}
    >
      <span className="pixel-shadow font-pixel text-[9px] uppercase tracking-[0.24em] text-white md:text-[11px]">
        Scroll
      </span>
      {/* A blocky chevron built from two stacked bars rather than a glyph, so
          it stays on the pixel grid at every --mc-scale. */}
      <span className="flex flex-col items-center">
        <span className="block h-[calc(var(--mc-unit)*0.5)] w-[calc(var(--mc-unit)*2.5)] bg-white/90" />
        <span className="block h-[calc(var(--mc-unit)*0.5)] w-[calc(var(--mc-unit)*1.5)] bg-white/90" />
        <span className="block h-[calc(var(--mc-unit)*0.5)] w-[calc(var(--mc-unit)*0.5)] bg-white/90" />
      </span>
    </div>
  );
}
