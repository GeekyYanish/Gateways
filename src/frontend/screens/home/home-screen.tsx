"use client";

import { useState } from "react";
import { SiteNav } from "@/frontend/components/home/site-nav";
import { HeroSection } from "@/frontend/components/home/hero-section";
import {
  AboutSection,
  DigitalTwinsSection,
  ParallaxSection,
} from "@/frontend/components/home/theme-sections";
import { ExploreSection } from "@/frontend/components/home/explore-section";
import { RegisterSection } from "@/frontend/components/home/register-section";
import { SponsorsSection } from "@/frontend/components/home/sponsors-section";
import { ContactSection, SiteFooter } from "@/frontend/components/home/site-footer";
import { EventsModal } from "@/frontend/components/home/events-modal";
import { ScheduleModal } from "@/frontend/components/home/schedule-modal";

/**
 * SCREEN 0 — the homepage.
 *
 * The front door reads as one continuous descent: the panning overworld hero,
 * then what the fest is, then what the theme means, then what is on, then how
 * to take part. The portal CTA sits at the end of the Parallax section rather
 * than up here — it is the one irreversible action on the page, and everything
 * above it is what helps someone decide to press it.
 *
 * The two modals are owned here rather than inside their trigger components,
 * because both the nav and the Explore section open the same two dialogs. One
 * owner means one open dialog, and no chance of two copies of the events list
 * mounting at once.
 *
 * Announcements are not a bar under the nav — they drift in the hero's sky
 * (see `sky-announcements.tsx`), so the page opens on the world rather than on
 * a strip of chrome.
 */
export function HomeScreen() {
  const [eventsOpen, setEventsOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  return (
    <div id="top" className="flex w-full flex-col">
      <SiteNav
        onOpenEvents={() => setEventsOpen(true)}
        onOpenSchedule={() => setScheduleOpen(true)}
      />

      <main className="flex w-full flex-col">
        <HeroSection />
        <AboutSection />
        <DigitalTwinsSection />
        <ParallaxSection />
        <ExploreSection
          onOpenEvents={() => setEventsOpen(true)}
          onOpenSchedule={() => setScheduleOpen(true)}
        />
        <RegisterSection />
        <SponsorsSection />
        <ContactSection />
      </main>

      <SiteFooter />

      <EventsModal open={eventsOpen} onOpenChange={setEventsOpen} />
      <ScheduleModal open={scheduleOpen} onOpenChange={setScheduleOpen} />
    </div>
  );
}
