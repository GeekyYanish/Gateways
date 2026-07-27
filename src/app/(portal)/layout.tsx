import { PortalTransitionProvider } from "@/frontend/components/portal/portal-transition-overlay";
import { SessionProvider } from "@/frontend/components/auth/session-provider";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PortalTransitionProvider>{children}</PortalTransitionProvider>
    </SessionProvider>
  );
}
