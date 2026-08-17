import { Suspense } from "react";
import { LoadingScreen } from "@/frontend/components/mc";
import { ConsoleReturnScreen } from "@/frontend/screens/auth/console-return-screen";

export const metadata = { title: "Signing you in — Parallax" };

export default function ConsoleReturnPage() {
  // ConsoleReturnScreen reads useSearchParams (?code=, ?returnTo=), which
  // forces a client bail-out during prerendering — same reason the login page
  // needs this boundary.
  return (
    <Suspense fallback={<LoadingScreen label="Loading" />}>
      <ConsoleReturnScreen />
    </Suspense>
  );
}
