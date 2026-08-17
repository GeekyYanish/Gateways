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
  // { href: "#sponsors", label: "Sponsors" },
] as const;

/**
 * Real routes, not in-page anchors. "About" used to scroll to a homepage
 * section; the team-credits page took over that label and destination, since
 * "who is running this" is what visitors actually expect from an About link.
 */
const PAGE_LINKS = [
  { href: "/about", label: "About" },
  { href: "/gallery", label: "Gallery" },
  { href: "/contact", label: "Contact" },
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
          {/* Only while the full nav is up. Below that the bar is three controls
              wide on a phone, and the university mark — which identifies whose
              fest this is — loses to a control that has a perfectly good home
              inside the menu. The toggle moves there at exactly the width the
              hamburger appears, so there is one rule rather than two
              overlapping ones, and it is never absent from both places. */}
          <ThemeToggle className="hidden min-[1320px]:inline-flex" />

          {/* Separates the toggle from the outbound university mark. Only
              meaningful at full width, where both are in the bar. */}
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
            className="flex min-h-11 shrink-0 items-center"
            // The name lives on the LINK, not on either image. Only one of the
            // two renders at a given width and the other is `display:none`, so a
            // name carried by an `alt` would vanish at whichever breakpoint hid
            // that copy. Both images are decorative as a result.
            aria-label={`${FEST.host.university} — opens in a new tab`}
          >
            {/*
              SEAL ONLY, below `sm`.

              The same collapse the Gateways lockup makes on the left — mark
              without wordmark once there is no room — but it has to be done
              differently. That lockup is two elements, an image plus a text
              span, so the span simply hides. This is ONE image with the
              lettering baked in, and there is no seal-only file.

              So the seal is cropped out of the full artwork instead: a square
              box with `overflow-hidden`, and the image at full height with
              `w-auto max-w-none` so it overflows to its natural 2.95:1 and only
              the leftmost square — the seal — is visible. No second asset to
              keep in sync, and it stays correct if the wordmark is ever
              re-exported at a different width.
            */}
            <span
              aria-hidden
              className="block h-8 w-8 shrink-0 overflow-hidden sm:hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ART.brand.christUniversity.src}
                alt=""
                className="university-mark h-full w-auto max-w-none object-left opacity-90 transition-opacity hover:opacity-100"
              />
            </span>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ART.brand.christUniversity.src}
              alt=""
              // `university-mark` is what the light theme hooks to invert this.
              // The source art is white-on-transparent, drawn for the dark nav;
              // on the light theme's pale sky it is all but gone. See globals.css.
              className="university-mark hidden h-8 w-auto opacity-90 transition-opacity hover:opacity-100 sm:block md:h-10 min-[1320px]:h-12"
            />
          </a>

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
          {/* The theme switch, which the bar gives up below 1320px. Kept at the
              TOP rather than buried under the links: it is the one item here
              that is not navigation, and someone opening the menu to change the
              theme should not have to read past six destinations to find it.

              Labelled "Appearance", NOT "Theme" — the list already contains a
              "Theme" link, and that one means this year's subject (Digital
              Twins), not the colour scheme. Two identically-named rows doing
              unrelated things is worse than a slightly longer word. */}
          <div className="flex items-center justify-between gap-[var(--mc-unit)] bg-mc-slot px-[calc(var(--mc-unit)*1.5)] py-[var(--mc-unit)] bevel-inset min-[1320px]:hidden">
            <span className="font-pixel text-[10px] uppercase tracking-[0.08em] text-mc-text">
              Appearance
            </span>
            <ThemeToggle />
          </div>

          {ANCHORS.slice(0, 2).map((a) => (
            <MenuLink key={a.href} href={a.href} label={a.label} onNavigate={() => setMenuOpen(false)} />
          ))}
          <MenuLink label="Events" onNavigate={() => setMenuOpen(false)} onClick={onOpenEvents} />
          <MenuLink label="Schedule" onNavigate={() => setMenuOpen(false)} onClick={onOpenSchedule} />
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

/**
 * One row of the mobile menu — an anchor when it navigates, a button when it
 * opens a modal, styled identically either way.
 *
 * The same reasoning as `NavLink` above. Events and Schedule were `BlockButton
 * variant="stone"`, which rendered them as raised grey slabs among six inset
 * dark ones: two of seven items looked like the only pressable things in the
 * list, when in fact every row does something. The difference between "goes to
 * a page" and "opens a modal" is not a difference the visitor needs signalled,
 * and signalling it with the loudest control in the design system oversold it.
 */
function MenuLink({
  href,
  label,
  onNavigate,
  onClick,
}: {
  href?: string;
  label: string;
  onNavigate: () => void;
  onClick?: () => void;
}) {
  const className =
    "block w-full bg-mc-slot px-[calc(var(--mc-unit)*1.5)] py-[calc(var(--mc-unit)*1.25)] text-center font-pixel text-[11px] uppercase tracking-[0.1em] text-mc-text no-underline bevel-inset";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={() => {
          onNavigate();
          onClick();
        }}
        className={cn(className, "cursor-pointer border-0")}
      >
        {label}
      </button>
    );
  }

  return (
    <a href={href} onClick={onNavigate} className={className}>
      {label}
    </a>
  );
}
