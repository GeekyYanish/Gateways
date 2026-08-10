"use client";

import { BlockButton, BlockPanel, ItemIcon } from "@/frontend/components/mc";
import type { ItemName } from "@/frontend/lib/assets/manifest";
import { HomeSection } from "./home-section";

/**
 * The events + schedule gateway.
 *
 * Three featured domains from the theme deck act as the teaser, and the full
 * lists open in modals rather than unrolling inline — that decision keeps the
 * registration CTA within reach of the fold instead of pushing it past a
 * thirteen-row event table.
 *
 * These three cards are presentational. Their names are the deck's branding for
 * the flagship domains and do not correspond to seeded event slugs, so they
 * open the events modal rather than deep-linking to an event page that may not
 * exist yet. When the 2026 events are seeded with these names, swap the card
 * source for `repo.events.list({ featured: true })` and link them directly.
 */
const FEATURED: Array<{ name: string; domain: string; item: ItemName }> = [
  { name: "BUILD.EXE", domain: "Hackathon", item: "craftingTable" },
  { name: "NODE CONTROL", domain: "IT Manager", item: "compass" },
  { name: "PIXEL GRID", domain: "UI/UX Design", item: "map" },
];

export interface ExploreSectionProps {
  onOpenEvents: () => void;
  onOpenSchedule: () => void;
}

export function ExploreSection({
  onOpenEvents,
  onOpenSchedule,
}: ExploreSectionProps) {
  return (
    <HomeSection
      id="events"
      eyebrow="What's on"
      title="Enter a Domain"
      lead="Technical and non-technical events across two days. Pick as many as you like — one entry fee covers all of them."
    >
      <ul className="grid gap-[var(--mc-unit)] md:grid-cols-3">
        {FEATURED.map((f) => (
          <li key={f.name}>
            <button
              type="button"
              onClick={onOpenEvents}
              className="block w-full text-left"
            >
              <BlockPanel
                variant="portal"
                padded="lg"
                className="flex h-full flex-col items-start gap-[var(--mc-unit)] transition-[filter] duration-75 hover:brightness-125"
              >
                <ItemIcon item={f.item} size={40} />
                {/* eyebrow, not portal-pale. This card's `portal` variant
                    carries its identity in the BORDER — its surface is the
                    themed panel, so #e8dcfb type on it disappears the moment
                    that panel is a light one. mc-eyebrow is the same violet
                    expressed as a meaning, and it darkens with the theme. */}
                <h3 className="text-[11px] uppercase text-mc-eyebrow md:text-[13px]">
                  {f.name}
                </h3>
                <p className="font-pixel text-[8px] uppercase tracking-[0.12em] text-mc-accent">
                  {f.domain}
                </p>
              </BlockPanel>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-[calc(var(--mc-unit)*2.5)] flex flex-wrap justify-center gap-[var(--mc-unit)]">
        <BlockButton size="lg" variant="emerald" onClick={onOpenEvents}>
          View all events
        </BlockButton>
        <BlockButton size="lg" variant="stone" onClick={onOpenSchedule}>
          View schedule
        </BlockButton>
      </div>
    </HomeSection>
  );
}
