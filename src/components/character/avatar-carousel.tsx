"use client";

import { useCallback, useEffect, useRef } from "react";
import { gsap, useGSAP } from "@/lib/animation/gsap-init";
import { PixelImage } from "@/components/mc";
import { ART } from "@/lib/assets/manifest";
import type { SkinId } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const SKINS: SkinId[] = ["prospector", "botanist", "sentinel", "voidwalker", "artificer"];

const SKIN_LABELS: Record<SkinId, string> = {
  prospector: "Prospector",
  botanist: "Botanist",
  sentinel: "Sentinel",
  voidwalker: "Voidwalker",
  artificer: "Artificer",
};

/**
 * Skin picker with left/right rotation (mockup SCREEN 4).
 *
 * GSAP owns the swap animation because it is a short choreographed sequence
 * (squash out, swap sprite, spring in) rather than a single state transition.
 *
 * Keyboard: the arrow buttons are real buttons, and Left/Right arrow keys work
 * while the carousel has focus — expected for a picker, and the only way this is
 * usable without a mouse.
 */
export function AvatarCarousel({
  value,
  onChange,
  className,
}: {
  value: SkinId;
  onChange: (skin: SkinId) => void;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<HTMLDivElement>(null);
  const index = SKINS.indexOf(value);
  const prevIndex = useRef(index);

  const step = useCallback(
    (delta: number) => {
      const next = (index + delta + SKINS.length) % SKINS.length;
      onChange(SKINS[next]);
    },
    [index, onChange],
  );

  // Animate on skin change. Scoped to `root` so the selector cannot match
  // sprites in another tree after navigation.
  useGSAP(
    () => {
      if (prevIndex.current === index) return;
      const dir = index > prevIndex.current ? 1 : -1;
      prevIndex.current = index;

      gsap
        .timeline()
        .fromTo(
          spriteRef.current,
          { xPercent: 18 * dir, opacity: 0, scaleX: 0.86 },
          {
            xPercent: 0,
            opacity: 1,
            scaleX: 1,
            duration: 0.34,
            ease: "back.out(2)",
          },
        );
    },
    { scope: root, dependencies: [index] },
  );

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [step]);

  return (
    <div
      ref={root}
      className={cn("flex flex-col items-center gap-[var(--mc-unit)]", className)}
      // Group semantics so AT announces this as one control rather than three.
      role="group"
      aria-label="Choose your avatar"
      tabIndex={-1}
    >
      <div className="flex items-center gap-[calc(var(--mc-unit)*0.5)]">
        <ArrowButton direction="left" onClick={() => step(-1)} />

        <div className="relative grid place-items-center w-[128px] h-[224px] bg-mc-slot bevel-inset overflow-hidden">
          <div ref={spriteRef} className="grid place-items-center w-full h-full">
            <PixelImage
              asset={ART.skinsFull[value]}
              label={value}
              alt={`${SKIN_LABELS[value]} avatar`}
              className="max-w-[86%] max-h-[86%] object-contain"
            />
          </div>
        </div>

        <ArrowButton direction="right" onClick={() => step(1)} />
      </div>

      {/* aria-live so changing skin with the arrows is announced. */}
      <p aria-live="polite" className="font-pixel text-[11px] text-mc-text">
        {SKIN_LABELS[value]}
      </p>

      {/* Direct-pick row, radio semantics: keyboard users should not have to
          cycle through five skins one arrow press at a time. */}
      <div role="radiogroup" aria-label="Avatar" className="flex gap-[calc(var(--mc-unit)*0.5)]">
        {SKINS.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={s === value}
            aria-label={SKIN_LABELS[s]}
            title={SKIN_LABELS[s]}
            onClick={() => onChange(s)}
            className={cn(
              "grid place-items-center w-[44px] h-[44px] bg-mc-slot bevel-inset cursor-pointer",
              "transition-[filter] duration-100 hover:brightness-125",
              s === value &&
                "outline outline-[var(--mc-bevel)] outline-mc-portal-light brightness-125",
            )}
          >
            <PixelImage
              asset={ART.skins[s]}
              label={s}
              alt=""
              className="w-[80%] h-[80%] object-contain"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function ArrowButton({
  direction,
  onClick,
}: {
  direction: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "left" ? "Previous avatar" : "Next avatar"}
      className={cn(
        "grid place-items-center shrink-0 w-[40px] h-[56px] cursor-pointer",
        "bg-mc-panel bevel text-mc-text",
        "[--bevel-light:var(--color-mc-panel-light)] [--bevel-dark:var(--color-mc-panel-dark)]",
        "hover:brightness-125 active:translate-y-[var(--mc-bevel)] active:bevel-pressed",
      )}
    >
      <span aria-hidden className="font-pixel text-[14px]">
        {direction === "left" ? "‹" : "›"}
      </span>
    </button>
  );
}
