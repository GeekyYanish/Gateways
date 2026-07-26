"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { gsap, useGSAP } from "@/lib/animation/gsap-init";
import { PortalFrame } from "@/components/portal/portal-frame";
import { AnimatedBackground } from "@/components/scene";
import { useReducedMotion } from "@/lib/animation/use-reduced-motion";
import { useSession } from "@/components/auth/session-provider";
import { markCovering } from "@/lib/animation/transition-store";

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
      scene="void-transit"
      intensity={0.7}
      className="flex flex-1 flex-col items-center justify-center"
    >
      <div ref={root} className="flex flex-1 flex-col items-center justify-center w-full">
      <div className="entering-portal">
        <PortalFrame intensity={1.6} />
      </div>

      <div className="absolute bottom-[18%] flex w-full max-w-[380px] flex-col items-center gap-[var(--mc-unit)] px-[calc(var(--mc-unit)*2)]">
        <p
          role="status"
          className="font-pixel text-[11px] uppercase tracking-widest text-mc-text"
        >
          Entering the realm…
        </p>
        <div className="h-[calc(var(--mc-unit)*1)] w-full bg-mc-slot bevel-inset overflow-hidden">
          <div
            className="h-full bg-mc-portal-light origin-left"
            style={{ transform: `scaleX(${progress / 100})` }}
          />
        </div>
      </div>
      </div>
    </AnimatedBackground>
  );
}
