"use client";

import { useState } from "react";
import { BlockPanel, BackLink } from "@/frontend/components/mc";
import { FEST } from "@/frontend/lib/fest";
import { HomeSection } from "@/frontend/components/home/home-section";

export function ContactScreen() {
  return (
    <div id="top" className="flex w-full flex-col h-screen overflow-hidden">
      <main className="mx-auto flex w-full max-w-[1220px] flex-col px-[calc(var(--mc-unit)*2)] py-[calc(var(--mc-unit)*2)] h-full">
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
            </div>
          </HomeSection>
        </div>
      </main>
    </div>
  );
}
