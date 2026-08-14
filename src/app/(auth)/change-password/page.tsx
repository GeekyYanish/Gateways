import { Suspense } from "react";
import { LoadingScreen } from "@/frontend/components/mc";
import { ChangePasswordScreen } from "@/frontend/screens/auth/change-password-screen";

export const metadata = { title: "Change Password — Gateways 2026" };

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading" />}>
      <ChangePasswordScreen />
    </Suspense>
  );
}
