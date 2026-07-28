"use client";

import { useEffect, useRef } from "react";
import { gsap, useGSAP } from "@/frontend/lib/animation/gsap-init";
import { AnimatedBackground } from "@/frontend/components/scene";
import { applyReduceMotionAttribute } from "@/frontend/lib/animation/use-reduced-motion";
import { FEST } from "@/frontend/lib/fest";
import { Countdown } from "./countdown";
import { SkyAnnouncements } from "./sky-announcements";
import { ScrollCue } from "./scroll-cue";

const TITLE = "PARALLAX";

/**
 * SCREEN 1 — the hero.
 *
 * The backdrop is a sunlit overworld that pans continuously, the way a voxel
 * game's title screen sweeps across a landscape: the visitor arrives to a world
 * already in motion. All of that motion lives in the `overworld-panorama` scene
 * definition (`scenes.ts`) rather than here — the layers, their drift rates and
 * their depths are data, so retuning the pan is a one-line edit and needs no
 * component change.
 *
 * There is deliberately **no call to action in this section**. The portal is
 * the one irreversible thing on the page, and asking for it before the visitor
 * knows what Gateways is or what a digital twin means gets a bounce, not a
 * signup. "Start the Journey" lives further down, at the end of the Parallax
 * section, where the metaphor has just been explained.
 *
 * Entry animation: the edition line, then the title letters staggering in, then
 * the tagline and the countdown. Initial hidden state comes from the
 * `.gsap-hidden` CLASS plus an inline transform, not a GSAP `.from()` — a
 * `.from({opacity: 0})` runs after hydration, so the SSR HTML paints visible
 * and then snaps to hidden, which is a visible flash. The class also has a
 * reduced-motion escape hatch in globals.css so content is never permanently
 * invisible if JS fails.
 *
 * Those initial offsets are INLINE `transform`, deliberately, not Tailwind's
 * `translate-y-*` / `scale-*`: in Tailwind v4 those compile to the standalone
 * `translate` and `scale` properties, which stack on top of GSAP's `transform`
 * instead of being replaced by it — the element would settle 16px low forever.
 */
export function HeroSection() {
  const root = useRef<HTMLDivElement>(null);

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

        tl.to(".landing-edition", { opacity: 1, y: 0, duration: 0.4 })
          .to(
            ".landing-letter",
            { opacity: 1, y: 0, duration: 0.5, stagger: 0.055 },
            "-=0.2",
          )
          .to(".landing-tagline", { opacity: 1, y: 0, duration: 0.5 }, "-=0.2")
          .to(".landing-countdown", { opacity: 1, y: 0, duration: 0.5 }, "-=0.25")
          .to(".landing-scroll-cue", { opacity: 1, duration: 0.4 }, "-=0.1");

        return () => tl.kill();
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    // The scene owns the backdrop, the pan AND the parallax. `scrollParallax`
    // additionally shifts the layers as the page scrolls, which only makes
    // sense now that the hero has content below it.
    <AnimatedBackground
      scene="overworld-panorama"
      scrollParallax
      className="flex min-h-[100svh] flex-col items-center justify-center px-[calc(var(--mc-unit)*2)] pb-[calc(var(--mc-unit)*6)] pt-[calc(var(--mc-unit)*6)]"
    >
      {/* Sits between the scene layers and the hero copy, so the announcements
          read as hanging in the sky rather than printed over the page. */}
      <SkyAnnouncements />

      <div ref={root} className="relative z-10 flex w-full flex-col items-center">
        <p
          className="landing-edition gsap-hidden pixel-shadow mb-[calc(var(--mc-unit)*1.5)] text-center font-pixel text-[9px] uppercase tracking-[0.3em] text-mc-gold md:text-[12px]"
          style={{ transform: "translateY(10px)" }}
        >
          {FEST.shortEdition}
        </p>

        <h1 className="text-center text-[30px] leading-none sm:text-[46px] lg:text-[64px] 2xl:text-[78px]">
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
          className="landing-tagline gsap-hidden pixel-shadow mt-[calc(var(--mc-unit)*2)] max-w-[46ch] text-center text-[18px] leading-snug text-white md:text-[23px]"
          style={{ transform: "translateY(12px)" }}
        >
          {FEST.theme.tagline}
        </p>

        <div
          className="landing-countdown gsap-hidden mt-[calc(var(--mc-unit)*3)] flex flex-col items-center gap-[var(--mc-unit)]"
          style={{ transform: "translateY(12px)" }}
        >
          <p className="pixel-shadow font-pixel text-[9px] uppercase tracking-[0.18em] text-white md:text-[11px]">
            {FEST.dateLabel}
          </p>
          <Countdown targetIso={FEST.datesIso.start} />
        </div>

        {/* Tells the visitor there is more below the fold. Decorative only —
            the nav already provides real routes to every section. */}
        <ScrollCue className="landing-scroll-cue gsap-hidden mt-[calc(var(--mc-unit)*3)]" />
      </div>
    </AnimatedBackground>
  );
}
