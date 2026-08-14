"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap, useGSAP } from "@/frontend/lib/animation/gsap-init";
import { BlockButton } from "@/frontend/components/mc";
import { usePortalTransition } from "./portal-transition-overlay";
import { applyReduceMotionAttribute } from "@/frontend/lib/animation/use-reduced-motion";
import { PortalCreeper } from "./portal-creeper";
import styles from "./portal-landing.module.css";

const TITLE = "PARALLAX";

const PortalWorld = dynamic(
  () => import("./portal-world").then((module) => module.PortalWorld),
  {
    ssr: false,
    loading: () => <div aria-hidden className={styles.canvasLoading} />,
  },
);

/**
 * SCREEN 2 — the portal gate, at `/portal`.
 *
 * Reached from the homepage's "Start the Journey". This is the threshold: the
 * page whose only job is to make stepping into the realm feel like a decision.
 * "Enter the Portal" fires the wipe into `/entering`, which then branches to
 * login or the world.
 *
 * Reads top to bottom exactly as the design does: title, tagline, portal, CTA.
 * The portal sits *below* the wordmark rather than above it, so the eye lands
 * on the name first and is then pulled down the stone path to the button.
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
  const [energized, setEnergized] = useState(false);
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
          .to(".landing-marker", { opacity: 1, y: 0, duration: 0.6 }, "-=0.3")
          .to(
            ".landing-creeper",
            { opacity: 1, x: 0, scale: 1, duration: 0.65 },
            "-=0.5",
          )
          .to(".landing-cta", { opacity: 1, y: 0, duration: 0.45 }, "-=0.4");

        return () => tl.kill();
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <main
      ref={root}
      className={styles.stage}
      data-energized={energized ? "true" : "false"}
    >
      <div className={styles.canvas}>
        <PortalWorld energized={energized} />
      </div>

      <div aria-hidden className={styles.skyWash} />
      <div aria-hidden className={styles.aurora} />
      <div aria-hidden className={styles.portalBloom} />
      <div aria-hidden className={styles.mist} />

      <p aria-hidden className={`${styles.telemetry} ${styles.telemetryLeft}`}>
        Realm anchor // 01
      </p>
      <p aria-hidden className={`${styles.telemetry} ${styles.telemetryRight}`}>
        Rift stability // 98.7%
      </p>

      <PortalCreeper side="left" />
      <PortalCreeper side="right" />

      <div className={styles.content}>
        <header className={styles.heading}>
          <p className={`${styles.eyebrow} landing-tagline gsap-hidden`}>
            Gateways 2026 // Realm one
          </p>
          <h1 aria-label={TITLE} className={styles.title}>
            {/* Per-letter spans for the stagger. aria-label carries the whole word
                so screen readers do not read it letter by letter. */}
            <span aria-hidden className="inline-flex flex-wrap justify-center">
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
                  // The fill comes from `styles.titleLetter`, not a
                  // `text-mc-*` class: portal-pale is drawn for a night sky and
                  // disappears against the light theme's daylight gate, and the
                  // rest of this screen's palette already themes from the CSS
                  // module. One source per surface.
                  <span
                    key={i}
                    aria-hidden
                    className={`${styles.titleLetter} landing-letter gsap-hidden title-emboss inline-block`}
                    style={{ transform: "translateY(16px)" }}
                  >
                    {ch}
                  </span>
                ),
              )}
            </span>
          </h1>

          <p
            className={`${styles.tagline} landing-tagline gsap-hidden`}
            style={{ transform: "translateY(12px)" }}
          >
            Another world awaits beyond the veil
          </p>
        </header>

        <p
          aria-hidden
          className={`${styles.portalMarker} landing-marker gsap-hidden`}
          style={{ transform: "translateY(12px)" }}
        >
          Dimensional gateway online
        </p>

        <div
          className={`${styles.actions} landing-cta gsap-hidden`}
          style={{ transform: "translateY(12px)" }}
        >
          <BlockButton
            size="xl"
            variant="portal"
            className={styles.enterButton}
            onPointerEnter={() => setEnergized(true)}
            onPointerLeave={() => setEnergized(false)}
            onFocus={() => setEnergized(true)}
            onBlur={() => setEnergized(false)}
            onClick={() => navigateWithPortal("/entering")}
          >
            Enter the Portal
          </BlockButton>
          <p className={styles.hint}>Click to cross the threshold</p>
        </div>
      </div>

      <div aria-hidden className={styles.vignette} />
      <div aria-hidden className={styles.scanlines} />
    </main>
  );
}
