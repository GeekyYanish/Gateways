"use client";

import { BlockPanel, BackLink, ItemIcon } from "@/frontend/components/mc";
import { FEST } from "@/frontend/lib/fest";
import { HomeSection } from "@/frontend/components/home/home-section";

/** Contact-page-only detail — not a fact restated elsewhere, so it stays local rather than in fest.ts. */
const NEAREST_TRANSIT = [
  { label: "Airport", value: "Kempegowda Intl. Airport [40 km]" },
  { label: "Railway Station", value: "KSR Bengaluru City Jn. [10 km]" },
  { label: "Bus Terminus", value: "Kempegowda Bus Stand (Majestic) [10 km]" },
  { label: "Metro Station", value: "R V Road (Green Line) [5.6 km]" },
] as const;

const BUS_ROUTES = [
  { from: "Majestic / KSR Bengaluru", routes: "365, 353, 168D, 170, 171A, 171B, 171C, 171D, 165, 340, 342, 356, 360B, KBS 3A, KBS 3C" },
  { from: "Airport", routes: "KIA-5, KIA-7, KIA-14" },
] as const;

export function ContactScreen() {
  return (
    <div id="top" className="flex w-full flex-col min-h-screen overflow-y-auto">
      <main className="mx-auto flex w-full max-w-[1220px] flex-col px-[calc(var(--mc-unit)*2)] py-[calc(var(--mc-unit)*2)] min-h-full">
        <div>
          <BackLink href="/" />
        </div>

        <div className="flex-1 flex flex-col justify-center pb-[calc(var(--mc-unit)*4)]">
          <HomeSection
            id="contact"
            eyebrow="Get in touch"
            title="Contact"
            lead="Any question about events, payments or a place to stay — one of these will have the answer."
            className="!py-0 md:!py-0 max-w-[1220px]"
          >
            <ul className="grid gap-[var(--mc-unit)] md:grid-cols-2 lg:grid-cols-4">
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
                    {c.phone ? (
                      <a
                        href={`tel:${c.phone.replace(/\s+/g, "")}`}
                        className="mt-auto inline-flex min-h-11 items-center font-pixel text-[9px] tracking-[0.1em] text-mc-accent no-underline hover:text-mc-accent-strong md:text-[10px]"
                      >
                        {c.phone}
                      </a>
                    ) : (
                      <div className="mt-auto min-h-11"></div>
                    )}
                  </BlockPanel>
                </li>
              ))}
            </ul>

            <div className="mt-[calc(var(--mc-unit)*5)] flex flex-col items-center gap-[calc(var(--mc-unit)*0.5)] w-full">
              <h2 className="text-[16px] uppercase text-mc-accent md:text-[24px] text-center">
                Location
              </h2>
              <BlockPanel variant="panel" padded="lg" className="w-full max-w-3xl text-left">
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
            </div>

            <div className="mt-[calc(var(--mc-unit)*3)] flex flex-col items-center gap-[calc(var(--mc-unit)*0.5)] w-full">
              <p className="font-pixel text-[8px] uppercase tracking-[0.28em] text-mc-eyebrow md:text-[9px]">
                Getting here
              </p>
              <h2 className="text-[16px] uppercase text-mc-accent md:text-[24px] text-center">
                How to Reach
              </h2>

              <BlockPanel variant="panel" padded="lg" className="w-full max-w-3xl text-left">
                <div className="flex flex-col gap-[calc(var(--mc-unit)*2)]">
                  <div>
                    <h3 className="font-pixel text-[10px] uppercase tracking-[0.1em] text-mc-text-dim mb-[var(--mc-unit)]">
                      Nearest
                    </h3>
                    <ul className="flex flex-col gap-[calc(var(--mc-unit)*0.75)]">
                      {NEAREST_TRANSIT.map((t) => (
                        <li key={t.label} className="flex items-start gap-[calc(var(--mc-unit)*0.75)]">
                          <ItemIcon item="compass" size={16} className="mt-[2px] shrink-0" />
                          <span className="text-[16px] text-mc-text">
                            <strong className="text-mc-text">{t.label}:</strong> {t.value}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-pixel text-[10px] uppercase tracking-[0.1em] text-mc-text-dim mb-[calc(var(--mc-unit)*0.5)]">
                      Bus Routes
                    </h3>
                    <p className="text-[15px] text-mc-text-dim mb-[var(--mc-unit)]">
                      Ask for Christ University / Dairy Circle Bus Stop
                    </p>
                    <div className="grid gap-[var(--mc-unit)] sm:grid-cols-2">
                      {BUS_ROUTES.map((r) => (
                        <BlockPanel key={r.from} variant="slot" padded="md">
                          <p className="font-pixel text-[9px] uppercase tracking-[0.08em] text-mc-eyebrow mb-[calc(var(--mc-unit)*0.5)]">
                            From {r.from}
                          </p>
                          <p className="text-[15px] leading-relaxed text-mc-text">{r.routes}</p>
                        </BlockPanel>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-pixel text-[10px] uppercase tracking-[0.1em] text-mc-text-dim mb-[calc(var(--mc-unit)*0.5)]">
                      Cab / Auto Rickshaw
                    </h3>
                    <p className="text-[15px] leading-relaxed text-mc-text">
                      Cab and auto rickshaw services can be availed via Ola, Uber, Rapido, and NammaYatri apps.
                    </p>
                  </div>
                </div>
              </BlockPanel>
            </div>
          </HomeSection>
        </div>
      </main>
    </div>
  );
}
