"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { gsap, useGSAP } from "@/frontend/lib/animation/gsap-init";
import { Lantern } from "@/frontend/components/portal/lantern";
import { PortalFrame } from "@/frontend/components/portal/portal-frame";
import { AnimatedBackground } from "@/frontend/components/scene";
import { useReducedMotion } from "@/frontend/lib/animation/use-reduced-motion";
import { useSession } from "@/frontend/components/auth/session-provider";
import { markCovering } from "@/frontend/lib/animation/transition-store";

const DURATION_MS = 2600;

/**
 * SCREEN 2 — "Entering the realm…"
 *
 * A real route rather than a pure overlay, because it gives the transition
 * somewhere to live while the destination's code and data load. It zooms into
 * the portal, then routes onward based on auth state:
 *   signed out        → /login
 *   no character yet  → /create-character
 *   fully set up      → /travelling
 *
 * Under reduced motion it redirects immediately with no animation.
 */
export function EnteringScreen() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { status } = useSession();
  const [progress, setProgress] = useState(0);

  const destination =
    status === "ready" ? "/travelling" : status === "needs-character" ? "/create-character" : "/login";

  // Warm the destination while the animation plays, so the push is instant.
  useEffect(() => {
    router.prefetch(destination);
  }, [router, destination]);

  useEffect(() => {
    // Wait for auth state to settle before committing to a destination —
    // redirecting on "loading" would send signed-in users to /login.
    if (status === "loading") return;

    if (reduced) {
      markCovering();
      router.replace(destination);
      return;
    }

    const started = performance.now();
    let frame = 0;

    const tick = () => {
      const elapsed = performance.now() - started;
      setProgress(Math.min(100, (elapsed / DURATION_MS) * 100));
      if (elapsed < DURATION_MS) {
        frame = requestAnimationFrame(tick);
      } else {
        markCovering();
        router.replace(destination);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced, router, destination, status]);

  useGSAP(
    () => {
      if (reduced) return;
      const tl = gsap.timeline();
      // Zoom into the portal aperture as though stepping through it.
      tl.to(".entering-portal", {
        scale: 2.6,
        opacity: 0.35,
        duration: DURATION_MS / 1000,
        ease: "power2.in",
      });
      return () => tl.kill();
    },
    { scope: root, dependencies: [reduced] },
  );

  return (
    <AnimatedBackground
      scene="portal-threshold"
      intensity={0.5}
      className="flex flex-1 flex-col items-center justify-center overflow-hidden"
    >
      <div ref={root} className="relative flex w-full flex-1 flex-col items-center justify-center">
        {/* Lanterns are siblings of the portal, not children: the portal is
            being zoomed into and they must stay put while it does. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[16%] top-[46%] flex items-stretch justify-between px-[7vw] md:px-[13vw]">
          <Lantern side="left" />
          <Lantern side="right" />
        </div>

        <div className="entering-portal relative z-10">
          <PortalFrame intensity={1.6} />
        </div>

        <div className="absolute bottom-[9%] z-20 flex w-full max-w-[380px] flex-col items-center gap-[calc(var(--mc-unit)*1.25)] px-[calc(var(--mc-unit)*2)]">
          <p
            role="status"
            className="pixel-shadow font-pixel text-[10px] uppercase tracking-[0.16em] text-mc-text md:text-[11px]"
          >
            Entering the realm…
          </p>
          <div
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Entering the realm"
            className="h-[calc(var(--mc-unit)*0.9)] w-full overflow-hidden bg-mc-slot bevel-inset"
          >
            <div
              className="h-full origin-left bg-mc-portal-light"
              style={{ transform: `scaleX(${progress / 100})` }}
            />
          </div>
        </div>
      </div>
    </AnimatedBackground>
  );
}
