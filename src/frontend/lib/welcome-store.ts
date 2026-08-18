/**
 * Who has already been greeted on this device.
 *
 * The world screen's welcome toast used to fire once per MOUNT, which meant it
 * reappeared every time you navigated back to `/world` — several times a
 * session. It should be a greeting on arrival, not a running commentary.
 *
 * sessionStorage rather than localStorage: the greeting belongs to a sitting at
 * the machine, so a new tab is a fresh arrival and gets it again. It stores the
 * user id, not a boolean, so signing in as somebody else on the same tab still
 * greets them.
 *
 * `clearWelcomed` runs on sign-out, which is what makes "log back in and you
 * are greeted again" true rather than only true after closing the tab.
 */
const KEY = "parallax:welcomed";

export function hasBeenWelcomed(userId: string): boolean {
  try {
    return sessionStorage.getItem(KEY) === userId;
  } catch {
    // Private mode. Degrades to greeting once per mount, as before.
    return false;
  }
}

export function markWelcomed(userId: string): void {
  try {
    sessionStorage.setItem(KEY, userId);
  } catch {
    /* ignore */
  }
}

export function clearWelcomed(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
