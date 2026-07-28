"use client";

import Link from "next/link";
import { BlockPanel } from "@/frontend/components/mc";
import { FEST } from "@/frontend/lib/fest";
import { HomeSection } from "./home-section";

/**
 * Contact block plus the site footer.
 *
 * The phone numbers are real links (`tel:`) rather than plain text — a visitor
 * on a phone reading this page should be one tap from calling, and copying a
 * number off a screen is exactly the friction that loses a registration.
 *
 * The footer's route links replace the strip that used to be welded to the
 * bottom of the landing scene; now that the page scrolls, a real footer is the
 * right place for them.
 */

const ROUTES = [
  { href: "/events", label: "Events" },
  { href: "/schedule", label: "Schedule" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/leaderboard", label: "Leaderboard" },
] as const;

export function ContactSection() {
  return (
    <HomeSection
      id="contact"
      eyebrow="Get in touch"
      title="Contact"
      lead="Any question about events, payments or a place to stay — one of these will have the answer."
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
              <a
                href={`tel:${c.phone.replace(/\s+/g, "")}`}
                className="mt-auto font-pixel text-[9px] tracking-[0.1em] text-mc-gold no-underline hover:text-mc-gold-light md:text-[10px]"
              >
                {c.phone}
              </a>
            </BlockPanel>
          </li>
        ))}
      </ul>
    </HomeSection>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-[calc(var(--mc-unit)*2)] border-t-[length:var(--mc-bevel)] border-mc-border bg-mc-obsidian">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-[calc(var(--mc-unit)*2)] px-[calc(var(--mc-unit)*1.5)] py-[calc(var(--mc-unit)*3)]">
        <div className="flex flex-col gap-[calc(var(--mc-unit)*1.5)] md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-[calc(var(--mc-unit)*0.5)]">
            <p className="font-pixel text-[11px] uppercase tracking-[0.14em] text-mc-gold md:text-[13px]">
              {FEST.shortEdition}
            </p>
            <p className="font-pixel text-[8px] uppercase tracking-[0.2em] text-mc-portal-light">
              {FEST.theme.name} · {FEST.theme.subject}
            </p>
            <p className="mt-[calc(var(--mc-unit)*0.5)] max-w-[42ch] text-[16px] leading-snug text-mc-text-dim">
              {FEST.host.department}, {FEST.host.university}, {FEST.host.city}.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="flex flex-wrap gap-x-[calc(var(--mc-unit)*2)] gap-y-[calc(var(--mc-unit)*0.5)]"
          >
            {ROUTES.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="font-pixel text-[9px] uppercase tracking-[0.12em] text-mc-text-dim no-underline transition-colors hover:text-mc-portal-light md:text-[10px]"
              >
                {r.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-[var(--mc-unit)] border-t-[length:var(--mc-bevel)] border-mc-border/60 pt-[calc(var(--mc-unit)*1.5)]">
          <ul className="flex flex-wrap gap-[calc(var(--mc-unit)*1.5)]">
            {FEST.socials.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-pixel text-[9px] uppercase tracking-[0.12em] text-mc-text-dim no-underline transition-colors hover:text-mc-gold"
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
            className="font-pixel text-[8px] uppercase tracking-[0.1em] text-mc-text-dim no-underline transition-colors hover:text-mc-gold"
          >
            {FEST.host.university} ↗
          </a>
        </div>

        <p className="text-[15px] text-mc-text-dim/70">
          Voxel aesthetic, original artwork. Not affiliated with or endorsed by
          Mojang or Microsoft.
        </p>
      </div>
    </footer>
  );
}
