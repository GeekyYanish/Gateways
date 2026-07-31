"use client";

import { SponsorTiers } from "@/frontend/components/sponsors/sponsor-tiers";
import { HomeSection } from "./home-section";

/**
 * Sponsors, on the homepage itself.
 *
 * Sponsors are one of the few things on this page a visitor never goes looking
 * for — which is exactly why a link to a separate page was the wrong shape for
 * them. Nobody clicks "Sponsors". Putting the roll in the scroll means the
 * people funding the fest are seen by everyone who reads it.
 *
 * It sits after Register and before Contact: credit belongs near the end, but
 * ahead of the contact block, so the page still closes on "here is how to reach
 * us" rather than on a logo wall.
 */
export function SponsorsSection() {
  return (
    <HomeSection
      id="sponsors"
      eyebrow="With thanks to"
      title="Sponsors"
      lead="The fest runs on their backing. Several are hiring — the links go straight to them."
    >
      <SponsorTiers className="mx-auto max-w-3xl" />
    </HomeSection>
  );
}
