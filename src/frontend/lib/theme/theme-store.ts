/**
 * Where the colour-theme choice is kept.
 *
 * This module deliberately has NO `"use client"` directive, and that is the
 * whole reason it exists separately from `use-theme.ts`.
 *
 * The KEY is read by the `beforeInteractive` boot script in the root layout —
 * a server component. A value imported from a `"use client"` module into a
 * server component is a client reference, not the string: interpolating it
 * server-side yields `undefined`, and the boot script silently degrades to
 * `localStorage.getItem(undefined)`. It still runs, still resolves a theme from
 * the media query, and still looks correct on every machine whose OS setting
 * happens to match — which is exactly why it is worth a separate file rather
 * than a comment. Anything the boot script needs belongs here.
 *
 * Same shape as `splash-store.ts`, for the same reason.
 */

export const THEME_STORAGE_KEY = "parallax:theme";

/** What the user asked for. `null` means "follow my system setting". */
export type ThemePreference = "light" | "dark" | null;
/** What is actually painted — always one or the other. */
export type ResolvedTheme = "light" | "dark";

export function readStoredTheme(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    /* ignore */
  }
  return null;
}

/** Resolve a preference against the OS setting. */
export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref) return pref;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}
