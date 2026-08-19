"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BlockButton, BlockCheckbox, BlockInput, BlockPanel } from "@/frontend/components/mc";
import { useSession } from "@/frontend/components/auth/session-provider";
import { repo, isApiBackendEnabled } from "@/backend/data";
import { DataError } from "@/backend/data/types";
import { ApiError } from "@/frontend/lib/api-client";
import { cn } from "@/frontend/lib/utils";

/**
 * `BACKEND_UNAVAILABLE` isn't in `ApiError.toDataError()`'s known-code list
 * (see api-client.ts), so it surfaces here as a raw `ApiError` rather than a
 * `DataError` — this is the one place that matters: a cold backend timing out
 * mid-signin should read as "try again in a moment," not a generic failure.
 */
function describeAuthError(e: unknown): string {
  if (e instanceof DataError) return e.message;
  if (e instanceof ApiError && e.retryable) {
    return "The server is waking up. Please try again in a few seconds.";
  }
  return "Something went wrong. Please try again.";
}

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
      username: z.string(),
      password: z.string().min(1, "Password is required."),
      confirm: z.string(),
      remember: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (mode !== "signup") return;
      // Mirrors the backend's SignupBodySchema. This is also the character's
      // public name, so the server checks uniqueness when the form is sent.
      if (!/^[A-Za-z0-9_]{3,16}$/.test(v.username.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["username"],
          message: "Use 3–16 letters, numbers, or underscores.",
        });
      }
      // The backend hashes with bcrypt, which silently truncates past 72 bytes,
      // so it rejects anything longer. Catching it here beats a 400.
      if (v.password.length > 72) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["password"],
          message: "Password must be 72 characters or fewer.",
        });
      }
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
  /** Signup only. This becomes the unique character name. */
  username: string;
  password: string;
  confirm: string;
  remember: boolean;
}

/**
 * The backend supports Google OAuth only. Keep the provider list explicit so a
 * provider cannot quietly reappear in the UI without a matching backend flow.
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
] as const;

export function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { status, refresh } = useSession();
  const consoleRedirecting = useRef(false);
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "login");
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  /**
   * Set once signup has created the account but not yet a session. Its presence
   * IS the "awaiting code" state — a separate boolean could disagree with it,
   * and the email is needed to verify anyway. Google sign-in never sets this —
   * Google already verifies the email, so that path gets a session directly.
   */
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null);
  const [serverWarming, setServerWarming] = useState(false);

  /**
   * Wake the backend as soon as this screen mounts, not when the form is
   * submitted. The backend's free-tier instance can hibernate on idle, and a
   * cold start takes long enough that submitting immediately can time out —
   * pinging here pays that cost while the user is still typing instead of
   * during their actual sign-in request. The "waking up" note only appears
   * if this is still pending after a beat, so a warm backend shows nothing.
   */
  useEffect(() => {
    if (!isApiBackendEnabled()) return;
    let cancelled = false;
    const showNoticeTimer = setTimeout(() => {
      if (!cancelled) setServerWarming(true);
    }, 800);
    fetch("/api/warmup")
      .catch(() => {})
      .finally(() => {
        cancelled = true;
        clearTimeout(showNoticeTimer);
        setServerWarming(false);
      });
    return () => {
      cancelled = true;
      clearTimeout(showNoticeTimer);
    };
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(authSchema(mode)),
    defaultValues: { email: "", username: "", password: "", confirm: "", remember: true },
  });

  const requestedDestination = params.get("next") ?? "/travelling";

  async function routeAuthenticatedUser() {
    const live = await repo.auth.getSession();
    if (!live) return;
    if (live.mustChangePassword) {
      router.replace(`/change-password?next=${encodeURIComponent(requestedDestination)}`);
      return;
    }
    /*
      Staff go to the console by DEFAULT — not unconditionally.

      An explicit `?next=` is a deliberate request for a participant page (the
      realm guard sets it when it bounces someone to sign in). Overriding it
      meant a staff account could never open its own dashboard from the login
      form: every attempt was rewritten to a console handoff.
    */
    const explicitNext = params.get("next");
    if (
      !explicitNext &&
      live.roles.some((role) => ["admin", "organizer", "scanner"].includes(role))
    ) {
      if (consoleRedirecting.current) return;
      consoleRedirecting.current = true;
      if (repo.auth.createConsoleHandoff) {
        const handoff = await repo.auth.createConsoleHandoff("/");
        window.location.assign(handoff.url);
      } else {
        router.replace("/travelling");
      }
      return;
    }
    router.replace(requestedDestination);
  }

  // Already signed in? Skip straight to wherever they were headed. Staff are
  // handed to the console through the backend's one-time SSO code.
  useEffect(() => {
    if (status === "needs-password") {
      router.replace(`/change-password?next=${encodeURIComponent(requestedDestination)}`);
    } else if (status === "staff") {
      void routeAuthenticatedUser();
    } else if (status === "ready") {
      router.replace(requestedDestination);
    }
  // routeAuthenticatedUser deliberately reads the live backend session rather
  // than the transient provider state during the sign-in transition.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, router, requestedDestination]);

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      if (mode === "login") {
        await repo.auth.signIn(values.email, values.password);
      } else {
        /**
         * Signup may or may not sign you in, and the caller cannot assume.
         *
         * Email verification is currently disabled on the backend, so the
         * API-backed repository returns a live session and we fall straight
         * through to routing. If it is switched back on, the same call returns
         * `null` and we show the code step instead. Branch on the value.
         */
        const session = await repo.auth.signUp(
          values.email,
          values.password,
          values.username,
        );
        if (!session) {
          setPendingEmail(values.email);
          setCode("");
          // Deliberately not "we sent you a code": with SMTP unprovisioned that
          // claim was often false, and it sent people hunting an inbox for mail
          // that was never dispatched. Say what is actually known.
          setVerificationNotice(
            "Enter the verification code for your account. Use Resend if you do not have one.",
          );
          return;
        }
      }
      await refresh();
      await routeAuthenticatedUser();
    } catch (e) {
      // Not a failure: the password was correct, the address just is not
      // verified, and the backend has already reissued a code. Route to the
      // code step instead of showing a red error the user cannot act on.
      if (e instanceof DataError && e.code === "EMAIL_NOT_VERIFIED") {
        setPendingEmail(values.email);
        setCode("");
        setVerificationNotice(e.message);
        return;
      }
      setFormError(describeAuthError(e));
    }
  }

  /** Second half of signup: trade the emailed code for a session. */
  async function onVerify() {
    if (!pendingEmail) return;
    setFormError(null);
    setVerifying(true);
    try {
      await repo.auth.verifyEmail(pendingEmail, code);
      await refresh();
      await routeAuthenticatedUser();
    } catch (e) {
      setFormError(
        e instanceof DataError ? e.message : "That code was not accepted.",
      );
    } finally {
      setVerifying(false);
    }
  }

  async function onResend() {
    if (!pendingEmail) return;
    setFormError(null);
    setResending(true);
    try {
      await repo.auth.resendVerification(pendingEmail);
      setVerificationNotice("A new verification code has been sent.");
    } catch (e) {
      setFormError(
        e instanceof DataError ? e.message : "Could not resend the verification code.",
      );
    } finally {
      setResending(false);
    }
  }

  async function onProvider(provider: (typeof PROVIDERS)[number]["id"]) {
    setFormError(null);
    setPendingProvider(provider);
    try {
      await repo.auth.signInWithProvider(provider, requestedDestination);
      await refresh();
      await routeAuthenticatedUser();
    } catch (e) {
      setFormError(e instanceof DataError ? e.message : "Sign-in failed.");
    } finally {
      setPendingProvider(null);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setFormError(null);
    // Also clears any half-finished verification: switching tabs is the
    // gesture for "start over", and leaving `pendingEmail` set would strand
    // the user on a code prompt for an address they just navigated away from.
    setPendingEmail(null);
    setCode("");
    setVerificationNotice(null);
    reset({ email: "", username: "", password: "", confirm: "", remember: true });
  }

  const heading = pendingEmail
    ? ["Check", "Your Inbox"]
    : mode === "login"
      ? ["Welcome", "Adventurer"]
      : ["Join", "The Realm"];

  return (
    <div className="w-full max-w-[440px] animate-block-in">
      {/* The wordmark sits ABOVE the card, not inside it, so the card reads as
          the form and nothing else. */}
      <header className="mb-[calc(var(--mc-unit)*2)] text-center">
        <h1 className="title-emboss text-[clamp(23px,8vw,28px)] leading-[1.35] text-mc-portal-pale md:text-[36px]">
          {heading.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>
        <p className="mt-[calc(var(--mc-unit)*1.25)] text-mc-text-dim">
          {pendingEmail
            ? `We sent a six-digit code to ${pendingEmail}.`
            : mode === "login"
              ? "Sign in to continue your journey."
              : "Create an account to enter the realm."}
        </p>
      </header>

      <BlockPanel variant="card" padded="lg">
        <div className="flex flex-col gap-[calc(var(--mc-unit)*1.5)]">
        {pendingEmail ? (
          /**
           * Verification REPLACES the card rather than appending to it. The
           * account already exists at this point — leaving the signup form on
           * screen would invite a second submit that can only fail with
           * EMAIL_TAKEN.
           */
          <div className="flex flex-col gap-[var(--mc-unit)]">
            {verificationNotice ? (
              <BlockPanel
                variant="slot"
                padded="sm"
                role="status"
                aria-live="polite"
                className="border-mc-portal-light text-mc-text"
              >
                {verificationNotice}
              </BlockPanel>
            ) : null}
            <BlockInput
              label="Verification code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
              value={code}
              hint="Six digits, valid for 15 minutes."
              // Digits only, so a pasted "123 456" or "code: 123456" still
              // works instead of failing validation for a stray character.
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
            />

            {formError ? (
              <BlockPanel
                variant="slot"
                padded="sm"
                role="alert"
                aria-live="assertive"
                className="border-mc-redstone text-mc-danger text-[16px]"
              >
                {formError}
              </BlockPanel>
            ) : null}

            <BlockButton
              block
              size="lg"
              variant="portal"
              onClick={onVerify}
              disabled={code.length !== 6 || verifying}
            >
              {verifying ? "Verifying…" : "Verify & Enter"}
            </BlockButton>

            <button
              type="button"
              className="min-h-11 cursor-pointer text-[16px] text-mc-eyebrow hover:text-mc-text hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void onResend()}
              disabled={resending}
            >
              {resending ? "Sending a new code…" : "Resend verification code"}
            </button>

            <button
              type="button"
              className="min-h-11 cursor-pointer text-[16px] text-mc-eyebrow hover:text-mc-text hover:underline"
              onClick={() => {
                setPendingEmail(null);
                setCode("");
                setFormError(null);
                setVerificationNotice(null);
              }}
            >
              Use a different email
            </button>
          </div>
        ) : (
        <>
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
                "relative min-h-11 flex-1 py-[calc(var(--mc-unit)*1.1)] font-pixel text-[11px] uppercase cursor-pointer",
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
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
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

          {mode === "signup" ? (
            <BlockInput
              label="Username / character name"
              autoComplete="username"
              placeholder="Ridge_07"
              spellCheck={false}
              maxLength={16}
              hint="Unique, 3–16 letters, numbers, or underscores."
              error={errors.username?.message}
              {...register("username")}
            />
          ) : null}

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
                className="cursor-pointer text-[16px] text-mc-eyebrow hover:text-mc-text hover:underline"
                onClick={() => router.push("/forgot-password")}
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
              className="border-mc-redstone text-mc-danger text-[16px]"
            >
              {formError}
            </BlockPanel>
          ) : null}

          {/* Only appears if the warm-up ping is still pending after a beat —
              a warm backend never shows this. aria-live so it doesn't read as
              a silent hang for screen-reader users either. */}
          {serverWarming ? (
            <p role="status" aria-live="polite" className="text-center text-[14px] text-mc-text-dim">
              Waking up the server — this can take a few seconds…
            </p>
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

        <div className="grid grid-cols-1 gap-[var(--mc-unit)]">
          {PROVIDERS.map((p) => (
            <BlockButton
              key={p.id}
              variant="ghost"
              size="lg"
              block
              onClick={() => onProvider(p.id)}
              loading={pendingProvider === p.id}
              aria-label={`Continue with ${p.label}`}
              title={`Continue with ${p.label}`}
            >
              {p.glyph}
              <span>Continue with {p.label}</span>
            </BlockButton>
          ))}
        </div>

          {/* Only true of the local data layer. With the API backend the
              account lives in the backend's database, so the disclaimer would
              be actively wrong. */}
          {isApiBackendEnabled() ? null : (
            <p className="text-center text-[14px] text-mc-text-dim">
              Prototype: accounts are stored in this browser only.
            </p>
          )}
        </>
        )}
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
