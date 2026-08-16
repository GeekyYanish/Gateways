"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { BlockButton, BlockModal, ThemeToggle } from "@/frontend/components/mc";
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
 * The bar starts transparent and gains a solid panel background once scrolled,
 * so the wordmark does not sit on a bar floating over the page.
 *
 * `scrolled` changes the BACKGROUND only, never the text colour. The bar is
 * sticky but not overlaid: it occupies its own row above the hero, so even
 * "transparent" means the page surface is behind it, never the sky. Both states
 * therefore sit on a themed background and both must use the themed text tokens.
 * (Colouring the unscrolled state for the sky instead puts white type on a pale
 * page in the light theme — invisible.)
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
  { href: "#theme", label: "Theme" },
  { href: "#register", label: "Register" },
  { href: "#sponsors", label: "Sponsors" },
  { href: "#contact", label: "Contact" },
] as const;

/**
 * Real routes, not in-page anchors. "About" used to scroll to a homepage
 * section; the team-credits page took over that label and destination, since
 * "who is running this" is what visitors actually expect from an About link.
 */
const PAGE_LINKS = [
  { href: "/about", label: "About" },
  { href: "/gallery", label: "Gallery" },
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
      <div className="flex w-full items-center justify-between gap-[var(--mc-unit)] px-[calc(var(--mc-unit)*1.5)] py-[calc(var(--mc-unit)*0.75)] md:px-[calc(var(--mc-unit)*2)] md:py-[var(--mc-unit)] min-[1320px]:grid min-[1320px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] min-[1320px]:gap-[calc(var(--mc-unit)*2)]">
        {/* Crest and wordmark are one link, not two adjacent ones — they are a
            single lockup, and two targets to the same anchor would just give a
            keyboard user a redundant stop. The crest is decorative here because
            the wordmark beside it already names the link. */}
        <a
          href="#top"
          className="flex min-h-11 min-w-11 shrink-0 items-center gap-[calc(var(--mc-unit)*0.75)] no-underline min-[1320px]:justify-self-start"
        >
          {/* Two crests, one shown. The gold mark is drawn for a dark ground
              and muddies against the light theme's sky, so that theme gets the
              black cut instead. The choice is made in CSS off `data-theme`
              rather than in React, because the bar is above the fold and a
              hydration-time swap is a visible flicker on every load — same
              mechanism, and same reason, as the theme toggle's own glyph.
              Both files are 1254² so the swap cannot shift the lockup. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ART.brand.gatewaysCrest.src}
            alt=""
            aria-hidden
            className="theme-only-dark h-10 w-auto shrink-0 md:h-12"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ART.brand.gatewaysCrestBlack.src}
            alt=""
            aria-hidden
            className="theme-only-light h-10 w-auto shrink-0 md:h-12"
          />
          {/* accent-STRONG, not accent. The bar sits on open sky in the light
              theme, and the mid amber that worked on a near-white page is the
              one accent that lands closest to the sky's own lightness — it goes
              soft exactly where the wordmark most needs to hold. The deeper
              bronze is the dark end of the same gold the crest beside it is
              drawn in, so the lockup still reads as one mark. */}
          <span className="whitespace-nowrap font-pixel text-[9px] uppercase tracking-[0.1em] text-mc-accent-strong max-[359px]:hidden md:text-[12px] md:tracking-[0.14em]">
            {FEST.shortEdition}
          </span>
        </a>

        {/* Desktop nav. Hidden rather than unmounted on mobile so there is only
            one source of truth for the link list. */}
        <nav aria-label="Main" className="hidden items-center justify-center gap-[calc(var(--mc-unit)*0.5)] min-[1320px]:flex">
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
          {PAGE_LINKS.map((a) => (
            <NavLink key={a.href} href={a.href} label={a.label} />
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-[calc(var(--mc-unit)*0.75)] md:gap-[calc(var(--mc-unit)*1.25)] min-[1320px]:justify-self-end">
          {/* Visible at every width, including mobile — a visitor who needs the
              light theme needs it on a phone too, and burying it in the menu
              modal would be the one control they have to go looking for. */}
          <ThemeToggle />

          <div className="min-[1320px]:hidden">
            <BlockButton
              variant="ghost"
              size="icon"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu aria-hidden size={20} strokeWidth={2.5} />
            </BlockButton>
          </div>

          {/* Separates the outbound university link from the in-page nav it now
              sits beside. Only meaningful once the nav is visible. */}
          <span aria-hidden className="hidden h-[20px] w-px bg-mc-border md:h-[26px] min-[1320px]:block" />

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
            className="hidden min-h-11 shrink-0 items-center sm:flex"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ART.brand.christUniversity.src}
              alt={`${FEST.host.university} — opens in a new tab`}
              // `university-mark` is what the light theme hooks to invert this.
              // The source art is white-on-transparent, drawn for the dark nav;
              // on the light theme's pale sky it is all but gone. See globals.css.
              className="university-mark h-8 w-auto opacity-90 transition-opacity hover:opacity-100 md:h-10 min-[1320px]:h-12"
            />
          </a>

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
          {PAGE_LINKS.map((a) => (
            <MenuLink key={a.href} href={a.href} label={a.label} onNavigate={() => setMenuOpen(false)} />
          ))}
          <a
            href={FEST.host.universityUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-center bg-mc-slot px-[calc(var(--mc-unit)*1.5)] py-[var(--mc-unit)] text-center font-pixel text-[10px] uppercase tracking-[0.08em] text-mc-text no-underline bevel-inset sm:hidden"
          >
            {FEST.host.university}
          </a>
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
    "bg-transparent px-[var(--mc-unit)] py-[calc(var(--mc-unit)*0.5)] font-pixel text-[10px] uppercase tracking-[0.1em] text-mc-text no-underline transition-colors hover:text-mc-eyebrow";

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
