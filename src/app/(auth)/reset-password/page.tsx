import { Suspense } from "react";
import { LoadingScreen } from "@/frontend/components/mc";
import { ResetPasswordScreen } from "@/frontend/screens/auth/reset-password-screen";

export const metadata = { title: "Reset Password — Gateways 2026" };

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading" />}>
      <ResetPasswordScreen />
    </Suspense>
  );
}
