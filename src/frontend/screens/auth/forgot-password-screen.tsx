"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BlockButton, BlockInput, BlockPanel } from "@/frontend/components/mc";
import { repo } from "@/backend/data";
import { DataError } from "@/backend/data/types";

const schema = z.object({
  email: z.string().min(1, "Email is required.").email("Enter a valid email address."),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordScreen() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    if (!repo.auth.requestPasswordReset) {
      setFormError("Password recovery is unavailable in this environment.");
      return;
    }

    try {
      await repo.auth.requestPasswordReset(values.email);
      setSubmitted(true);
    } catch (error) {
      setFormError(
        error instanceof DataError
          ? error.message
          : "We could not process that request. Please try again.",
      );
    }
  }

  return (
    <BlockPanel variant="card" padded="lg" className="w-full max-w-[500px] animate-block-in">
      {submitted ? (
        <div className="flex flex-col gap-[var(--mc-unit)]">
          <header>
            <h1 className="text-mc-eyebrow text-lg">CHECK YOUR INBOX</h1>
            <p className="mt-[var(--mc-unit)] text-mc-text-dim">
              If an account exists for that email, we sent a password reset link.
              The link is valid for a limited time and can be used once.
            </p>
          </header>
          {/*
            Shown to EVERYONE, unconditionally, and that is the point.

            Password reset only fires for accounts that have a password:
            `requestPasswordReset` requires a `passwordHash`, so a Google-only
            account is skipped and no mail is ever sent. The response stays
            deliberately generic to avoid revealing whether an address is
            registered — which leaves a Google user waiting on an email that
            cannot arrive. Saying it here costs nothing, because it is the same
            sentence for every visitor and so leaks nothing about any account.
          */}
          <BlockPanel variant="slot" padded="sm" className="text-[16px] text-mc-text-dim">
            Signed up with Google? Use{" "}
            <button
              type="button"
              className="cursor-pointer text-mc-eyebrow underline hover:text-mc-text"
              onClick={() => router.replace("/login")}
            >
              Sign in with Google
            </button>{" "}
            instead — password reset only works for accounts that have a
            password.
          </BlockPanel>
          <BlockButton block size="lg" variant="portal" onClick={() => router.replace("/login")}>
            Return to login
          </BlockButton>
        </div>
      ) : (
        <div className="flex flex-col gap-[var(--mc-unit)]">
          <header>
            <h1 className="text-mc-eyebrow text-lg">FORGOT PASSWORD</h1>
            <p className="mt-[var(--mc-unit)] text-mc-text-dim">
              Enter your account email and we’ll send a secure reset link.
            </p>
          </header>
          <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} className="flex flex-col gap-[var(--mc-unit)]" noValidate>
            <BlockInput
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register("email")}
            />
            {formError ? (
              <BlockPanel variant="slot" padded="sm" role="alert" aria-live="assertive" className="border-mc-redstone text-mc-danger text-[16px]">
                {formError}
              </BlockPanel>
            ) : null}
            <BlockButton type="submit" block size="lg" variant="portal" loading={isSubmitting}>
              Send reset link
            </BlockButton>
          </form>
          {/*
            Shown to EVERYONE, unconditionally, and that is the point.

            Password reset only fires for accounts that have a password:
            `requestPasswordReset` requires a `passwordHash`, so a Google-only
            account is skipped and no mail is ever sent. The response stays
            deliberately generic to avoid revealing whether an address is
            registered — which leaves a Google user waiting on an email that
            cannot arrive. Saying it here costs nothing, because it is the same
            sentence for every visitor and so leaks nothing about any account.
          */}
          <BlockPanel variant="slot" padded="sm" className="text-[16px] text-mc-text-dim">
            Signed up with Google? Use{" "}
            <button
              type="button"
              className="cursor-pointer text-mc-eyebrow underline hover:text-mc-text"
              onClick={() => router.replace("/login")}
            >
              Sign in with Google
            </button>{" "}
            instead — password reset only works for accounts that have a
            password.
          </BlockPanel>
          <button type="button" className="min-h-11 cursor-pointer text-[16px] text-mc-eyebrow hover:text-mc-text hover:underline" onClick={() => router.replace("/login")}>
            Back to login
          </button>
        </div>
      )}
    </BlockPanel>
  );
}
