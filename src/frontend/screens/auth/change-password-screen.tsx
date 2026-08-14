"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BlockButton, BlockInput, BlockPanel, LoadingScreen } from "@/frontend/components/mc";
import { useSession } from "@/frontend/components/auth/session-provider";
import { repo } from "@/backend/data";
import { DataError } from "@/backend/data/types";

const schema = z.object({
  currentPassword: z.string().min(1, "Enter your temporary password."),
  newPassword: z.string().min(8, "Use at least 8 characters.").max(72),
  confirmPassword: z.string().min(1, "Confirm your new password."),
}).refine((value) => value.newPassword === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match.",
});

type FormValues = z.infer<typeof schema>;

export function ChangePasswordScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, refresh } = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    if (status === "ready") router.replace(params.get("next") ?? "/travelling");
  }, [status, router, params]);

  async function onSubmit(values: FormValues) {
    setFormError(null);
    if (!repo.auth.changePassword) {
      setFormError("Password changes are unavailable in this environment.");
      return;
    }
    try {
      await repo.auth.changePassword(values.currentPassword, values.newPassword);
      await refresh();
      const live = await repo.auth.getSession();
      if (live?.roles.some((role) => ["admin", "organizer", "scanner"].includes(role)) && repo.auth.createConsoleHandoff) {
        const handoff = await repo.auth.createConsoleHandoff("/");
        window.location.assign(handoff.url);
      } else {
        router.replace(params.get("next") ?? "/travelling");
      }
    } catch (error) {
      setFormError(error instanceof DataError ? error.message : "Could not change your password.");
    }
  }

  if (status === "loading") return <LoadingScreen label="Loading" />;

  return (
    <BlockPanel variant="card" padded="lg" className="w-full max-w-[500px] animate-block-in">
      <header className="mb-[calc(var(--mc-unit)*1.5)]">
        <h1 className="text-mc-eyebrow text-lg">CHANGE TEMPORARY PASSWORD</h1>
        <p className="mt-[var(--mc-unit)] text-mc-text-dim">Your administrator must issue a new password before console access is enabled.</p>
      </header>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[var(--mc-unit)]" noValidate>
        <BlockInput label="Current password" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register("currentPassword")} />
        <BlockInput label="New password" type="password" autoComplete="new-password" error={errors.newPassword?.message} {...register("newPassword")} />
        <BlockInput label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register("confirmPassword")} />
        {formError ? <BlockPanel variant="slot" padded="sm" role="alert" className="border-mc-redstone text-mc-danger">{formError}</BlockPanel> : null}
        <BlockButton type="submit" block size="lg" variant="emerald" loading={isSubmitting}>Save password</BlockButton>
      </form>
    </BlockPanel>
  );
}
