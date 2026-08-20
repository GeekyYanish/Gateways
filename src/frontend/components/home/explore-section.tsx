"use client";

import {
  BlockButton,
  BlockPanel,
  ItemIcon,
  LoadingBlocks,
  PixelImage,
} from "@/frontend/components/mc";
import { ART, type ItemName } from "@/frontend/lib/assets/manifest";
import { repo } from "@/backend/data";
import { useAsync } from "@/frontend/hooks/use-async";
import { HomeSection } from "./home-section";
import { ExploreCharacterDecor } from "@/frontend/components/decor";

/**
 * The events + schedule gateway.
 *
 * The teaser is the fest's REAL event categories, read through `repo` — it used
 * to be three hardcoded cards ("BUILD.EXE", "NODE CONTROL", "PIXEL GRID") that
 * were branding from the theme deck and matched no seeded event, so tapping one
 * opened a modal that never mentioned the name the visitor had just clicked.
 * Categories are the actual domains a participant enters, they carry their own
 * one-line description, and they stay correct when the event list changes.
 *
 * The full lists still open in modals rather than unrolling inline — that keeps
 * the registration CTA within reach of the fold instead of pushing it past a
 * thirteen-row event table.
 */

/**
 * Category slug → hotbar item.
 *
 * Keyed by slug rather than id: slugs are the stable, human-readable handle in
 * the seed, and a category that arrives from a future backend with a new id
 * still lands on its icon. Anything unmapped falls back to the chest.
 */
const CATEGORY_ITEMS: Record<string, ItemName> = {
  "hackathon-mine": "pickaxe",
  "photography-forest": "camera",
  "design-workshop": "craftingTable",
  "quiz-library": "book",
  "gaming-arena": "sword",
  "culture-stage": "trophy",
  "circuit-lab": "compass",
  "academic-stage": "map",
};

export interface ExploreSectionProps {
  onOpenEvents: () => void;
  onOpenSchedule: () => void;
}

export function ExploreSection({
  onOpenEvents,
  onOpenSchedule,
}: ExploreSectionProps) {
  const { data: categories, loading } = useAsync(
    () => repo.reference.categories(),
    [],
  );

  const shown = [...(categories ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <HomeSection
      id="events"
      eyebrow="What's on"
      title="Enter a Domain"
      decor={<ExploreCharacterDecor />}
      lead="Technical and non-technical events across two days. Pick as many as you like — one entry fee covers all of them."
    >
      <div
        aria-hidden
        className="pointer-events-none mb-[var(--mc-unit)] flex h-[170px] items-end justify-center xl:hidden"
      >
        <PixelImage
          asset={ART.home.pickaxe}
          label="pickaxe character"
          alt=""
          className="h-full w-auto"
          style={{ filter: "drop-shadow(0 10px 8px rgba(0,0,0,0.36))" }}
        />
      </div>

      {loading ? (
        <LoadingBlocks label="Loading domains…" />
      ) : shown.length === 0 ? (
        <p className="text-center text-mc-text-dim">
          The event line-up is being finalised. Check back shortly.
        </p>
      ) : (
        <ul className="grid gap-[var(--mc-unit)] sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={onOpenEvents}
                className="block h-full w-full text-left"
              >
                <BlockPanel
                  variant="portal"
                  padded="lg"
                  className="flex h-full flex-col items-start gap-[var(--mc-unit)] transition-[filter] duration-75 hover:brightness-125"
                >
                  <ItemIcon item={CATEGORY_ITEMS[c.slug] ?? "chest"} size={40} />
                  {/* eyebrow, not portal-pale. This card's `portal` variant
                      carries its identity in the BORDER — its surface is the
                      themed panel, so #e8dcfb type on it disappears the moment
                      that panel is a light one. mc-eyebrow is the same violet
                      expressed as a meaning, and it darkens with the theme. */}
                  <h3 className="text-[11px] uppercase text-mc-eyebrow md:text-[13px]">
                    {c.name}
                  </h3>
                  {c.description ? (
                    <p className="text-[14px] leading-snug text-mc-text-dim">
                      {c.description}
                    </p>
                  ) : null}
                </BlockPanel>
              </button>
            </li>
          ))}
        </ul>
      )}

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
