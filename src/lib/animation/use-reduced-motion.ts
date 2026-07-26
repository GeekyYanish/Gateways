"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "festrealm:reduce-motion";

/**
 * Live reduced-motion preference.
 *
 * Two sources, either of which wins:
 *  1. the OS setting (`prefers-reduced-motion: reduce`)
 *  2. the in-app toggle, persisted and reflected as `data-reduce-motion` on <html>
 *
 * The in-app toggle exists because plenty of people who get motion sick have
 * never found the OS setting — relying on the media query alone silently fails
 * exactly the users it is meant to protect.
 *
 * The initial state is `false` on purpose: it must match what the server
 * rendered, or hydration mismatches. The effect corrects it on the first client
 * pass, and CSS (which does not wait for JS) already handles the OS case.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

    const compute = () => {
      const stored = readStoredPreference();
      setReduced(stored ?? mq.matches);
    };

    compute();
    mq.addEventListener("change", compute);
    // Another tab may flip the stored preference.
    window.addEventListener("storage", compute);
    return () => {
      mq.removeEventListener("change", compute);
      window.removeEventListener("storage", compute);
    };
  }, []);

  return reduced;
}

function readStoredPreference(): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    /* ignore */
  }
  return null;
}

/** Persist the in-app toggle and reflect it on <html> for the CSS rules. */
export function setReduceMotionPreference(value: boolean | null): void {
  try {
    if (value === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    /* ignore */
  }
  applyReduceMotionAttribute();
}

/**
 * Sync the <html> attribute from the stored preference. Called on app mount so
 * a saved preference applies before any animation runs.
 */
export function applyReduceMotionAttribute(): void {
  if (typeof document === "undefined") return;
  const stored = readStoredPreference();
  if (stored === true) {
    document.documentElement.setAttribute("data-reduce-motion", "true");
  } else {
    // Removing (rather than setting "false") lets the OS media query decide.
    document.documentElement.removeAttribute("data-reduce-motion");
  }
}

export function getStoredReduceMotion(): boolean | null {
  return readStoredPreference();
}
