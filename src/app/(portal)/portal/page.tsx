import { LandingScreen } from "@/frontend/components/portal/landing-screen";

export const metadata = { title: "Parallax — Another World Awaits" };

/**
 * The portal gate.
 *
 * The homepage's "Start the Journey" lands here, and this is where the realm
 * actually begins: "Enter the Portal" fires the wipe into `/entering`, which
 * branches to login, character creation, or straight through to the world.
 *
 * It lives in the `(portal)` route group so it inherits that layout's
 * `PortalTransitionProvider` — which is what makes the transition work in BOTH
 * directions. The provider's overlay covers before navigating away, and
 * consumes a pending transition on arrival, so the homepage's wipe fades out
 * over this page instead of cutting to it.
 *
 * Kept as its own route rather than folded into the homepage hero: the gate is
 * a full-viewport cinematic with its own entry choreography, and a visitor who
 * has decided to go in should not have to scroll past the fest pitch again.
 */
export default function PortalGatePage() {
  return <LandingScreen />;
}
