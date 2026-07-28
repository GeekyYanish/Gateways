"use client";

import { useState } from "react";
import Link from "next/link";
import { blockButton, BlockModal, BlockPanel, LoadingBlocks } from "@/frontend/components/mc";
import { useAsync } from "@/frontend/hooks/use-async";
import { repo } from "@/backend/data";
import { cn } from "@/frontend/lib/utils";

/**
 * The full event list, in a modal.
 *
 * Deliberately not an inline homepage section: the fest has ~13 events across 7
 * categories, and dropping that table into the middle of the pitch pushes the
 * registration call-to-action far below the fold. A visitor who wants the list
 * asks for it; everyone else keeps scrolling the story.
 *
 * Data comes through `repo` like every other screen — the modal never knows
 * where events are stored. `useAsync` only fires while the modal is open, so
 * closed modals cost nothing.
 */
export function EventsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const { data: categories } = useAsync(
    () => (open ? repo.reference.categories() : Promise.resolve([])),
    [open],
  );

  const { data: events, loading } = useAsync(
    () =>
      open
        ? repo.events.list({
            status: ["published", "ongoing", "registration_closed", "completed"],
          })
        : Promise.resolve([]),
    [open],
  );

  const shown = (events ?? []).filter(
    (e) => !categoryId || e.categoryId === categoryId,
  );

  return (
    <BlockModal
      open={open}
      onOpenChange={onOpenChange}
      title="Events"
      description="Every event at the fest, grouped by category."
      variant="panel"
      className="max-w-2xl"
      footer={
        // The cva function rather than <BlockButton>: this navigates, so it
        // must be an anchor. Nesting a <Link> inside the component's <button>
        // would be invalid HTML and would break keyboard activation.
        <Link
          href="/events"
          onClick={() => onOpenChange(false)}
          className={cn(blockButton({ variant: "emerald", size: "sm" }), "no-underline")}
        >
          Open full events page
        </Link>
      }
    >
      <nav
        aria-label="Event categories"
        className="mb-[calc(var(--mc-unit)*1.5)] flex flex-wrap gap-[calc(var(--mc-unit)*0.5)]"
      >
        <CategoryChip
          label="All"
          active={categoryId === null}
          onClick={() => setCategoryId(null)}
        />
        {(categories ?? []).map((c) => (
          <CategoryChip
            key={c.id}
            label={c.name}
            active={categoryId === c.id}
            onClick={() => setCategoryId(c.id)}
          />
        ))}
      </nav>

      {loading ? (
        <LoadingBlocks label="Loading events…" />
      ) : shown.length === 0 ? (
        <p className="text-mc-text-dim">No events in this category yet.</p>
      ) : (
        <ul className="flex flex-col gap-[calc(var(--mc-unit)*0.75)]">
          {shown.map((e) => (
            <li key={e.id}>
              <Link
                href={`/events/${e.slug}`}
                onClick={() => onOpenChange(false)}
                className="block no-underline"
              >
                <BlockPanel
                  variant="slot"
                  padded="md"
                  className="transition-[filter] duration-75 hover:brightness-125"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-[var(--mc-unit)]">
                    <h3 className="text-[10px] uppercase text-mc-gold md:text-[12px]">
                      {e.title}
                    </h3>
                    <span className="font-pixel text-[8px] uppercase tracking-[0.1em] text-mc-emerald-light">
                      {e.mode === "team" ? "Team" : "Solo"}
                    </span>
                  </div>
                  {e.tagline ? (
                    <p className="mt-[calc(var(--mc-unit)*0.5)] text-[16px] leading-snug text-mc-text-dim">
                      {e.tagline}
                    </p>
                  ) : null}
                  {e.venue ? (
                    <p className="mt-[calc(var(--mc-unit)*0.25)] text-[15px] text-mc-text-dim/80">
                      {e.venue}
                    </p>
                  ) : null}
                </BlockPanel>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BlockModal>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "border-[length:var(--mc-bevel)] px-[var(--mc-unit)] py-[calc(var(--mc-unit)*0.5)]",
        "font-pixel text-[8px] uppercase tracking-[0.1em] transition-colors md:text-[9px]",
        active
          ? "border-mc-gold bg-mc-panel-light text-mc-gold"
          : "border-mc-border bg-mc-slot text-mc-text-dim hover:text-mc-text",
      )}
    >
      {label}
    </button>
  );
}
