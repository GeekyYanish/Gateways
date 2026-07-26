import { LandingScreen } from "@/components/portal/landing-screen";
import { PortalTransitionProvider } from "@/components/portal/portal-transition-overlay";

export default function Home() {
  return (
    <PortalTransitionProvider>
      <LandingScreen />
    </PortalTransitionProvider>
  );
}
