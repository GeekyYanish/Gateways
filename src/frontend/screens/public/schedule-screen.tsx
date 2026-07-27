"use client";

import Link from "next/link";
import { BackLink, BlockPanel, LoadingBlocks } from "@/frontend/components/mc";
import { useAsync } from "@/frontend/hooks/use-async";
import { repo } from "@/backend/data";
import { cn } from "@/frontend/lib/utils";

/**
 * Fest schedule, grouped by day.
 *
 * All times are stored as UTC ISO strings and formatted with toLocaleString, so
 * they render in the viewer's timezone. When this goes multi-timezone (or the
 * fest fixes a venue timezone), replace the formatter with a single helper
 * pinned to that zone — never rely on the browser default for a venue clock.
 */
export function ScheduleScreen() {
  const { data: slots, loading } = useAsync(() => repo.events.schedule(), []);
  const { data: events } = useAsync(() => repo.events.list(), []);

  const byDay = new Map<string, typeof slots>();
  for (const s of slots ?? []) {
    const list = byDay.get(s.dayLabel) ?? [];
    list.push(s);
    byDay.set(s.dayLabel, list);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-[calc(var(--mc-unit)*1.5)] p-[var(--mc-unit)]">
      <BackLink href="/" label="Home" />

      <header>
        <h1 className="text-mc-gold text-base md:text-lg">SCHEDULE</h1>
        <p className="mt-[calc(var(--mc-unit)*0.5)] text-mc-text-dim">
          Times shown in your local timezone.
        </p>
      </header>

      {loading ? (
        <BlockPanel variant="slot">
          <LoadingBlocks label="Loading schedule" />
        </BlockPanel>
      ) : (
        [...byDay.entries()].map(([day, daySlots]) => (
          <section key={day}>
            <h2 className="font-pixel text-[11px] uppercase text-mc-portal-light">{day}</h2>
            <ol className="mt-[var(--mc-unit)] flex flex-col gap-[calc(var(--mc-unit)*0.5)]">
              {(daySlots ?? []).map((s) => {
                const event = events?.find((e) => e.id === s.eventId);
                return (
                  <li key={s.id}>
                    <BlockPanel
                      variant={s.isBreak ? "slot" : "panel"}
                      padded="sm"
                      className={cn(
                        "flex flex-wrap items-baseline gap-x-[var(--mc-unit)] gap-y-[2px]",
                      )}
                    >
                      <time
                        dateTime={s.startsAt}
                        className="font-pixel text-[10px] tabular-nums text-mc-gold-light"
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
                            className="text-mc-text no-underline hover:text-mc-portal-light"
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
        ))
      )}
    </div>
  );
}
