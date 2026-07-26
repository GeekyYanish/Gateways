"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BlockButton, BlockCheckbox, BlockInput, BlockPanel } from "@/components/mc";
import { useSession } from "@/components/auth/session-provider";
import { repo } from "@/lib/data";
import { DataError } from "@/lib/data/types";
import { cn } from "@/lib/utils";

/**
 * SCREEN 3 — Login / Sign up.
 *
 * Tabs are a single form component with a mode switch rather than two forms, so
 * a typed email survives switching between them.
 */

type Mode = "login" | "signup";

/**
 * One schema for both modes, with the signup-only rules applied conditionally
 * via superRefine. Two separate schemas would have different inferred shapes,
 * which react-hook-form cannot reconcile behind a single useForm generic without
 * an `as never` cast that hides real type errors.
 */
function authSchema(mode: Mode) {
  return z
    .object({
      email: z.string().min(1, "Email is required.").email("Enter a valid email address."),
      password: z.string().min(1, "Password is required."),
      confirm: z.string(),
      remember: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (mode !== "signup") return;
      if (v.password.length < 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["password"],
          message: "Password must be at least 6 characters.",
        });
      }
      if (v.confirm !== v.password) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["confirm"],
          message: "Passwords do not match.",
        });
      }
    });
}

interface FormValues {
  email: string;
  password: string;
  confirm: string;
  remember: boolean;
}

const PROVIDERS = [
  { id: "google", label: "Google", glyph: "G" },
  { id: "discord", label: "Discord", glyph: "D" },
  { id: "microsoft", label: "Microsoft", glyph: "M" },
] as const;

export function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, refresh } = useSession();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "login");
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(authSchema(mode)),
    defaultValues: { email: "", password: "", confirm: "", remember: true },
  });

  // Already signed in? Skip straight to wherever they were headed.
  useEffect(() => {
    if (status === "needs-character") router.replace("/create-character");
    else if (status === "ready") router.replace(params.get("next") ?? "/travelling");
  }, [status, router, params]);

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      if (mode === "login") {
        await repo.auth.signIn(values.email, values.password);
      } else {
        await repo.auth.signUp(values.email, values.password);
      }
      await refresh();
      // The effect above handles the redirect once status settles, but pushing
      // here makes the transition immediate rather than waiting a tick.
      router.push("/create-character");
    } catch (e) {
      setFormError(
        e instanceof DataError ? e.message : "Something went wrong. Please try again.",
      );
    }
  }

  async function onProvider(provider: (typeof PROVIDERS)[number]["id"]) {
    setFormError(null);
    setPendingProvider(provider);
    try {
      await repo.auth.signInWithProvider(provider);
      await refresh();
      router.push("/create-character");
    } catch (e) {
      setFormError(e instanceof DataError ? e.message : "Sign-in failed.");
    } finally {
      setPendingProvider(null);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setFormError(null);
    reset({ email: "", password: "", confirm: "", remember: true });
  }

  return (
    <BlockPanel
      variant="panel"
      padded="lg"
      className="w-full max-w-[440px] animate-block-in"
    >
      <div className="flex flex-col gap-[calc(var(--mc-unit)*1.5)]">
        <header className="text-center">
          <h1 className="text-mc-portal-light text-lg md:text-xl">
            {mode === "login" ? "WELCOME ADVENTURER" : "JOIN THE REALM"}
          </h1>
          <p className="mt-[calc(var(--mc-unit)*0.75)] text-mc-text-dim">
            {mode === "login"
              ? "Sign in to continue your journey."
              : "Create an account to enter the realm."}
          </p>
        </header>

        {/* Tabs. role=tablist so the relationship is announced, with a Framer
            layout animation on the active indicator. */}
        <div role="tablist" aria-label="Authentication mode" className="relative flex">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={cn(
                "relative flex-1 py-[var(--mc-unit)] font-pixel text-[11px] uppercase cursor-pointer",
                "border-b-[length:var(--mc-bevel)]",
                mode === m
                  ? "text-mc-portal-light border-transparent"
                  : "text-mc-text-dim border-mc-border hover:text-mc-text",
              )}
            >
              {m === "login" ? "Login" : "Sign Up"}
              {mode === m ? (
                <motion.span
                  layoutId="auth-tab-indicator"
                  className="absolute inset-x-0 bottom-0 h-[var(--mc-bevel)] bg-mc-portal"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              ) : null}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-[calc(var(--mc-unit)*0.5)]"
          noValidate
        >
          <BlockInput
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register("email")}
          />

          <PasswordField
            label="Password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            error={errors.password?.message}
            registration={register("password")}
          />

          {mode === "signup" ? (
            <PasswordField
              label="Confirm password"
              autoComplete="new-password"
              error={errors.confirm?.message}
              registration={register("confirm")}
            />
          ) : null}

          {mode === "login" ? (
            <div className="flex items-center justify-between gap-[var(--mc-unit)]">
              <BlockCheckbox label="Remember me" {...register("remember")} />
              <button
                type="button"
                className="text-[15px] text-mc-portal-light underline cursor-pointer hover:text-mc-text"
                onClick={() =>
                  setFormError(
                    "Password reset needs a mail server — it arrives with the Supabase migration.",
                  )
                }
              >
                Forgot password?
              </button>
            </div>
          ) : null}

          {/* Errors as a block panel, and aria-live so they are announced. */}
          {formError ? (
            <BlockPanel
              variant="slot"
              padded="sm"
              role="alert"
              aria-live="assertive"
              className="border-mc-redstone text-mc-redstone-light text-[16px]"
            >
              {formError}
            </BlockPanel>
          ) : null}

          <BlockButton
            type="submit"
            block
            size="lg"
            loading={isSubmitting}
            className="mt-[var(--mc-unit)]"
          >
            {mode === "login" ? "Login" : "Create Account"}
          </BlockButton>
        </form>

        <div className="flex items-center gap-[var(--mc-unit)]">
          <span className="h-[2px] flex-1 bg-mc-border" />
          <span className="text-[14px] uppercase text-mc-text-dim">Or continue with</span>
          <span className="h-[2px] flex-1 bg-mc-border" />
        </div>

        <div className="grid grid-cols-3 gap-[var(--mc-unit)]">
          {PROVIDERS.map((p) => (
            <BlockButton
              key={p.id}
              variant="ghost"
              onClick={() => onProvider(p.id)}
              loading={pendingProvider === p.id}
              aria-label={`Continue with ${p.label}`}
              title={`Continue with ${p.label}`}
            >
              {p.glyph}
            </BlockButton>
          ))}
        </div>

        <p className="text-center text-[14px] text-mc-text-dim">
          Prototype: accounts are stored in this browser only.
        </p>
      </div>
    </BlockPanel>
  );
}

/** Password field with a reveal toggle. */
function PasswordField({
  label,
  autoComplete,
  error,
  registration,
}: {
  label: string;
  autoComplete: string;
  error?: string;
  registration: ReturnType<ReturnType<typeof useForm<FormValues>>["register"]>;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <BlockInput
      label={label}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      placeholder="••••••••"
      error={error}
      adornment={
        <BlockButton
          variant="ghost"
          size="sm"
          onClick={() => setVisible((v) => !v)}
          // The label must state the ACTION, not the state, or screen-reader
          // users cannot tell what pressing it does.
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? "◡" : "◉"}
        </BlockButton>
      }
      {...registration}
    />
  );
}
