"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap, useGSAP } from "@/frontend/lib/animation/gsap-init";
import { BadgeSlot, BlockButton, BlockModal } from "@/frontend/components/mc";
import { useSession } from "@/frontend/components/auth/session-provider";
import { repo } from "@/backend/data";
import type { Achievement, Rarity } from "@/backend/data/types";

/**
 * SCREEN 8 — "Achievement unlocked!"
 *
 * Queue-driven: it reads every unlocked-but-unseen achievement and shows them
 * one at a time, marking each seen on dismiss. So earning three at once produces
 * three sequential cinematics rather than one overwriting the others.
 *
 * GSAP runs the badge entrance and particle burst INSIDE the Framer-animated
 * modal. That is allowed by the GSAP-vs-Framer split because they animate
 * different elements — Framer the dialog container, GSAP its contents — never
 * the same property on the same node.
 */
export function AchievementModal() {
  const { session } = useSession();
  const [queue, setQueue] = useState<Achievement[]>([]);
  const [open, setOpen] = useState(false);
  const burstRoot = useRef<HTMLDivElement>(null);

  const current = queue[0] ?? null;

  const loadQueue = useCallback(async () => {
    if (!session) return;
    const [unseen, all] = await Promise.all([
      repo.achievements.listUnseen(session.userId),
      repo.achievements.listAll(),
    ]);
    const byId = new Map(all.map((a) => [a.id, a]));
    const pending = unseen
      .map((u) => byId.get(u.achievementId))
      .filter((a): a is Achievement => Boolean(a));

    setQueue(pending);
    setOpen(pending.length > 0);
  }, [session]);

  useEffect(() => {
    // Fetching pending unlocks from the data layer on mount. The setState calls
    // inside loadQueue happen after an await, so the cascade this rule guards
    // against cannot occur — the linter simply cannot see past the async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadQueue();
  }, [loadQueue]);

  // Badge entrance + particle burst.
  useGSAP(
    () => {
      if (!open || !current) return;

      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        // Show the final state with no motion.
        gsap.set(".ach-badge", { scale: 1, rotate: 0, opacity: 1 });
        gsap.set(".ach-particle", { opacity: 0 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline();

        tl.fromTo(
          ".ach-badge",
          { scale: 0.2, rotate: -25, opacity: 0 },
          { scale: 1, rotate: 0, opacity: 1, duration: 0.55, ease: "back.out(2.2)" },
        ).fromTo(
          ".ach-particle",
          { x: 0, y: 0, opacity: 1, scale: 1 },
          {
            // Fan the particles outward from the badge centre.
            x: (i: number) => Math.cos((i / 12) * Math.PI * 2) * 90,
            y: (i: number) => Math.sin((i / 12) * Math.PI * 2) * 90,
            opacity: 0,
            scale: 0.4,
            duration: 0.85,
            ease: "power2.out",
            stagger: 0.015,
          },
          "-=0.25",
        );

        return () => tl.kill();
      });

      return () => mm.revert();
    },
    { scope: burstRoot, dependencies: [open, current?.id] },
  );

  async function dismiss() {
    if (!session || !current) return;
    await repo.achievements.markSeen(session.userId, current.id);

    const rest = queue.slice(1);
    setQueue(rest);
    // Close between items so the entrance animation replays for the next one.
    if (rest.length === 0) setOpen(false);
  }

  if (!current) return null;

  return (
    <BlockModal
      open={open}
      onOpenChange={(next) => {
        if (!next) void dismiss();
      }}
      title="Achievement Unlocked!"
      variant="gold"
      description={`${current.name}: ${current.description}`}
      footer={
        <BlockButton variant="gold" onClick={dismiss}>
          {queue.length > 1 ? `Next (${queue.length - 1} more)` : "Awesome!"}
        </BlockButton>
      }
    >
      <div ref={burstRoot} className="flex items-center gap-[calc(var(--mc-unit)*2)]">
        <div className="relative grid shrink-0 place-items-center">
          <div className="ach-badge">
            <BadgeSlot
              code={current.code}
              name={current.name}
              rarity={current.rarity as Rarity}
              unlocked
              size={84}
            />
          </div>

          {/* Particle burst. Decorative. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
            {Array.from({ length: 12 }, (_, i) => (
              <span
                key={i}
                className="ach-particle absolute block h-[6px] w-[6px] bg-mc-gold-light opacity-0"
              />
            ))}
          </div>
        </div>

        <div className="min-w-0">
          <p className="font-pixel text-[12px] text-mc-gold-light">{current.name}</p>
          <p className="mt-[calc(var(--mc-unit)*0.5)] text-mc-text-dim">
            {current.description}
          </p>
          {current.flavorText ? (
            <p className="mt-[calc(var(--mc-unit)*0.5)] text-[15px] italic text-mc-text-dim/80">
              {current.flavorText}
            </p>
          ) : null}
          <p className="mt-[var(--mc-unit)] font-pixel text-[10px] uppercase text-mc-emerald-light">
            {current.rarity}
            {current.xpReward > 0 ? ` · +${current.xpReward} XP` : ""}
          </p>
        </div>
      </div>
    </BlockModal>
  );
}
