"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { gsap, useGSAP } from "@/frontend/lib/animation/gsap-init";
import { useReducedMotion } from "@/frontend/lib/animation/use-reduced-motion";
import { consumeTransition, markCovering } from "@/frontend/lib/animation/transition-store";

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
  const pathname = usePathname();
  const navigating = useRef(false);

  // Reveal on arrival.
  //
  // Keyed on `pathname`, NOT on mount alone. Within a single route group the
  // App Router keeps this provider mounted across a navigation, so a
  // mount-only read never fires again: the overlay faded to opaque to cover
  // the push and then stayed opaque forever. That is what made /portal →
  // /entering a flat purple screen — the portal zoom and the "Entering the
  // realm…" progress bar were playing the whole time, behind the wipe.
  //
  // `consumeTransition` is read-and-clear, so it also stops a stale flag from
  // being inherited by a later plain navigation.
  //
  // Reading here rather than during render is safe: useGSAP runs in a layout
  // effect, which commits before the browser paints, so the overlay is already
  // opaque on the first painted frame and the destination never flashes.
  useGSAP(
    () => {
      const el = overlay.current;
      if (!el) return;

      const arriving = consumeTransition();

      if (!arriving || reduced) {
        gsap.set(el, { autoAlpha: 0 });
        return;
      }

      gsap.set(el, { autoAlpha: 1 });
      // pointer-events are restored by autoAlpha reaching 0 (visibility hidden).
      const tween = gsap.to(el, {
        autoAlpha: 0,
        duration: 0.5,
        ease: "power2.inOut",
      });
      return () => tween.kill();
    },
    { dependencies: [pathname, reduced] },
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
          /*
            A DARK wipe, not a purple one.

            It used to be a bright violet radial — the idea was a portal opening
            — but this covers the screen for the better part of a second on
            every transition, and the eye reads a full-viewport flash of
            saturated light as a fault rather than as choreography. The zoom
            itself already carries the portal; the cover only has to hide the
            route swap behind it, and it does that just as well in near-black
            while being far easier to look at.
          */
          background:
            "radial-gradient(circle at 50% 50%, #1a1430 0%, #100c1f 45%, #06040d 100%)",
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
