"use client";

import { BackLink } from "@/frontend/components/mc";
import { SponsorTiers } from "@/frontend/components/sponsors/sponsor-tiers";

/**
 * The standalone sponsors page.
 *
 * The homepage carries the same roll as a section, which is where most visitors
 * will actually see it. This route is kept because it is the link you send a
 * sponsor — "here is your placement" wants its own URL, not an anchor buried
 * two thirds down a scrolling pitch.
 *
 * Both render `<SponsorTiers>`, so the two can never drift apart.
 */
export function SponsorsScreen() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-[calc(var(--mc-unit)*1.5)] p-[calc(var(--mc-unit)*2)]">
      <BackLink href="/" label="Home" />
      <h1 className="text-mc-gold text-base md:text-lg">SPONSORS</h1>
      <SponsorTiers />
    </div>
  );
}
