"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { gsap, useGSAP } from "@/lib/animation/gsap-init";
import { useReducedMotion } from "@/lib/animation/use-reduced-motion";
import { consumeTransition, markCovering } from "@/lib/animation/transition-store";

/**
 * Portal wipe between routes.
 *
 * THE PROBLEM: the naive approach — animate out, `router.push`, animate in —
 * tears, because App Router unmounts the old tree the instant navigation
 * commits, cutting the exit animation off mid-flight.
 *
 * THE FIX: cover first, then navigate. A fixed overlay fades to opaque, and only
 * once it is covering the viewport do we push. The destination reads a
 * sessionStorage flag on mount, starts opaque, and fades out. Any layout thrash
 * during the swap happens behind an opaque surface, so it is invisible.
 *
 * sessionStorage rather than module state because crossing a route-group
 * boundary remounts the layout and would reset a module variable.
 */

interface TransitionContextValue {
  /** Cover the screen, then navigate. Falls back to a plain push if reduced. */
  navigateWithPortal: (href: string) => void;
}

const TransitionContext = createContext<TransitionContextValue | null>(null);

export function PortalTransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const overlay = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  // Start opaque when arriving mid-transition, so there is no flash of the new
  // route before the reveal. Read during the first render, not in an effect.
  const [arriving] = useState(() => consumeTransition());
  const navigating = useRef(false);

  // Reveal on arrival.
  useGSAP(
    () => {
      const el = overlay.current;
      if (!el) return;

      if (!arriving) {
        gsap.set(el, { autoAlpha: 0 });
        return;
      }

      if (reduced) {
        gsap.set(el, { autoAlpha: 0 });
        return;
      }

      gsap.set(el, { autoAlpha: 1 });
      gsap.to(el, {
        autoAlpha: 0,
        duration: 0.5,
        ease: "power2.inOut",
        // pointer-events are restored by autoAlpha reaching 0 (visibility hidden).
      });
    },
    { dependencies: [arriving, reduced] },
  );

  const navigateWithPortal = useCallback(
    (href: string) => {
      // Guard against a double-click firing two navigations.
      if (navigating.current) return;
      navigating.current = true;

      // Warm the destination so the push is not waiting on a chunk fetch.
      router.prefetch(href);

      if (reduced || !overlay.current) {
        markCovering();
        router.push(href);
        return;
      }

      gsap.to(overlay.current, {
        autoAlpha: 1,
        duration: 0.65,
        ease: "power2.in",
        onComplete: () => {
          markCovering();
          router.push(href);
        },
      });
    },
    [reduced, router],
  );

  // Reset the guard when the route actually changes, so a later navigation works.
  useEffect(() => {
    navigating.current = false;
  });

  return (
    <TransitionContext.Provider value={{ navigateWithPortal }}>
      {children}
      <div
        ref={overlay}
        aria-hidden
        className="fixed inset-0 z-[100] pointer-events-none"
        style={{
          // Radial purple wipe, brightest at the centre like a portal opening.
          background:
            "radial-gradient(circle at 50% 50%, #c964ff 0%, #a02ce0 28%, #3d1259 62%, #0b0710 100%)",
          // Hidden initially so it never blocks the first paint; GSAP's autoAlpha
          // manages visibility from here.
          visibility: "hidden",
          opacity: 0,
        }}
      />
    </TransitionContext.Provider>
  );
}

/**
 * Navigate with the portal wipe. Safe to call outside the provider — it falls
 * back to a normal push rather than throwing, so a component can be reused on a
 * page that has no overlay.
 */
export function usePortalTransition(): TransitionContextValue {
  const ctx = useContext(TransitionContext);
  const router = useRouter();
  if (ctx) return ctx;
  return { navigateWithPortal: (href: string) => router.push(href) };
}
