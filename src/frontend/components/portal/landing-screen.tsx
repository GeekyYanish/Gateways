"use client";

import { useEffect, useRef } from "react";
import { gsap, useGSAP } from "@/frontend/lib/animation/gsap-init";
import { BlockButton } from "@/frontend/components/mc/block-button";
import { AnimatedBackground } from "@/frontend/components/scene";
import { PortalFrame } from "./portal-frame";
import { usePortalTransition } from "./portal-transition-overlay";
import { applyReduceMotionAttribute } from "@/frontend/lib/animation/use-reduced-motion";

const TITLE = "PARALLAX";

/**
 * Legacy portal gate at `/portal`.
 *
 * The homepage leads here before authentication. Entering the portal opens the
 * zoom transition, which sends signed-out visitors to login. Successful login
 * continues through `/travelling` and into the realm.
 */
export function LandingScreen() {
  const root = useRef<HTMLDivElement>(null);
  const { navigateWithPortal } = usePortalTransition();

  useEffect(() => {
    applyReduceMotionAttribute();
  }, []);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

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
          .to(".landing-cta", { opacity: 1, y: 0, duration: 0.45 }, "-=0.4");

        return () => tl.kill();
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <AnimatedBackground
      scene="portal-approach"
      className="flex flex-1 flex-col items-center justify-center px-[calc(var(--mc-unit)*2)] pb-[calc(var(--mc-unit)*7)] pt-[calc(var(--mc-unit)*3)]"
    >
      <div ref={root} className="flex w-full flex-col items-center">
        <h1 className="text-center text-[26px] leading-none sm:text-[40px] lg:text-[56px] 2xl:text-[68px]">
          <span aria-label={TITLE} className="inline-flex flex-wrap justify-center">
            {TITLE.split("").map((character, index) =>
              character === " " ? (
                <span key={index} aria-hidden className="inline-block w-[0.55em]" />
              ) : (
                <span
                  key={index}
                  aria-hidden
                  className="landing-letter gsap-hidden title-emboss inline-block text-mc-portal-pale"
                  style={{ transform: "translateY(16px)" }}
                >
                  {character}
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
      </div>
    </AnimatedBackground>
  );
}
