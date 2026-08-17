"use client";

import { BlockPanel } from "@/frontend/components/mc";
import { GRASS_GROUND_STYLE } from "@/frontend/lib/assets/textures";
import { FEST } from "@/frontend/lib/fest";
import { HomeSection } from "./home-section";

//The site footer.
//
//The phone numbers are real links (`tel:`) rather than plain text — a visitor
//on a phone reading this page should be one tap from calling, and copying a
//number off a screen is exactly the friction that loses a registration.
export function SiteFooter() {
  return (
    // Grass-topped dirt, generated in assets/textures.ts. The footer is now
    // the ground the page gradient's horizon has been leading down to, which
    // is why it drops the themed surface it used to sit on.
    //
    // That flips how its type is coloured. A MATERIAL backdrop is the same in
    // both themes, so the text on it can no longer name themed tokens the way
    // the rest of the app does — `text-mc-text-dim` resolves to a dark brown in
    // the light theme and would vanish into the soil. Everything below names a
    // pale material directly instead, the same exception the hero and portal
    // scenes take for type sitting on art.
    //
    // No top border: the grass cap IS the edge, and a hard rule above it read
    // as a line drawn over the turf.
    <footer
      className="pixelated mt-[calc(var(--mc-unit)*2)]"
      style={GRASS_GROUND_STYLE}
    >
      {/* Top padding clears the grass cap, which is 10 art px tall and so
          2.5 × --mc-unit at every --mc-scale. The parade used to occupy that
          band and hold the content off it; with the parade gone the text would
          otherwise start in the turf. */}
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-[calc(var(--mc-unit)*2)] px-[calc(var(--mc-unit)*2)] pb-[calc(var(--mc-unit)*3)] pt-[calc(var(--mc-unit)*3.5)] md:px-[calc(var(--mc-unit)*1.5)]">
        <div className="flex flex-col gap-[calc(var(--mc-unit)*1.5)] md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-[calc(var(--mc-unit)*0.5)]">
            <p className="font-pixel text-[11px] uppercase tracking-[0.14em] text-mc-gold-light md:text-[13px]">
              {FEST.shortEdition}
            </p>
            <p className="font-pixel text-[8px] uppercase tracking-[0.2em] text-mc-portal-pale">
              {FEST.theme.name} · {FEST.theme.subject}
            </p>
            <p className="mt-[calc(var(--mc-unit)*0.5)] max-w-[42ch] text-[16px] leading-snug text-mc-cloud">
              {FEST.host.department}, {FEST.host.university}, {FEST.host.city}.
            </p>
          </div>

        </div>

        <div className="flex flex-wrap items-center justify-between gap-[var(--mc-unit)] border-t-[length:var(--mc-bevel)] border-white/25 pt-[calc(var(--mc-unit)*1.5)]">
          <ul className="flex flex-wrap gap-[calc(var(--mc-unit)*1.5)]">
            {FEST.socials.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center font-pixel text-[9px] uppercase tracking-[0.12em] text-mc-cloud no-underline transition-colors hover:text-mc-gold-light"
                >
                  {s.label} ↗
                </a>
              </li>
            ))}
          </ul>

          <a
            href={FEST.host.universityUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center font-pixel text-[8px] uppercase tracking-[0.1em] text-mc-cloud no-underline transition-colors hover:text-mc-gold-light"
          >
            {FEST.host.university} ↗
          </a>
        </div>

        <p className="text-[15px] text-mc-cloud/75">
          Voxel aesthetic, original artwork. Not affiliated with or endorsed by
          Mojang or Microsoft.
        </p>
      </div>
    </footer>
  );
}
