"use client";

import Link from "next/link";
import { BlockPanel, LoadingBlocks } from "@/frontend/components/mc";
import { useAsync } from "@/frontend/hooks/use-async";
import { cn } from "@/frontend/lib/utils";
import { repo } from "@/backend/data";

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
      {[...byDay.entries()].map(([day, daySlots]) => {
        return (
        <section key={day}>
          {/* "Venue" is a COLUMN LABEL, not a value — it heads the right-hand
              column the rows below fill in. Printing the shared placeholder up
              here instead would have to be undone the moment a single event
              gets a real room. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-[var(--mc-unit)] gap-y-[2px]">
            <h3 className="font-pixel text-[11px] uppercase text-mc-eyebrow">{day}</h3>
            <span className="font-pixel text-[9px] uppercase tracking-[0.1em] text-mc-text-dim">
              Venue
            </span>
          </div>
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
                    {/* Each event's own venue, under the column label above.
                        The seed still carries "To be announced" for every
                        event; set a real one there and it appears here with no
                        further change. Until then it renders as a dash, so
                        thirteen rows do not all repeat the same placeholder. */}
                    <span className="text-[14px] text-mc-text-dim">
                      {s.venue && s.venue !== "To be announced" ? s.venue : "—"}
                    </span>
                  </BlockPanel>
                </li>
              );
            })}
          </ol>
        </section>
        );
      })}
    </div>
  );
}
