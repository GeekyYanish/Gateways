import { SessionProvider } from "@/frontend/components/auth/session-provider";
import { PortalTransitionProvider } from "@/frontend/components/portal/portal-transition-overlay";
import { BackLink } from "@/frontend/components/mc/back-link";
import { AnimatedBackground } from "@/frontend/components/scene";

/**
 * Auth screens sit on the "realm-gate" scene — deliberately the quietest one in
 * the set, and at reduced intensity, because a busy parallax behind a login form
 * fights the thing the user is actually trying to do.
 *
 * `PortalTransitionProvider` is here because /entering is where a signed-out
 * visitor lands, and it covers the screen before handing off to /login. Without
 * a provider on this side, nothing consumed the "covering" flag: login cut in
 * with no transition AND the flag stayed in sessionStorage, so the NEXT visit to
 * any portal route opened fully opaque and faded — a purple flash on load.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <PortalTransitionProvider>
        <AnimatedBackground
          scene="realm-gate"
          intensity={0.5}
          className="flex flex-1 flex-col items-center justify-center p-[calc(var(--mc-unit)*2)]"
        >
          <BackLink
            href="/"
            label="Home"
            className="absolute left-[calc(var(--mc-unit)*2)] top-[calc(var(--mc-unit)*2)] z-20"
          />
          {children}
        </AnimatedBackground>
      </PortalTransitionProvider>
    </SessionProvider>
  );
}
