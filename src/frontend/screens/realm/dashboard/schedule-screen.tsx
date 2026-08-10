"use client";

import { ScheduleList } from "@/frontend/components/schedule/schedule-list";

/**
 * Schedule inside the dashboard shell.
 *
 * The sidebar used to point straight at the public /schedule route, which sits
 * outside the (realm) group — so opening it threw away the dashboard chrome and
 * dropped the player on a standalone page with a "Home" back link. This screen
 * exists so Schedule behaves like every other sidebar entry: the menu stays on
 * the left, the content changes on the right.
 *
 * No back link and no page padding here; the shell supplies both.
 */
export function DashboardScheduleScreen() {
  return (
    <div className="flex flex-col gap-[calc(var(--mc-unit)*1.5)]">
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
