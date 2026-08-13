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
