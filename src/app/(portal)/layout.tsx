import { PortalTransitionProvider } from "@/components/portal/portal-transition-overlay";
import { SessionProvider } from "@/components/auth/session-provider";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PortalTransitionProvider>{children}</PortalTransitionProvider>
    </SessionProvider>
  );
}
