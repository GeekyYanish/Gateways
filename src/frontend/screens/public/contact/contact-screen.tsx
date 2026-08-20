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
                    <div className="mt-auto flex min-h-11 flex-col justify-center">
                      {c.email ? (
                        <p className="text-[17px] tracking-tighter whitespace-nowrap text-mc-text">
                          {c.email}
                        </p>
                      ) : null}
                      {c.phone ? (
                        <a
                          href={`tel:${c.phone.replace(/\s+/g, "")}`}
                          className="inline-flex font-pixel text-[9px] tracking-[0.1em] text-mc-accent no-underline hover:text-mc-accent-strong md:text-[10px]"
                        >
                          {c.phone}
                        </a>
                      ) : null}
                    </div>
                  </BlockPanel>
                </li>
              ))}
            </ul>

            <div className="mt-[calc(var(--mc-unit)*5)] flex flex-col items-center gap-[calc(var(--mc-unit)*0.5)] text-center w-full">
              <h2 className="text-[16px] uppercase text-mc-accent md:text-[24px]">
                Location
              </h2>
              {/* <BlockPanel variant="panel" padded="lg" className="w-full max-w-2xl text-left">
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
              </BlockPanel> */}

              {/*
                How to reach and map, side-by-side in one panel.
              */}
              <BlockPanel variant="panel" padded="none" className="mt-[calc(var(--mc-unit)*3)] w-full overflow-hidden">
                <div className="grid w-full lg:grid-cols-2">
                  {/* LEFT SIDE: "How to Reach" Content */}
                  <div className="flex w-full h-full flex-col text-left p-[calc(var(--mc-unit)*2.5)]">
                    <h3 className="font-pixel text-[12px] md:text-[14px] text-mc-accent">
                      How to Reach
                    </h3>

                    <h4 className="mt-[calc(var(--mc-unit)*3)] font-pixel text-[10px] md:text-[12px] uppercase tracking-wider text-mc-success">
                      Nearest
                    </h4>
                    <ul className="mt-[var(--mc-unit)] flex flex-col gap-[calc(var(--mc-unit)*0.75)]">
                      {FEST.host.reach.nearest.map((n) => (
                        <li
                          key={n.label}
                          className="flex items-start gap-[var(--mc-unit)] text-[15px] leading-snug text-mc-text"
                        >
                          <Check
                            aria-hidden
                            size={16}
                            strokeWidth={3}
                            className="mt-[2px] shrink-0 text-mc-success"
                          />
                          <span>
                            {n.label}: {n.place}{" "}
                            <span className="whitespace-nowrap text-mc-text-dim">
                              [{n.distance}]
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>

                    <h4 className="mt-[calc(var(--mc-unit)*3)] font-pixel text-[10px] md:text-[12px] uppercase tracking-wider text-mc-success">
                      Bus Routes
                    </h4>
                    <p className="mt-[calc(var(--mc-unit)*0.75)] text-[15px] text-mc-text-dim">
                      {FEST.host.reach.busStopNote}
                    </p>
                    <div className="mt-[calc(var(--mc-unit)*1.25)] grid gap-[var(--mc-unit)] sm:grid-cols-2">
                      {FEST.host.reach.busRoutes.map((group) => (
                        <div
                          key={group.from}
                          className="bg-mc-slot p-[calc(var(--mc-unit)*1.5)] bevel-inset"
                        >
                          <p className="font-pixel text-[9px] uppercase text-mc-text">
                            {group.from}
                          </p>
                          <p className="mt-[calc(var(--mc-unit)*0.75)] text-[14px] text-mc-text-dim leading-relaxed">
                            {group.routes.join(", ")}
                          </p>
                        </div>
                      ))}
                    </div>

                    <h4 className="mt-[calc(var(--mc-unit)*3)] font-pixel text-[10px] md:text-[12px] uppercase tracking-wider text-mc-success">
                      Cab / Auto Rickshaw Services
                    </h4>
                    <p className="mt-[calc(var(--mc-unit)*0.75)] text-[15px] text-mc-text-dim">
                      {FEST.host.reach.cabNote}
                    </p>
                  </div>

                  {/* RIGHT SIDE: Map Embed */}
                  <div className="flex w-full items-stretch justify-center p-[calc(var(--mc-unit)*2.5)] lg:pl-0 lg:py-[calc(var(--mc-unit)*5)]">
                    <iframe
                      title="Google Maps Location"
                      src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d15554.4!2d77.6059112!3d12.9344479!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bae15b277a93807%3A0x88518f37b39dabd0!2sChrist%20University!5e0!3m2!1sen!2sin!4v1710000000000!5m2!1sen!2sin"
                      width="100%"
                      height="100%"
                      className="w-full h-full min-h-[350px] border-0 rounded-xl shadow-lg"
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
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
