"use client";

import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

/**
 * The ONLY place GSAP plugins are registered.
 *
 * Registering at module scope in a shared file runs during SSR, where `document`
 * does not exist; doing it in several files double-registers. One client-only
 * module, imported everywhere, avoids both.
 *
 * Always import { gsap, useGSAP } FROM HERE, never from "gsap" directly — that
 * is what guarantees registration has happened.
 *
 * `useGSAP` is mandatory over a bare useEffect + gsap.to: it wraps the callback
 * in gsap.context() and reverts on unmount. Without it, React StrictMode's
 * double-invoke leaves two tweens fighting over one element, so animations play
 * at double speed or strand inline styles. See ANIMATION.md.
 */
gsap.registerPlugin(useGSAP);

/** Respect the user's motion preference at the GSAP level. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.reduceMotion === "true"
  );
}

export { gsap, useGSAP };
