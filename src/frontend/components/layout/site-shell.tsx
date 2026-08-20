"use client";

import { useState } from "react";
import { SiteNav } from "@/frontend/components/home/site-nav";
import { SiteFooter } from "@/frontend/components/home/site-footer";
import { EventsModal } from "@/frontend/components/home/events-modal";
import { ScheduleModal } from "@/frontend/components/home/schedule-modal";

export function SiteShell({ children }: { children: React.ReactNode }) {
  const [eventsOpen, setEventsOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  return (
    <div className="flex w-full flex-col min-h-screen">
      <SiteNav
        onOpenEvents={() => setEventsOpen(true)}
        onOpenSchedule={() => setScheduleOpen(true)}
      />
      
      <main className="flex w-full flex-1 flex-col">
        {children}
      </main>

      <SiteFooter />

      <EventsModal open={eventsOpen} onOpenChange={setEventsOpen} />
      <ScheduleModal open={scheduleOpen} onOpenChange={setScheduleOpen} />
    </div>
  );
}
