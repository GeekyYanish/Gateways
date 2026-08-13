"use client";

import { BackLink } from "@/frontend/components/mc";
import { ScheduleList } from "@/frontend/components/schedule/schedule-list";

/**
 * The public schedule page, for visitors who are not signed in.
 *
 * Signed-in players get the same list at /dashboard/schedule, inside the
 * dashboard shell so the sidebar stays put. Both render `<ScheduleList>`.
 */
export function ScheduleScreen() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-[calc(var(--mc-unit)*1.5)] px-[calc(var(--mc-unit)*2)] py-[calc(var(--mc-unit)*1.5)] md:p-[calc(var(--mc-unit)*2)]">
      <BackLink href="/" label="Home" />

      <header>
        <h1 className="text-mc-accent text-base md:text-lg">SCHEDULE</h1>
        <p className="mt-[calc(var(--mc-unit)*0.5)] text-mc-text-dim">
          Times shown in your local timezone.
        </p>
      </header>

      <ScheduleList />
    </div>
  );
}
