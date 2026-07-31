/**
 * "Has the splash already played this session?"
 *
 * The crest-assembly splash is a first-impression flourish, not a loading gate,
 * so it must play at most once per tab. sessionStorage rather than module state
 * for the same reason as `transition-store.ts`: a full page load (refresh, or
 * typing a URL for another route) throws away all module state, and the splash
 * would replay on every reload.
 *
 * The KEY here is also read by the `beforeInteractive` boot script in the root
 * layout, which hides the overlay before first paint so a repeat load never
 * flashes it. Keep the two in sync — the boot script inlines this string
 * because it runs before any module has loaded.
 */

export const SPLASH_SEEN_KEY = "parallax:splash-seen";

/** True when the splash should play, i.e. it has not run in this tab yet. */
export function shouldPlaySplash(): boolean {
  try {
    return sessionStorage.getItem(SPLASH_SEEN_KEY) !== "true";
  } catch {
    // Private mode with storage disabled. Playing it is the safe failure:
    // an extra 3s flourish is better than a permanently blank overlay.
    return true;
  }
}

export function markSplashSeen(): void {
  try {
    sessionStorage.setItem(SPLASH_SEEN_KEY, "true");
  } catch {
    // Nothing to do — the splash simply replays on the next load.
  }
}
