"use client";

import { Check } from "lucide-react";
import { BlockPanel, BackLink } from "@/frontend/components/mc";
import { FEST } from "@/frontend/lib/fest";
import { HomeSection } from "@/frontend/components/home/home-section";

export function ContactScreen() {
  return (
    <div id="top" className="flex w-full flex-col min-h-screen">
      <main className="mx-auto flex w-full max-w-[1220px] flex-col px-[calc(var(--mc-unit)*2)] py-[calc(var(--mc-unit)*2)]">
        <div>
          <BackLink href="/" />
        </div>

        <div className="flex flex-col pb-[calc(var(--mc-unit)*4)]">
          <HomeSection
            id="contact"
            eyebrow="Get in touch"
            title="Contact"
            lead="Any question about events, payments or a place to stay — one of these will have the answer."
            className="!py-0 md:!py-0 max-w-[1220px]"
          >
            <ul className="grid gap-[var(--mc-unit)] md:grid-cols-3">
              {FEST.contacts.map((c) => (
                <li key={c.name}>
                  <BlockPanel
                    variant="panel"
                    padded="lg"
                    className="flex h-full flex-col gap-[calc(var(--mc-unit)*0.5)]"
                  >
                    <p className="text-[17px] text-mc-text">{c.name}</p>
                    {c.role ? (
                      <p className="font-pixel text-[7px] uppercase tracking-[0.12em] text-mc-text-dim">
                        {c.role}
                      </p>
                    ) : null}
                    <p
                      className="mt-[calc(var(--mc-unit)*0.5)] text-[17px] tracking-tighter whitespace-nowrap text-mc-text"
                    >
                      {c.email}
                    </p>
                    <a
                      href={`tel:${c.phone.replace(/\s+/g, "")}`}
                      className="mt-auto inline-flex min-h-11 items-center font-pixel text-[9px] tracking-[0.1em] text-mc-accent no-underline hover:text-mc-accent-strong md:text-[10px]"
                    >
                      {c.phone}
                    </a>
                  </BlockPanel>
                </li>
              ))}
            </ul>

            <div className="mt-[calc(var(--mc-unit)*5)] flex flex-col items-center gap-[calc(var(--mc-unit)*0.5)] text-center w-full">
              <h2 className="text-[16px] uppercase text-mc-accent md:text-[24px]">
                Location
              </h2>
              <BlockPanel variant="panel" padded="lg" className="w-full max-w-2xl text-left">
                <p className="text-[16px] leading-relaxed text-mc-text text-center">
                  <strong>{FEST.host.university}</strong>
                  <br />
                  {FEST.host.address}
                </p>

                <div className="mt-[calc(var(--mc-unit)*1.5)] text-center">
                  <a
                    href="https://maps.app.goo.gl/rVQDB8jkFWeAQPeG9"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-[15px] font-bold text-mc-accent hover:text-mc-gold-light underline underline-offset-4"
                  >
                    View on Google Maps
                  </a>
                </div>
              </BlockPanel>

              {/*
                How to reach, sitting under the map link rather than beside it:
                you look up the address first and the directions second, and on
                a phone a side-by-side would put the bus routes off-screen.

                Same max-w-2xl as the panel above so the two align into one
                column. The university name is deliberately NOT repeated as a
                heading here — the panel two elements up already names it, and
                the address is what a visitor is cross-referencing against.
              */}
              <BlockPanel
                variant="panel"
                padded="lg"
                className="mt-[var(--mc-unit)] w-full max-w-2xl text-left"
              >
                <h3 className="font-pixel text-[10px] uppercase tracking-[0.12em] text-mc-accent md:text-[12px]">
                  How to Reach
                </h3>

                <h4 className="mt-[calc(var(--mc-unit)*2)] font-pixel text-[9px] uppercase tracking-[0.1em] text-mc-success md:text-[10px]">
                  Nearest
                </h4>
                <ul className="mt-[var(--mc-unit)] flex flex-col gap-[calc(var(--mc-unit)*0.5)]">
                  {FEST.host.reach.nearest.map((n) => (
                    <li
                      key={n.label}
                      className="flex items-start gap-[calc(var(--mc-unit)*0.75)] text-[16px] leading-snug text-mc-text"
                    >
                      <Check
                        aria-hidden
                        size={16}
                        strokeWidth={3}
                        className="mt-[4px] shrink-0 text-mc-success"
                      />
                      <span>
                        {n.label}: {n.place}{" "}
                        {/* nowrap so "[40 km]" cannot break between the
                            number and its unit on a narrow screen. */}
                        <span className="whitespace-nowrap text-mc-text-dim">
                          [{n.distance}]
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>

                <h4 className="mt-[calc(var(--mc-unit)*2)] font-pixel text-[9px] uppercase tracking-[0.1em] text-mc-success md:text-[10px]">
                  Bus Routes
                </h4>
                <p className="mt-[calc(var(--mc-unit)*0.75)] text-[15px] leading-snug text-mc-text-dim">
                  {FEST.host.reach.busStopNote}
                </p>
                <div className="mt-[var(--mc-unit)] grid gap-[var(--mc-unit)] sm:grid-cols-2">
                  {FEST.host.reach.busRoutes.map((group) => (
                    <div
                      key={group.from}
                      className="bg-mc-slot p-[calc(var(--mc-unit)*1.25)] bevel-inset"
                    >
                      <p className="font-pixel text-[8px] uppercase leading-relaxed tracking-[0.1em] text-mc-text md:text-[9px]">
                        {group.from}
                      </p>
                      {/* Joined rather than a list of chips: these are read as
                          one run of numbers you scan for yours, and fifteen
                          bevelled pills would out-shout the headings. */}
                      <p className="mt-[calc(var(--mc-unit)*0.75)] text-[15px] leading-relaxed text-mc-text-dim">
                        {group.routes.join(", ")}
                      </p>
                    </div>
                  ))}
                </div>

                <h4 className="mt-[calc(var(--mc-unit)*2)] font-pixel text-[9px] uppercase tracking-[0.1em] text-mc-success md:text-[10px]">
                  Cab / Auto Rickshaw Services
                </h4>
                <p className="mt-[calc(var(--mc-unit)*0.75)] text-[15px] leading-snug text-mc-text-dim">
                  {FEST.host.reach.cabNote}
                </p>
              </BlockPanel>
            </div>
          </HomeSection>
        </div>
      </main>
    </div>
  );
}
