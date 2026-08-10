"use client";

import Link from "next/link";
import { BlockPanel, LoadingBlocks } from "@/frontend/components/mc";
import { useAsync } from "@/frontend/hooks/use-async";
import { repo } from "@/backend/data";
import { cn } from "@/frontend/lib/utils";

/**
 * Fest schedule, grouped by day.
 *
 * Headless on purpose — no heading, no back link, no page padding. This list
 * renders in two places, the public /schedule page and /dashboard/schedule
 * inside the shell, which need different chrome around identical content.
 *
 * The homepage's `<ScheduleModal>` deliberately does NOT use this: it presents
 * the same data as day tabs with time ranges, and groups by calendar date
 * rather than dayLabel so two differently-dated "Day 1" slots cannot merge.
 * That is a different view of the data, not a duplicate of this one.
 *
 * All times are stored as UTC ISO strings and formatted with toLocaleString, so
 * they render in the viewer's timezone. When this goes multi-timezone (or the
 * fest fixes a venue timezone), replace the formatter with a single helper
 * pinned to that zone — never rely on the browser default for a venue clock.
 */
export function ScheduleList({ className }: { className?: string }) {
  const { data: slots, loading } = useAsync(() => repo.events.schedule(), []);
  const { data: events } = useAsync(() => repo.events.list(), []);

  const byDay = new Map<string, NonNullable<typeof slots>>();
  for (const s of slots ?? []) {
    const list = byDay.get(s.dayLabel) ?? [];
    list.push(s);
    byDay.set(s.dayLabel, list);
  }

  if (loading) {
    return (
      <BlockPanel variant="slot">
        <LoadingBlocks label="Loading schedule" />
      </BlockPanel>
    );
  }

  return (
    <div className={cn("flex flex-col gap-[calc(var(--mc-unit)*1.5)]", className)}>
      {[...byDay.entries()].map(([day, daySlots]) => (
        <section key={day}>
          <h3 className="font-pixel text-[11px] uppercase text-mc-eyebrow">{day}</h3>
          <ol className="mt-[var(--mc-unit)] flex flex-col gap-[calc(var(--mc-unit)*0.5)]">
            {daySlots.map((s) => {
              const event = events?.find((e) => e.id === s.eventId);
              return (
                <li key={s.id}>
                  <BlockPanel
                    variant={s.isBreak ? "slot" : "panel"}
                    padded="sm"
                    className="flex flex-wrap items-baseline gap-x-[var(--mc-unit)] gap-y-[2px]"
                  >
                    <time
                      dateTime={s.startsAt}
                      className="font-pixel text-[10px] tabular-nums text-mc-accent-strong"
                    >
                      {new Date(s.startsAt).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    <span className="flex-1 text-[16px]">
                      {event ? (
                        <Link
                          href={`/events/${event.slug}`}
                          className="text-mc-text no-underline hover:text-mc-eyebrow"
                        >
                          {s.title}
                        </Link>
                      ) : (
                        <span className={s.isBreak ? "text-mc-text-dim" : undefined}>
                          {s.title}
                        </span>
                      )}
                    </span>
                    {s.venue ? (
                      <span className="text-[14px] text-mc-text-dim">{s.venue}</span>
                    ) : null}
                  </BlockPanel>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
