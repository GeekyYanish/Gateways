"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BlockButton, BlockCheckbox, BlockInput, BlockPanel } from "@/frontend/components/mc";
import { useSession } from "@/frontend/components/auth/session-provider";
import { repo } from "@/backend/data";
import { DataError } from "@/backend/data/types";
import { cn } from "@/frontend/lib/utils";

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

/**
 * Provider glyphs are ORIGINAL pixel marks in each service's familiar colours,
 * not their logo files — consistent with the rest of the art in this project,
 * and they scale with --mc-scale like everything else.
 */
const PROVIDERS = [
  {
    id: "google",
    label: "Google",
    glyph: (
      <svg viewBox="0 0 8 8" className="h-[18px] w-[18px]" shapeRendering="crispEdges" aria-hidden>
        <path d="M2 0h4v2H2z" fill="#ea4335" />
        <path d="M0 2h2v4H0z" fill="#fbbc05" />
        <path d="M2 6h4v2H2z" fill="#34a853" />
        <path d="M6 4h2v2H6z M4 3h4v2H4z" fill="#4285f4" />
      </svg>
    ),
  },
  {
    id: "discord",
    label: "Discord",
    glyph: (
      <svg viewBox="0 0 8 8" className="h-[18px] w-[18px]" shapeRendering="crispEdges" aria-hidden>
        <path d="M2 1h4v1H2z M1 2h6v3H1z M0 3h1v2H0z M7 3h1v2H7z M1 5h2v1H1z M5 5h2v1H5z" fill="#5865f2" />
        <path d="M2 3h1v1H2z M5 3h1v1H5z" fill="#0d0b16" />
      </svg>
    ),
  },
  {
    id: "microsoft",
    label: "Microsoft",
    glyph: (
      <svg viewBox="0 0 8 8" className="h-[18px] w-[18px]" shapeRendering="crispEdges" aria-hidden>
        <path d="M0 0h3.5v3.5H0z" fill="#f25022" />
        <path d="M4.5 0H8v3.5H4.5z" fill="#7fba00" />
        <path d="M0 4.5h3.5V8H0z" fill="#00a4ef" />
        <path d="M4.5 4.5H8V8H4.5z" fill="#ffb900" />
      </svg>
    ),
  },
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

  const heading = mode === "login" ? ["Welcome", "Adventurer"] : ["Join", "The Realm"];

  return (
    <div className="w-full max-w-[440px] animate-block-in">
      {/* The wordmark sits ABOVE the card, not inside it, so the card reads as
          the form and nothing else. */}
      <header className="mb-[calc(var(--mc-unit)*2)] text-center">
        <h1 className="title-emboss text-[28px] leading-[1.35] text-mc-portal-pale md:text-[36px]">
          {heading.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>
        <p className="mt-[calc(var(--mc-unit)*1.25)] text-mc-text-dim">
          {mode === "login"
            ? "Sign in to continue your journey."
            : "Create an account to enter the realm."}
        </p>
      </header>

      <BlockPanel variant="card" padded="lg">
        <div className="flex flex-col gap-[calc(var(--mc-unit)*1.5)]">
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
                "relative flex-1 py-[calc(var(--mc-unit)*1.1)] font-pixel text-[11px] uppercase cursor-pointer",
                "border-b-[length:var(--mc-bevel)]",
                mode === m
                  ? "border-transparent bg-gradient-to-b from-mc-portal/45 to-mc-portal-deep/35 text-white"
                  : "border-mc-border text-mc-text-dim hover:text-mc-text",
              )}
            >
              {m === "login" ? "Login" : "Sign Up"}
              {mode === m ? (
                <motion.span
                  layoutId="auth-tab-indicator"
                  className="absolute inset-x-0 bottom-0 h-[var(--mc-bevel)] bg-mc-portal-light"
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
                className="cursor-pointer text-[16px] text-mc-portal-light hover:text-mc-text hover:underline"
                onClick={() =>
                  setFormError(
                    "Password reset needs a mail server — it arrives with the MySQL backend.",
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
            variant="portal"
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
              size="lg"
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
    </div>
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
          {/* Pixel eye — Press Start 2P has no glyph for ◉/◡, so a character
              here renders as tofu. Open = lid outline with a pupil; closed =
              a shut lid with lashes, which reads at 14px where a struck-through
              eye does not. */}
          <svg viewBox="0 0 12 8" className="h-[14px] w-[21px]" shapeRendering="crispEdges" aria-hidden>
            {visible ? (
              <>
                <path
                  d="M4 1h4v1H4z M2 2h2v1H2z M8 2h2v1H8z M1 3h1v2H1z M10 3h1v2h-1z M2 5h2v1H2z M8 5h2v1H8z M4 6h4v1H4z"
                  fill="currentColor"
                />
                <path d="M5 3h2v2H5z" fill="currentColor" />
              </>
            ) : (
              <path
                d="M1 3h1v1H1z M2 4h2v1H2z M4 5h4v1H4z M8 4h2v1H8z M10 3h1v1h-1z M2 6h1v1H2z M5 6h1v1H5z M9 6h1v1H9z"
                fill="currentColor"
              />
            )}
          </svg>
        </BlockButton>
      }
      {...registration}
    />
  );
}
