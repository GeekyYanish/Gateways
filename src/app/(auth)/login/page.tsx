import { Suspense } from "react";
import { LoadingScreen } from "@/frontend/components/mc";
import { LoginScreen } from "@/frontend/screens/auth/login-screen";

export const metadata = { title: "Welcome Adventurer — Parallax" };

export default function LoginPage() {
  // LoginScreen reads useSearchParams (?mode=signup, ?next=...), which forces a
  // client bail-out during prerendering. Without this boundary the production
  // build fails outright — the dev server does not surface it.
  return (
    <Suspense fallback={<LoadingScreen label="Loading" />}>
      <LoginScreen />
    </Suspense>
  );
}
