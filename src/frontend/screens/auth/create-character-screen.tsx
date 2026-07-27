"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BlockButton, BlockInput, BlockPanel, BlockSelect, LoadingScreen } from "@/frontend/components/mc";
import { AvatarCarousel } from "@/frontend/components/character/avatar-carousel";
import { useSession } from "@/frontend/components/auth/session-provider";
import { useAsync } from "@/frontend/hooks/use-async";
import { repo } from "@/backend/data";
import { DataError, type SkinId } from "@/backend/data/types";

/**
 * SCREEN 4 — Create your adventurer.
 *
 * The player-name field checks availability as you type (debounced), because
 * discovering a name is taken only on submit — after filling four more fields —
 * is a genuinely annoying experience.
 */

// yearOfStudy stays a string here rather than z.coerce.number(): a <select>
// yields strings, and coercion makes zod's INPUT type `unknown`, which breaks
// react-hook-form's resolver inference. It is parsed once at submit instead.
const schema = z.object({
  playerName: z
    .string()
    .min(3, "At least 3 characters.")
    .max(16, "At most 16 characters.")
    .regex(/^[A-Za-z0-9_]+$/, "Letters, numbers and underscores only."),
  collegeId: z.string().min(1, "Select your college."),
  departmentId: z.string().min(1, "Select your department."),
  yearOfStudy: z.string().regex(/^[1-6]$/, "Select your year."),
});

type FormValues = z.infer<typeof schema>;

export function CreateCharacterScreen() {
  const router = useRouter();
  const { status, session, character, refresh } = useSession();
  const [skinId, setSkinId] = useState<SkinId>("prospector");
  const [formError, setFormError] = useState<string | null>(null);
  // Which name the last completed check was for, plus its result.
  const [nameCheck, setNameCheck] = useState<{ name: string; taken: boolean } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { playerName: "", collegeId: "", departmentId: "", yearOfStudy: "1" },
  });

  // useWatch rather than watch(): it subscribes to just these two fields and is
  // stable across renders, so it can be used as an effect dependency safely.
  // watch() re-runs the whole form on every render and cannot be memoized.
  const collegeId = useWatch({ control, name: "collegeId" });
  const playerName = useWatch({ control, name: "playerName" });

  const { data: colleges } = useAsync(() => repo.reference.colleges(), []);
  // Departments depend on the chosen college, so this refetches on change.
  const { data: departments } = useAsync(
    () => repo.reference.departments(collegeId || null),
    [collegeId],
  );

  // Redirect guards.
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
    else if (status === "ready" && character) router.replace("/travelling");
  }, [status, character, router]);

  /**
   * Debounced availability check — 400ms: long enough not to fire on every
   * keystroke, short enough to feel live.
   *
   * `checkedName` records which name the stored result belongs to, so "is this
   * name free?" is DERIVED rather than stored. That means the not-yet-checkable
   * case needs no setState at all, and a stale result can never be shown against
   * a newer name.
   */
  const trimmed = useMemo(() => playerName.trim(), [playerName]);
  const checkable = trimmed.length >= 3 && /^[A-Za-z0-9_]+$/.test(trimmed);

  useEffect(() => {
    if (!checkable) return;

    let cancelled = false;
    const t = setTimeout(async () => {
      const taken = await repo.characters.isPlayerNameTaken(trimmed, session?.userId);
      if (!cancelled) setNameCheck({ name: trimmed, taken });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [trimmed, checkable, session?.userId]);

  const nameStatus: "idle" | "checking" | "free" | "taken" = !checkable
    ? "idle"
    : nameCheck?.name !== trimmed
      ? "checking"
      : nameCheck.taken
        ? "taken"
        : "free";

  async function onSubmit(values: FormValues) {
    if (!session) return;
    setFormError(null);
    try {
      await repo.characters.create(session.userId, {
        playerName: values.playerName,
        collegeId: values.collegeId,
        departmentId: values.departmentId,
        yearOfStudy: Number(values.yearOfStudy),
        skinId,
      });
      // Unlocks "First Steps" and awards its XP.
      await repo.achievements.evaluate(session.userId);
      await refresh();
      router.push("/travelling");
    } catch (e) {
      setFormError(e instanceof DataError ? e.message : "Could not create your character.");
    }
  }

  if (status === "loading") return <LoadingScreen label="Loading" />;

  return (
    <BlockPanel variant="panel" padded="lg" className="w-full max-w-[720px] animate-block-in">
      <div className="flex flex-col gap-[calc(var(--mc-unit)*1.5)]">
        <header className="text-center">
          <h1 className="text-mc-portal-light text-lg md:text-xl">CREATE YOUR ADVENTURER</h1>
          <p className="mt-[calc(var(--mc-unit)*0.75)] text-mc-text-dim">
            This is how the realm will know you.
          </p>
        </header>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid gap-[calc(var(--mc-unit)*2)] md:grid-cols-[auto_1fr]"
          noValidate
        >
          <AvatarCarousel value={skinId} onChange={setSkinId} />

          <div className="flex flex-col gap-[calc(var(--mc-unit)*0.25)] min-w-0">
            <BlockInput
              label="Player name"
              placeholder="Ridge_07"
              autoComplete="off"
              spellCheck={false}
              maxLength={16}
              error={
                errors.playerName?.message ??
                (nameStatus === "taken" ? "That name is already claimed." : undefined)
              }
              hint={
                nameStatus === "checking"
                  ? "Checking availability…"
                  : nameStatus === "free"
                    ? "Available!"
                    : "3–16 characters: letters, numbers, underscores."
              }
              {...register("playerName")}
            />

            <BlockSelect
              label="College"
              error={errors.collegeId?.message}
              {...register("collegeId")}
            >
              <option value="">Select your college…</option>
              {(colleges ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </BlockSelect>

            <BlockSelect
              label="Department"
              error={errors.departmentId?.message}
              {...register("departmentId")}
            >
              <option value="">Select your department…</option>
              {(departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </BlockSelect>

            <BlockSelect
              label="Year of study"
              error={errors.yearOfStudy?.message}
              {...register("yearOfStudy")}
            >
              {[1, 2, 3, 4, 5, 6].map((y) => (
                <option key={y} value={y}>
                  {y}
                  {y === 1 ? "st" : y === 2 ? "nd" : y === 3 ? "rd" : "th"} Year
                </option>
              ))}
            </BlockSelect>

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
              variant="emerald"
              loading={isSubmitting}
              disabled={nameStatus === "taken"}
              className="mt-[var(--mc-unit)]"
            >
              Continue
            </BlockButton>
          </div>
        </form>
      </div>
    </BlockPanel>
  );
}
