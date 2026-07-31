"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Tracks how deep into the app the visitor has navigated, so "Back" can tell
 * "somewhere else in Parallax" from "wherever they came from before arriving".
 *
 * WHY THIS EXISTS AT ALL: `<BackLink>` wants to call `router.back()` when there
 * is app history and follow its explicit href when there is not — otherwise a
 * visitor arriving from an email, a QR code or a search result gets thrown out
 * of the site by a control that looks like it belongs to it.
 *
 * The usual trick is to read `history.state.idx`, which the Pages Router and
 * older App Router versions maintained. **Next 16 does not set it.** Its history
 * state is `{ __NA, __PRIVATE_NEXTJS_INTERNALS_TREE }` and nothing else — so any
 * `idx` check silently reads `undefined`, decides there is no history, and the
 * back button quietly never works. (Verified against 16.2.11; this is the sort
 * of thing AGENTS.md is warning about.)
 *
 * So we stamp our own cursor. It lives ON each history entry rather than in a
 * module counter, which is what makes back and forward work correctly: returning
 * to an earlier entry restores that entry's number instead of continuing to
 * count upward.
 *
 * A full page load starts the cursor at 0 again, which is the honest answer —
 * whatever preceded a fresh document is not ours to go back to.
 */

const CURSOR = "__parallaxIdx";

/** Highest cursor issued in this document. Entry-local state is the source of truth. */
let issued = 0;

export function HistoryCursor() {
  const pathname = usePathname();

  useEffect(() => {
    const state = (window.history.state ?? {}) as Record<string, unknown>;
    const existing = state[CURSOR];

    if (typeof existing === "number") {
      // Back/forward onto an entry we already stamped — adopt its number rather
      // than issuing a new one, or every back would look like a step forward.
      issued = existing;
      return;
    }

    // A new entry. The first one in the document is 0; anything after it is a
    // push we made ourselves, so there is something to go back to.
    issued = window.history.length > 0 && hasStampedBefore() ? issued + 1 : 0;
    markStamped();

    // Spread Next's own state through — it holds the router tree, and replacing
    // it wholesale would break client-side navigation.
    window.history.replaceState({ ...state, [CURSOR]: issued }, "");
  }, [pathname]);

  return null;
}

/**
 * Has this document stamped any entry yet? Distinguishes the very first mount
 * (cursor 0) from a genuine push (cursor 1+). A module flag rather than checking
 * `issued > 0`, because the first entry legitimately has cursor 0.
 */
let stamped = false;
function hasStampedBefore(): boolean {
  return stamped;
}
function markStamped(): void {
  stamped = true;
}

/** True when the previous history entry is one this app pushed. */
export function hasAppHistory(): boolean {
  if (typeof window === "undefined") return false;
  const idx = (window.history.state as Record<string, unknown> | null)?.[CURSOR];
  return typeof idx === "number" && idx > 0;
}
