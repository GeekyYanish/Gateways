"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { blockButton, BlockModal, BlockPanel, LoadingBlocks } from "@/frontend/components/mc";
import { useAsync } from "@/frontend/hooks/use-async";
import { repo } from "@/backend/data";
import { cn } from "@/frontend/lib/utils";
import type { ScheduleSlot } from "@/backend/data/types";

/**
 * The running order, in a modal, split into day tabs.
 *
 * Days are derived from the slots themselves rather than hardcoded to two:
 * the seed generates dates relative to now, and a fest that grows to three days
 * should not need this component edited. Slots are grouped by `dayLabel` when
 * one is set (that is what it is for) and otherwise by calendar date, so the
 * grouping survives either shape of data.
 */
export function ScheduleModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: slots, loading } = useAsync(
    () => (open ? repo.events.schedule() : Promise.resolve([])),
    [open],
  );

  const days = useMemo(() => groupByDay(slots ?? []), [slots]);
  const [activeDay, setActiveDay] = useState(0);
  // The tab index can outlive the data it indexed (open → close → reopen with
  // fewer days). Clamping on render is cheaper and safer than a reset effect.
  const dayIndex = Math.min(activeDay, Math.max(days.length - 1, 0));
  const active = days[dayIndex];

  return (
    <BlockModal
      open={open}
      onOpenChange={onOpenChange}
      title="Schedule"
      description="The running order for each day of the fest."
      variant="panel"
      className="max-w-2xl"
      footer={
        <Link
          href="/schedule"
          onClick={() => onOpenChange(false)}
          className={cn(blockButton({ variant: "emerald", size: "sm" }), "no-underline")}
        >
          Open full schedule
        </Link>
      }
    >
      {loading ? (
        <LoadingBlocks label="Loading schedule…" />
      ) : days.length === 0 ? (
        <p className="text-mc-text-dim">The schedule has not been published yet.</p>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Fest days"
            className="mb-[calc(var(--mc-unit)*1.5)] flex flex-wrap gap-[calc(var(--mc-unit)*0.5)]"
          >
            {days.map((day, i) => (
              <button
                key={day.label}
                type="button"
                role="tab"
                id={`schedule-tab-${i}`}
                aria-selected={i === dayIndex}
                aria-controls={`schedule-panel-${i}`}
                onClick={() => setActiveDay(i)}
                className={cn(
                  "border-[length:var(--mc-bevel)] px-[calc(var(--mc-unit)*1.5)] py-[calc(var(--mc-unit)*0.75)]",
                  "font-pixel text-[9px] uppercase tracking-[0.12em] transition-colors md:text-[10px]",
                  i === dayIndex
                    ? "border-mc-gold bg-mc-panel-light text-mc-accent"
                    : "border-mc-border bg-mc-slot text-mc-text-dim hover:text-mc-text",
                )}
              >
                {day.label}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            id={`schedule-panel-${dayIndex}`}
            aria-labelledby={`schedule-tab-${dayIndex}`}
          >
            <p className="mb-[var(--mc-unit)] font-pixel text-[8px] uppercase tracking-[0.14em] text-mc-text-dim">
              {active?.dateLabel}
            </p>
            <ol className="flex flex-col gap-[calc(var(--mc-unit)*0.5)]">
              {active?.slots.map((slot) => (
                <li key={slot.id}>
                  <BlockPanel
                    variant="slot"
                    padded="md"
                    className={cn(
                      "flex flex-wrap items-baseline gap-x-[calc(var(--mc-unit)*1.5)] gap-y-[calc(var(--mc-unit)*0.25)]",
                      slot.isBreak && "opacity-70",
                    )}
                  >
                    <time
                      dateTime={slot.startsAt}
                      className="font-pixel text-[8px] uppercase tracking-[0.08em] text-mc-info md:text-[9px]"
                    >
                      {timeRange(slot)}
                    </time>
                    <span className="text-[17px] text-mc-text">{slot.title}</span>
                    {slot.venue ? (
                      <span className="text-[15px] text-mc-text-dim/80">
                        {slot.venue}
                      </span>
                    ) : null}
                  </BlockPanel>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
    </BlockModal>
  );
}

interface Day {
  label: string;
  dateLabel: string;
  slots: ScheduleSlot[];
}

function groupByDay(slots: ScheduleSlot[]): Day[] {
  const buckets = new Map<string, ScheduleSlot[]>();

  for (const slot of slots) {
    // Key on the calendar date, not dayLabel: two slots labelled "Day 1" from
    // different dates must not merge, and slots with no label still group.
    const key = slot.startsAt.slice(0, 10);
    const list = buckets.get(key);
    if (list) list.push(slot);
    else buckets.set(key, [slot]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, daySlots], i) => {
      const sorted = [...daySlots].sort((a, b) =>
        a.startsAt.localeCompare(b.startsAt),
      );
      return {
        label: sorted[0].dayLabel || `Day ${String(i + 1).padStart(2, "0")}`,
        dateLabel: new Date(date).toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        slots: sorted,
      };
    });
}

function timeRange(slot: ScheduleSlot): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  return `${fmt(slot.startsAt)} – ${fmt(slot.endsAt)}`;
}
