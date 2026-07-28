/**
 * Cross-route transition state.
 *
 * The portal overlay must stay opaque across a navigation: fade to opaque on the
 * old route, navigate, then fade out on the new one. Module state alone is not
 * enough — crossing an App Router route-group boundary (e.g. `(portal)` →
 * `(realm)`) remounts the layout and resets it. sessionStorage survives that
 * while still being scoped to the tab.
 */

const KEY = "parallax:transition";

export type TransitionState = "none" | "covering" | "revealing";

export function markCovering(): void {
  try {
    sessionStorage.setItem(KEY, "covering");
  } catch {
    // Private mode. The transition degrades to a plain navigation, which is fine.
  }
}

/**
 * Read-and-clear. Called by the destination on mount: if a transition was in
 * flight, the overlay starts opaque and fades out. Clearing prevents a later
 * plain navigation from inheriting a stale flag.
 */
export function consumeTransition(): boolean {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v === "covering") {
      sessionStorage.removeItem(KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function clearTransition(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
