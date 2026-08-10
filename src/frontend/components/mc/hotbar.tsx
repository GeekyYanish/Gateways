"use client";

import { useCallback, useEffect } from "react";
import { ItemIcon } from "./item-icon";
import { type ItemName } from "@/frontend/lib/assets/manifest";
import { cn } from "@/frontend/lib/utils";

/**
 * The Minecraft hotbar (mockup SCREEN 6, bottom).
 *
 * Nine slots, selectable with the 1–9 number keys — that keyboard binding is
 * the whole point of a hotbar, so it is built in rather than left to the page.
 * Slots can hold an item sprite and act as navigation shortcuts.
 */

export interface HotbarSlot {
  /** Item art key; empty slots pass undefined. */
  item?: ItemName;
  label?: string;
  onSelect?: () => void;
}

export interface HotbarProps {
  slots: ReadonlyArray<HotbarSlot>;
  activeIndex: number;
  onActiveChange: (index: number) => void;
  className?: string;
}

const SLOT_COUNT = 9;

export function Hotbar({
  slots,
  activeIndex,
  onActiveChange,
  className,
}: HotbarProps) {
  const select = useCallback(
    (i: number) => {
      onActiveChange(i);
      slots[i]?.onSelect?.();
    },
    [onActiveChange, slots],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never hijack keys while the user is typing.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= SLOT_COUNT) {
        e.preventDefault();
        select(n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  const padded = Array.from({ length: SLOT_COUNT }, (_, i) => slots[i] ?? {});

  return (
    <div
      // A toolbar with radio semantics: exactly one slot is selected at a time.
      role="radiogroup"
      aria-label="Hotbar"
      className={cn(
        "inline-flex gap-[3px] bg-mc-panel-dark p-[3px] bevel",
        "[--bevel-light:var(--color-mc-panel-light)] [--bevel-dark:var(--color-mc-void)]",
        className,
      )}
    >
      {padded.map((slot, i) => {
        const isActive = i === activeIndex;
        const name = slot.label ?? (slot.item ? slot.item : `Empty slot ${i + 1}`);

        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`${i + 1}. ${name}`}
            title={`${name} (${i + 1})`}
            onClick={() => select(i)}
            className={cn(
              "relative grid place-items-center",
              "w-[calc(var(--mc-unit)*3.5)] h-[calc(var(--mc-unit)*3.5)]",
              "min-w-[40px] min-h-[40px]",
              "bg-mc-slot bevel-inset cursor-pointer",
              "transition-[filter] duration-75",
              "hover:brightness-125",
              // outline-mc-text, not outline-white: the slot underneath is the
              // themed --slot, which is a pale sand in the light theme. A white
              // ring on it is invisible, and this ring is the only thing saying
              // which slot is selected.
              isActive &&
                "outline outline-[calc(var(--mc-bevel)*0.8)] outline-mc-text outline-offset-0 brightness-125 z-10",
            )}
          >
            {/* ItemIcon, not PixelImage: the item PNGs do not exist yet, and a
                row of magenta "art pending" checkerboards along the bottom of
                the world screen reads as broken rather than as pending. */}
            {slot.item ? <ItemIcon item={slot.item} size={26} /> : null}
            {/* Slot number, bottom-right like the real hotbar tooltip hint. */}
            <span
              aria-hidden
              className="absolute bottom-0 right-[2px] font-pixel text-[7px] text-mc-text/45"
            >
              {i + 1}
            </span>
          </button>
        );
      })}
    </div>
  );
}
