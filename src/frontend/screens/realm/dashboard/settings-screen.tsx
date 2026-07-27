"use client";

import { useState } from "react";
import { BlockButton, BlockPanel, showToast } from "@/frontend/components/mc";
import { useSession } from "@/frontend/components/auth/session-provider";
import {
  getStoredReduceMotion,
  setReduceMotionPreference,
} from "@/frontend/lib/animation/use-reduced-motion";
import { clearAll } from "@/backend/data/local/store";

/**
 * Settings.
 *
 * The motion control is deliberately three-state rather than a checkbox:
 * "follow my system setting" is the correct default, and a two-state toggle
 * cannot express it — it would silently override the OS preference.
 */
export function SettingsScreen() {
  const { session, character } = useSession();
  // Read from their external stores in the initializer rather than an effect —
  // this component only renders client-side (it is inside the realm guard), so
  // there is no server pass to mismatch against.
  const [motion, setMotion] = useState<"system" | "on" | "off">(() => {
    const stored = getStoredReduceMotion();
    return stored === null ? "system" : stored ? "off" : "on";
  });
  const [osReduce] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  function applyMotion(next: "system" | "on" | "off") {
    setMotion(next);
    setReduceMotionPreference(next === "system" ? null : next === "off");
    showToast({
      title: "Motion preference saved",
      body:
        next === "system"
          ? "Following your system setting."
          : next === "off"
            ? "Animations reduced."
            : "Animations enabled.",
      severity: "success",
    });
  }

  function resetEverything() {
    clearAll();
    // A full reload is correct here: every in-memory cache is now stale.
    window.location.href = "/";
  }

  return (
    <div className="flex flex-col gap-[calc(var(--mc-unit)*1.5)]">
      <h1 className="text-mc-gold text-base md:text-lg">SETTINGS</h1>

      <BlockPanel variant="panel" title="Accessibility">
        <fieldset className="border-0 p-0">
          <legend className="font-pixel text-[10px] uppercase text-mc-text-dim">
            Animations
          </legend>
          <p className="mt-[calc(var(--mc-unit)*0.5)] text-[15px] text-mc-text-dim">
            Your system currently requests{" "}
            <strong className="text-mc-text">
              {osReduce ? "reduced motion" : "full motion"}
            </strong>
            .
          </p>

          <div className="mt-[var(--mc-unit)] flex flex-wrap gap-[calc(var(--mc-unit)*0.5)]">
            {(
              [
                { id: "system", label: "Follow system" },
                { id: "on", label: "Full motion" },
                { id: "off", label: "Reduce motion" },
              ] as const
            ).map((opt) => (
              <BlockButton
                key={opt.id}
                size="sm"
                variant={motion === opt.id ? "primary" : "ghost"}
                aria-pressed={motion === opt.id}
                onClick={() => applyMotion(opt.id)}
              >
                {opt.label}
              </BlockButton>
            ))}
          </div>
        </fieldset>
      </BlockPanel>

      <BlockPanel variant="panel" title="Account">
        <dl className="flex flex-col gap-[calc(var(--mc-unit)*0.5)] text-[16px]">
          <div className="flex flex-wrap gap-x-[var(--mc-unit)]">
            <dt className="text-mc-text-dim">Email</dt>
            <dd>{session?.email ?? "—"}</dd>
          </div>
          <div className="flex flex-wrap gap-x-[var(--mc-unit)]">
            <dt className="text-mc-text-dim">Player</dt>
            <dd>{character?.playerName ?? "—"}</dd>
          </div>
          <div className="flex flex-wrap gap-x-[var(--mc-unit)]">
            <dt className="text-mc-text-dim">Roles</dt>
            <dd>{session?.roles.join(", ") ?? "—"}</dd>
          </div>
        </dl>
      </BlockPanel>

      <BlockPanel variant="panel" title="Prototype data">
        <p className="text-[15px] text-mc-text-dim">
          This build stores everything in this browser only — accounts, characters
          and registrations do not sync across devices, and anyone with devtools
          can edit them. Real accounts arrive with the Supabase backend.
        </p>
        <div className="mt-[var(--mc-unit)]">
          <BlockButton variant="danger" size="sm" onClick={resetEverything}>
            Reset all local data
          </BlockButton>
        </div>
      </BlockPanel>
    </div>
  );
}
