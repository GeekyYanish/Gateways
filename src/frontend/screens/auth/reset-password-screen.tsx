"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BlockButton, BlockInput, BlockPanel } from "@/frontend/components/mc";
import { repo } from "@/backend/data";
import { DataError } from "@/backend/data/types";

const schema = z.object({
  newPassword: z.string().min(8, "Use at least 8 characters.").max(72, "Use 72 characters or fewer."),
  confirmPassword: z.string().min(1, "Confirm your new password."),
}).refine((value) => value.newPassword === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match.",
});

type FormValues = z.infer<typeof schema>;

export function ResetPasswordScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [formError, setFormError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    if (!token || !repo.auth.resetPassword) {
      setFormError("This password reset link is invalid or expired.");
      return;
    }

    try {
      await repo.auth.resetPassword(token, values.newPassword);
      setCompleted(true);
    } catch (error) {
      setFormError(
        error instanceof DataError
          ? error.message
          : "This password reset link is invalid or expired.",
      );
    }
  }

  return (
    <BlockPanel variant="card" padded="lg" className="w-full max-w-[500px] animate-block-in">
      {completed ? (
        <div className="flex flex-col gap-[var(--mc-unit)]">
          <header>
            <h1 className="text-mc-eyebrow text-lg">PASSWORD UPDATED</h1>
            <p className="mt-[var(--mc-unit)] text-mc-text-dim">
              Your password has been reset. All previous sessions were signed out.
            </p>
          </header>
          <BlockButton block size="lg" variant="portal" onClick={() => router.replace("/login")}>
            Continue to login
          </BlockButton>
        </div>
      ) : (
        <div className="flex flex-col gap-[var(--mc-unit)]">
          <header>
            <h1 className="text-mc-eyebrow text-lg">RESET PASSWORD</h1>
            <p className="mt-[var(--mc-unit)] text-mc-text-dim">
              Choose a new password for your portal account.
            </p>
          </header>
          <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-[var(--mc-unit)]" noValidate>
            <BlockInput label="New password" type="password" autoComplete="new-password" placeholder="••••••••" error={errors.newPassword?.message} {...register("newPassword")} />
            <BlockInput label="Confirm password" type="password" autoComplete="new-password" placeholder="••••••••" error={errors.confirmPassword?.message} {...register("confirmPassword")} />
            {formError ? (
              <BlockPanel variant="slot" padded="sm" role="alert" aria-live="assertive" className="border-mc-redstone text-mc-danger text-[16px]">
                {formError}
              </BlockPanel>
            ) : null}
            <BlockButton type="submit" block size="lg" variant="portal" loading={isSubmitting} disabled={!token}>
              Set new password
            </BlockButton>
          </form>
          <button type="button" className="min-h-11 cursor-pointer text-[16px] text-mc-eyebrow hover:text-mc-text hover:underline" onClick={() => router.replace("/login")}>
            Back to login
          </button>
        </div>
      )}
    </BlockPanel>
  );
}
