"use client";

import { useEffect, useState } from "react";
import { BlockButton, BlockModal } from "@/frontend/components/mc";
import { ART } from "@/frontend/lib/assets/manifest";
import { FEST } from "@/frontend/lib/fest";
import { cn } from "@/frontend/lib/utils";

/**
 * The sticky top bar.
 *
 * Two kinds of destination live side by side here, which is why this takes
 * callbacks rather than only rendering links: About / Theme / Register /
 * Contact are in-page anchors, while Events and Schedule open modals (the fest
 * has dedicated /events and /schedule routes, but the homepage should answer
 * "what is on?" without navigating away from the pitch).
 *
 * The bar starts transparent over the hero and gains a solid panel background
 * once scrolled, so the wordmark does not sit on a bar floating over the sky.
 *
 * Left to right: the fest's own crest + wordmark (the identity this page is
 * selling), the link list, then the host university's mark on the far right.
 * The two logos are deliberately at opposite ends — ours anchors the page, the
 * university's is an outbound credit and should not be mistaken for it.
 */

/**
 * The first two render before the Events/Schedule modal triggers, the rest
 * after — see the split in the nav below. Sponsors is an in-page anchor rather
 * than a link to /sponsors: the roll now lives on this page, and sending a
 * visitor away mid-pitch to read a logo wall was never worth the navigation.
 */
const ANCHORS = [
  { href: "#about", label: "About" },
  { href: "#theme", label: "Theme" },
  { href: "#register", label: "Register" },
  { href: "#sponsors", label: "Sponsors" },
  { href: "#contact", label: "Contact" },
] as const;

export interface SiteNavProps {
  onOpenEvents: () => void;
  onOpenSchedule: () => void;
}

export function SiteNav({ onOpenEvents, onOpenSchedule }: SiteNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // passive: this listener never calls preventDefault, and saying so lets the
    // browser keep scrolling on the compositor thread.
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-colors duration-200",
        scrolled
          ? "border-b-[length:var(--mc-bevel)] border-mc-border bg-mc-void/95 backdrop-blur-sm"
          : "border-b-[length:var(--mc-bevel)] border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-[var(--mc-unit)] px-[calc(var(--mc-unit)*1.5)] py-[var(--mc-unit)]">
        {/* Crest and wordmark are one link, not two adjacent ones — they are a
            single lockup, and two targets to the same anchor would just give a
            keyboard user a redundant stop. The crest is decorative here because
            the wordmark beside it already names the link. */}
        <a
          href="#top"
          className="flex shrink-0 items-center gap-[calc(var(--mc-unit)*0.75)] no-underline"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ART.brand.gatewaysCrest.src}
            alt=""
            aria-hidden
            className="h-[6rem] w-auto shrink-0 md:h-[3rem]"
          />
          <span className="pixel-shadow font-pixel text-[10px] uppercase tracking-[0.14em] text-mc-gold md:text-[12px]">
            {FEST.shortEdition}
          </span>
        </a>

        {/* Desktop nav. Hidden rather than unmounted on mobile so there is only
            one source of truth for the link list. */}
        <nav aria-label="Main" className="hidden items-center gap-[calc(var(--mc-unit)*0.5)] lg:flex">
          {ANCHORS.slice(0, 2).map((a) => (
            <NavLink key={a.href} href={a.href} label={a.label} />
          ))}
          {/* Plain text, not <BlockButton>. These open modals rather than
              navigating, but a bevelled panel around two of seven nav items
              made them read as the only real controls up here — the raised
              chrome was carrying meaning it did not have. */}
          <NavLink label="Events" onClick={onOpenEvents} />
          <NavLink label="Schedule" onClick={onOpenSchedule} />
          {ANCHORS.slice(2).map((a) => (
            <NavLink key={a.href} href={a.href} label={a.label} />
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-[calc(var(--mc-unit)*1.25)]">
          {/* Separates the outbound university link from the in-page nav it now
              sits beside. Only meaningful once the nav is visible. */}
          <span aria-hidden className="hidden h-[20px] w-px bg-mc-border md:h-[26px] lg:block" />

          {/*
            The university mark, linking out to christuniversity.in.

            A plain <img>, deliberately NOT <PixelImage>: that component applies
            `image-rendering: pixelated`, which would shred the logo's curves
            and lettering. The path still comes from the manifest, so the
            no-hardcoded-paths rule holds. Height-constrained with width auto so
            the 1795×608 source scales without distortion.
          */}
          <a
            href={FEST.host.universityUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ART.brand.christUniversity.src}
              alt={`${FEST.host.university} — opens in a new tab`}
              className="h-[6rem] w-auto opacity-90 transition-opacity hover:opacity-100 md:h-[3rem]"
            />
          </a>

          <div className="lg:hidden">
            <BlockButton
              variant="ghost"
              size="sm"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </BlockButton>
          </div>
        </div>
      </div>

      {/* Mobile menu. A modal rather than a slide-down panel because BlockModal
          already gives us the focus trap, scroll lock and Escape handling that a
          hand-rolled dropdown would have to reimplement badly. */}
      <BlockModal
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title="Menu"
        description="Site navigation"
      >
        <nav aria-label="Mobile" className="flex flex-col gap-[var(--mc-unit)]">
          {ANCHORS.slice(0, 2).map((a) => (
            <MenuLink key={a.href} href={a.href} label={a.label} onNavigate={() => setMenuOpen(false)} />
          ))}
          <BlockButton
            variant="stone"
            block
            onClick={() => {
              setMenuOpen(false);
              onOpenEvents();
            }}
          >
            Events
          </BlockButton>
          <BlockButton
            variant="stone"
            block
            onClick={() => {
              setMenuOpen(false);
              onOpenSchedule();
            }}
          >
            Schedule
          </BlockButton>
          {ANCHORS.slice(2).map((a) => (
            <MenuLink key={a.href} href={a.href} label={a.label} onNavigate={() => setMenuOpen(false)} />
          ))}
        </nav>
      </BlockModal>
    </header>
  );
}

/**
 * One nav item, rendered as an anchor when it navigates and a button when it
 * opens a modal — same styling either way, because to the visitor they are the
 * same kind of thing. Using a real <button> for the modal triggers keeps the
 * semantics honest: an <a href="#"> that opens a dialog lies to assistive tech.
 */
function NavLink({
  href,
  label,
  onClick,
}: {
  href?: string;
  label: string;
  onClick?: () => void;
}) {
  const className =
    "bg-transparent px-[var(--mc-unit)] py-[calc(var(--mc-unit)*0.5)] font-pixel text-[10px] uppercase tracking-[0.1em] text-mc-text no-underline transition-colors hover:text-mc-portal-light";

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(className, "cursor-pointer border-0")}>
        {label}
      </button>
    );
  }

  return (
    <a href={href} className={className}>
      {label}
    </a>
  );
}

function MenuLink({
  href,
  label,
  onNavigate,
}: {
  href: string;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onNavigate}
      className="block bg-mc-slot px-[calc(var(--mc-unit)*1.5)] py-[calc(var(--mc-unit)*1.25)] text-center font-pixel text-[11px] uppercase tracking-[0.1em] text-mc-text no-underline bevel-inset"
    >
      {label}
    </a>
  );
}
