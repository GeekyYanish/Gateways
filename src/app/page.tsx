import { LandingScreen } from "@/frontend/components/portal/landing-screen";
import { PortalTransitionProvider } from "@/frontend/components/portal/portal-transition-overlay";

export default function Home() {
  return (
    <PortalTransitionProvider>
      <LandingScreen />
    </PortalTransitionProvider>
  );
}
