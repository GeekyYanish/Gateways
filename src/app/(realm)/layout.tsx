"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { SessionProvider, useSession } from "@/frontend/components/auth/session-provider";
import { PortalTransitionProvider } from "@/frontend/components/portal/portal-transition-overlay";
import { BlockToaster, LoadingScreen } from "@/frontend/components/mc";
import { AnnouncementListener } from "@/frontend/components/realtime/announcement-listener";
import { applyReduceMotionAttribute } from "@/frontend/lib/animation/use-reduced-motion";

/**
 * Authenticated area.
 *
 * Route protection is a CLIENT guard here because localStorage has no server
 * presence — there is nothing for middleware to read. After the MySQL
 * migration this moves into `middleware.ts` and these become server components.
 * See MYSQL-MIGRATION.md.
 *
 * `MotionConfig reducedMotion="user"` is mounted once here, which makes every
 * Framer animation in the authed app respect the OS preference for free.
 */
export default function RealmLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <MotionConfig reducedMotion="user">
        <PortalTransitionProvider>
          <RealmGuard>{children}</RealmGuard>
          <AnnouncementListener />
          <BlockToaster />
        </PortalTransitionProvider>
      </MotionConfig>
    </SessionProvider>
  );
}

function RealmGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    applyReduceMotionAttribute();
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      // Preserve the intended destination so login can return them here.
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (status === "needs-password") {
      // Also a terminal state for this guard — without its own redirect the
      // user sat on the loader below with nothing to click.
      router.replace(`/change-password?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  // Render the loader rather than the children while unresolved: flashing
  // protected content before redirecting is both ugly and a small leak.
  //
  // `staff` counts as resolved. An admin or organiser is a signed-in human with
  // an EXTRA role, not a lesser session, and they still have a participant
  // dashboard of their own. Excluding them here stranded every staff account on
  // this loader indefinitely, because the effect above only ever redirects the
  // unauthenticated — which is why the dashboard was reachable through the
  // portal but never from the login form.
  if (status !== "ready" && status !== "staff") {
    return <LoadingScreen label="Entering the realm" />;
  }

  return <>{children}</>;
}
