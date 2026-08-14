"use client";

import { useEffect, useState } from "react";
import {
  readStoredTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme-store";

export type { ResolvedTheme, ThemePreference };

/**
 * Same-window broadcast for theme changes.
 *
 * `useTheme` is a hook with per-call-site `useState`, not a context — so there
 * is one independent copy of `resolved` per consumer. `setPreference` updates
 * the copy belonging to whichever component was clicked, writes localStorage
 * and re-stamps `data-theme`; every OTHER consumer is left holding a stale
 * value.
 *
 * That is invisible for anything themed in CSS, because those key off the
 * attribute. It is very visible for anything that branches on `resolved` in JS
 * — `BiomeScene`'s `lightScene` being the case that bit us: switching to the
 * light theme repainted every token to cream and left the Digital Twins card
 * showing the NIGHT workshop until the next full reload.
 *
 * `storage` cannot cover this: the spec fires it in other tabs only, never in
 * the window that performed the write. So the writer announces it explicitly
 * and every instance listens.
 */
const THEME_EVENT = "parallax:themechange";

/**
 * Live colour-theme preference.
 *
 * Deliberately the same shape as `use-reduced-motion.ts`: two sources (the OS
 * setting and an in-app override), the override persisted to localStorage and
 * reflected as an attribute on <html> for CSS to key off. Anything that reads
 * one of these preferences should read the other the same way.
 *
 * The difference is which way "no stored value" resolves. Reduced motion is a
 * safety preference, so the media query wins outright and CSS can handle it
 * without JS at all. A theme has to resolve to exactly one of two states before
 * first paint, so the boot script in the root layout always stamps the resolved
 * value — see THEME_BOOT there. That is what lets globals.css carry a single
 * `html[data-theme="light"]` block instead of duplicating every token into a
 * `prefers-color-scheme` media query.
 */
export function useTheme(): {
  /** What the user chose. `null` = following the system. */
  preference: ThemePreference;
  /** What is on screen right now. */
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
} {
  const [preference, setPreferenceState] = useState<ThemePreference>(null);
  // Must match what the server rendered or hydration mismatches. "dark" is the
  // right initial guess because it is what the markup is authored against; the
  // effect below corrects it on the first client pass, and the boot script has
  // already painted the correct theme regardless.
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");

    const compute = () => {
      const stored = readStoredTheme();
      setPreferenceState(stored);
      setResolved(stored ?? (mq.matches ? "light" : "dark"));
      /**
       * Re-stamp <html>, or CSS and JS drift apart.
       *
       * `data-theme` is written once by THEME_BOOT at load and then only by
       * `setPreference`. Neither covers the two events this effect listens to:
       * the OS flipping while the visitor follows the system, and another tab
       * toggling the stored preference. Both moved `resolved` — which is what
       * picks a component's theme variant, e.g. `BiomeScene`'s `lightScene` —
       * while leaving every themed token on the old value.
       *
       * The result is a page wearing one theme's colours and the other theme's
       * art: dark violet panels in front of the pale daylight workshop, or the
       * cream ones in front of the night workshop. On mount this is a no-op,
       * since the boot script has already stamped the same value.
       */
      applyThemeAttribute();
    };

    compute();
    mq.addEventListener("change", compute);
    // Another tab may flip the stored preference.
    window.addEventListener("storage", compute);
    // THIS tab may flip it too — see THEME_EVENT.
    window.addEventListener(THEME_EVENT, compute);
    return () => {
      mq.removeEventListener("change", compute);
      window.removeEventListener("storage", compute);
      window.removeEventListener(THEME_EVENT, compute);
    };
  }, []);

  return {
    preference,
    resolved,
    setPreference: (next) => {
      setThemePreference(next);
      setPreferenceState(next);
      setResolved(resolveTheme(next));
    },
  };
}

/** Persist the choice and repaint. Pass `null` to go back to following the OS. */
export function setThemePreference(value: ThemePreference): void {
  try {
    if (value === null) localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
  applyThemeAttribute();
  // Wake every other `useTheme` in this window; `storage` never will.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(THEME_EVENT));
  }
}

/**
 * Sync the <html> attribute from the stored preference.
 *
 * Unlike `applyReduceMotionAttribute`, this always SETS the attribute rather
 * than removing it when following the system — the CSS has no media-query
 * fallback to fall back to, by design.
 */
export function applyThemeAttribute(): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolveTheme(readStoredTheme()));
}

export function getStoredTheme(): ThemePreference {
  return readStoredTheme();
}
