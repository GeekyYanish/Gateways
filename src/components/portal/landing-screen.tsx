"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap, useGSAP } from "@/lib/animation/gsap-init";
import { BlockButton } from "@/components/mc";
import { AnimatedBackground } from "@/components/scene";
import { PortalFrame } from "./portal-frame";
import { usePortalTransition } from "./portal-transition-overlay";
import { applyReduceMotionAttribute } from "@/lib/animation/use-reduced-motion";

const TITLE = "FEST REALM";

const FOOTER_LINKS = [
  { href: "/events", label: "Events" },
  { href: "/schedule", label: "Schedule" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/leaderboard", label: "Leaderboard" },
];

/**
 * SCREEN 1 — Landing.
 *
 * Entry animation: title letters stagger in, then the tagline and CTA. Initial
 * hidden state comes from the `.gsap-hidden` CLASS, not a GSAP `.from()` —
 * a `.from({opacity: 0})` runs after hydration, so the SSR HTML paints visible
 * and then snaps to hidden, which is a visible flash. The class also has a
 * reduced-motion escape hatch in globals.css so content is never permanently
 * invisible if JS fails.
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
        gsap.set(".gsap-hidden", { opacity: 1, y: 0 });
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
          .to(".landing-cta", { opacity: 1, y: 0, duration: 0.45 }, "-=0.25")
          .to(".landing-footer", { opacity: 1, duration: 0.4 }, "-=0.2");

        return () => tl.kill();
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    // The scene owns the backdrop AND the parallax now — the landing page used
    // to hand-roll a pointer listener here, which nothing else could reuse.
    <AnimatedBackground
      scene="portal-approach"
      className="flex flex-1 flex-col items-center justify-center px-[calc(var(--mc-unit)*2)] py-[calc(var(--mc-unit)*3)]"
    >
      <div ref={root} className="flex flex-col items-center">
        <div className="relative">
          <PortalFrame />
        </div>

      <h1 className="mt-[calc(var(--mc-unit)*2)] text-center text-2xl md:text-4xl lg:text-5xl">
        {/* Per-letter spans for the stagger. aria-label carries the whole word so
            screen readers do not read it letter by letter. */}
        <span aria-label={TITLE} className="inline-flex flex-wrap justify-center">
          {TITLE.split("").map((ch, i) => (
            <span
              key={i}
              aria-hidden
              className="landing-letter gsap-hidden inline-block translate-y-4 text-mc-portal-light"
              style={{ textShadow: "4px 4px 0 rgba(0,0,0,0.55)" }}
            >
              {ch === " " ? " " : ch}
            </span>
          ))}
        </span>
      </h1>

      <p className="landing-tagline gsap-hidden mt-[var(--mc-unit)] translate-y-3 text-center font-pixel text-[11px] uppercase tracking-widest text-mc-text-dim md:text-[13px]">
        Another World Awaits
      </p>

      <div className="landing-cta gsap-hidden mt-[calc(var(--mc-unit)*3)] translate-y-3">
        <BlockButton
          size="xl"
          variant="primary"
          onClick={() => navigateWithPortal("/entering")}
        >
          Enter the Portal
        </BlockButton>
      </div>

      <footer className="landing-footer gsap-hidden mt-[calc(var(--mc-unit)*5)]">
        <nav aria-label="Site" className="flex flex-wrap justify-center gap-[calc(var(--mc-unit)*2)]">
          {FOOTER_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-pixel text-[10px] uppercase tracking-wide text-mc-text-dim no-underline hover:text-mc-portal-light"
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
