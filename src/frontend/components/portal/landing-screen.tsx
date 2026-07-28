"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap, useGSAP } from "@/frontend/lib/animation/gsap-init";
import { BlockButton } from "@/frontend/components/mc";
import { AnimatedBackground } from "@/frontend/components/scene";
import { PortalFrame } from "./portal-frame";
import { usePortalTransition } from "./portal-transition-overlay";
import { applyReduceMotionAttribute } from "@/frontend/lib/animation/use-reduced-motion";

const TITLE = "PARALLAX";

const FOOTER_LINKS = [
  // "Home" first, and it is not optional: this screen is a full-viewport
  // cinematic with no nav bar, so without it the only way back to the fest
  // homepage is the browser's back button.
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/schedule", label: "Schedule" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/leaderboard", label: "Leaderboard" },
];

/**
 * SCREEN 2 — the portal gate, at `/portal`.
 *
 * Reached from the homepage's "Start the Journey". This is the threshold: the
 * page whose only job is to make stepping into the realm feel like a decision.
 * "Enter the Portal" fires the wipe into `/entering`, which then branches to
 * login, character creation, or the world.
 *
 * Reads top to bottom exactly as the design does: title, tagline, portal, CTA,
 * and a footer bar welded to the bottom edge. The portal sits *below* the
 * wordmark rather than above it, so the eye lands on the name first and is
 * then pulled down the stone path to the button.
 *
 * Entry animation: title letters stagger in, then the tagline, then the portal
 * rises, then the CTA. Initial hidden state comes from the `.gsap-hidden` CLASS
 * plus an inline transform, not a GSAP `.from()` — a `.from({opacity: 0})` runs
 * after hydration, so the SSR HTML paints visible and then snaps to hidden,
 * which is a visible flash. The class also has a reduced-motion escape hatch in
 * globals.css so content is never permanently invisible if JS fails.
 *
 * Those initial offsets are INLINE `transform`, deliberately, not Tailwind's
 * `translate-y-*` / `scale-*`: in Tailwind v4 those compile to the standalone
 * `translate` and `scale` properties, which stack on top of GSAP's `transform`
 * instead of being replaced by it — the element would settle 16px low forever.
 */
export function LandingScreen() {
  const root = useRef<HTMLDivElement>(null);
  const { navigateWithPortal } = usePortalTransition();

  // Apply a saved in-app motion preference before anything animates.
  useEffect(() => {
    applyReduceMotionAttribute();
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Reduced motion: reveal everything instantly, no choreography.
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(".gsap-hidden", { opacity: 1, y: 0, scale: 1 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

        tl.to(".landing-letter", {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.055,
        })
          .to(".landing-tagline", { opacity: 1, y: 0, duration: 0.5 }, "-=0.2")
          .to(
            ".landing-portal",
            { opacity: 1, y: 0, scale: 1, duration: 0.75, ease: "power2.out" },
            "-=0.3",
          )
          .to(".landing-cta", { opacity: 1, y: 0, duration: 0.45 }, "-=0.4")
          .to(".landing-footer", { opacity: 1, duration: 0.4 }, "-=0.2");

        return () => tl.kill();
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    // The scene owns the backdrop AND the parallax — the landing page used to
    // hand-roll a pointer listener here, which nothing else could reuse.
    <AnimatedBackground
      scene="portal-approach"
      className="flex flex-1 flex-col items-center justify-center px-[calc(var(--mc-unit)*2)] pb-[calc(var(--mc-unit)*7)] pt-[calc(var(--mc-unit)*3)]"
    >
      <div ref={root} className="flex w-full flex-col items-center">
        <h1 className="text-center text-[26px] leading-none sm:text-[40px] lg:text-[56px] 2xl:text-[68px]">
          {/* Per-letter spans for the stagger. aria-label carries the whole word
              so screen readers do not read it letter by letter. */}
          <span aria-label={TITLE} className="inline-flex flex-wrap justify-center">
            {TITLE.split("").map((ch, i) =>
              ch === " " ? (
                // A styled space would pick up the emboss for no reason; give
                // the word gap a plain fixed-width span instead.
                <span key={i} aria-hidden className="inline-block w-[0.55em]" />
              ) : (
                // Flat pale fill, NOT a `bg-clip-text` gradient. Painting order
                // makes those mutually exclusive: a clipped background is drawn
                // in the background phase, text-shadow in the text phase on top
                // of it — so the emboss covers the gradient completely and the
                // wordmark comes out near-black.
                <span
                  key={i}
                  aria-hidden
                  className="landing-letter gsap-hidden title-emboss inline-block text-mc-portal-pale"
                  style={{ transform: "translateY(16px)" }}
                >
                  {ch}
                </span>
              ),
            )}
          </span>
        </h1>

        <p
          className="landing-tagline gsap-hidden pixel-shadow mt-[calc(var(--mc-unit)*1.5)] text-center font-pixel text-[10px] uppercase tracking-[0.18em] text-white md:text-[13px]"
          style={{ transform: "translateY(12px)" }}
        >
          Another World Awaits
        </p>

        <div
          className="landing-portal gsap-hidden mt-[calc(var(--mc-unit)*3)]"
          style={{ transform: "translateY(24px) scale(0.94)" }}
        >
          <PortalFrame />
        </div>

        <div
          className="landing-cta gsap-hidden mt-[calc(var(--mc-unit)*3)]"
          style={{ transform: "translateY(12px)" }}
        >
          <BlockButton
            size="xl"
            variant="portal"
            onClick={() => navigateWithPortal("/entering")}
          >
            Enter the Portal
          </BlockButton>
        </div>

        {/* Welded to the bottom edge rather than flowing after the content, so
            it reads as a bar across the base of the scene at every viewport
            height. It stays INSIDE the scoped ref: `useGSAP({ scope: root })`
            only resolves selectors within it, so a footer parked outside would
            silently never be revealed and would sit at opacity 0 forever.
            The ref div is static, so `bottom-0` still resolves against the
            AnimatedBackground. */}
        <footer className="landing-footer gsap-hidden absolute inset-x-0 bottom-0 z-10 border-t-2 border-mc-obsidian-light/50 bg-mc-void/90 py-[calc(var(--mc-unit)*1.25)]">
          <nav
            aria-label="Site"
            className="flex flex-wrap justify-center gap-x-[calc(var(--mc-unit)*2.5)] gap-y-[var(--mc-unit)] px-[var(--mc-unit)]"
          >
            {FOOTER_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="font-pixel text-[9px] uppercase tracking-[0.12em] text-mc-text-dim no-underline transition-colors hover:text-mc-portal-light md:text-[10px]"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </footer>
      </div>
    </AnimatedBackground>
  );
}
