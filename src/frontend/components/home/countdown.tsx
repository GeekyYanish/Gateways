"use client";

import { useEffect, useState } from "react";
import { cn } from "@/frontend/lib/utils";

/**
 * Countdown to the fest.
 *
 * The state starts as `null` and is only filled in an effect. That is
 * deliberate and not removable: the remaining time differs between the moment
 * the server renders and the moment the client hydrates, so computing it during
 * render would produce a guaranteed hydration mismatch on every load. Rendering
 * placeholder dashes first and the real figure one tick later is the cheap,
 * correct fix.
 *
 * The digits are `aria-hidden` and a single sr-only sentence carries the value
 * instead — a live-updating four-cell grid announced every second would make
 * the page unusable with a screen reader.
 */

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function remainingUntil(targetMs: number): Remaining | null {
  const diff = targetMs - Date.now();
  if (diff <= 0) return null;
  const seconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(seconds / 86_400),
    hours: Math.floor(seconds / 3_600) % 24,
    minutes: Math.floor(seconds / 60) % 60,
    seconds: seconds % 60,
  };
}

export interface CountdownProps {
  /** ISO date string with an explicit offset. */
  targetIso: string;
  className?: string;
}

export function Countdown({ targetIso, className }: CountdownProps) {
  const targetMs = new Date(targetIso).getTime();
  const [remaining, setRemaining] = useState<Remaining | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (Number.isNaN(targetMs)) return;

    const tick = () => {
      const next = remainingUntil(targetMs);
      setRemaining(next);
      setStarted(true);
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [targetMs]);

  // The date has passed (or was never valid) — say something useful rather than
  // showing four zeroes forever.
  if (started && !remaining) {
    return (
      <p
        className={cn(
          "pixel-shadow text-center font-pixel text-[10px] uppercase tracking-[0.16em] text-mc-gold md:text-[12px]",
          className,
        )}
      >
        The realm is open
      </p>
    );
  }

  const cells = [
    { label: "Days", value: remaining?.days },
    { label: "Hours", value: remaining?.hours },
    { label: "Minutes", value: remaining?.minutes },
    { label: "Seconds", value: remaining?.seconds },
  ];

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div
        aria-hidden
        className="grid grid-cols-2 items-stretch gap-[calc(var(--mc-unit)*0.75)] min-[280px]:grid-cols-4"
      >
        {cells.map((cell) => (
          <div
            key={cell.label}
            // Obsidian, NOT the themed mc-slot. These cells sit on the hero's
            // daylight panorama, which is the same picture in both themes, so
            // the plate behind the pale digits has to be dark in both. A themed
            // slot goes near-white in the light theme and the whole countdown
            // washes out to nothing.
            className="flex min-w-[54px] flex-col items-center gap-[calc(var(--mc-unit)*0.25)] bg-mc-obsidian/70 px-[var(--mc-unit)] py-[calc(var(--mc-unit)*0.75)] bevel-inset md:min-w-[72px]"
          >
            <span className="font-pixel text-[16px] leading-none text-mc-portal-pale md:text-[22px]">
              {cell.value === undefined
                ? "--"
                : String(cell.value).padStart(2, "0")}
            </span>
            <span className="font-pixel text-[7px] uppercase tracking-[0.12em] text-white/70 md:text-[8px]">
              {cell.label}
            </span>
          </div>
        ))}
      </div>

      {/* Not aria-live. The text changes every second, and a live region would
          interrupt the user with a new announcement every second. It is read
          when the user navigates to it, which is what is actually wanted. */}
      <p className="sr-only">
        {remaining
          ? `${remaining.days} days, ${remaining.hours} hours and ${remaining.minutes} minutes until the fest begins.`
          : "Counting down to the fest."}
      </p>
    </div>
  );
}
