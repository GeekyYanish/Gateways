"use client";

import { BadgeSlot, BlockPanel, LoadingBlocks } from "@/frontend/components/mc";
import { AchievementModal } from "@/frontend/components/achievements/achievement-modal";
import { useSession } from "@/frontend/components/auth/session-provider";
import { useAsync } from "@/frontend/hooks/use-async";
import { repo } from "@/backend/data";
import type { Rarity } from "@/backend/data/types";

export function AchievementsScreen() {
  const { session } = useSession();
  const userId = session?.userId;

  const { data: all, loading } = useAsync(() => repo.achievements.listAll(), []);
  const { data: mine } = useAsync(
    async () => (userId ? repo.achievements.listForUser(userId) : []),
    [userId],
  );

  const unlocked = new Map((mine ?? []).map((u) => [u.achievementId, u]));

  return (
    <div className="flex flex-col gap-[calc(var(--mc-unit)*1.5)]">
      <AchievementModal />
      <header>
        <h1 className="text-mc-accent text-base md:text-lg">ACHIEVEMENTS</h1>
        <p className="mt-[calc(var(--mc-unit)*0.5)] text-mc-text-dim">
          {unlocked.size} of {all?.length ?? 0} unlocked.
        </p>
      </header>

      {loading ? (
        <BlockPanel variant="slot"><LoadingBlocks label="Loading" /></BlockPanel>
      ) : (
        <ul className="grid gap-[var(--mc-unit)] sm:grid-cols-2">
          {(all ?? []).map((a) => {
            const got = unlocked.get(a.id);
            const hidden = !got && a.isSecret;
            return (
              <li key={a.id}>
                <BlockPanel
                  variant={got ? "panel" : "slot"}
                  padded="md"
                  className="flex h-full items-start gap-[var(--mc-unit)]"
                >
                  <BadgeSlot
                    code={a.code}
                    name={a.name}
                    rarity={a.rarity as Rarity}
                    unlocked={Boolean(got)}
                    secret={a.isSecret}
                    size={56}
                  />
                  <div className="min-w-0">
                    <p className="font-pixel text-[10px] text-mc-text">
                      {hidden ? "Hidden achievement" : a.name}
                    </p>
                    <p className="mt-[2px] text-[15px] text-mc-text-dim">
                      {hidden ? "Keep exploring to reveal this one." : a.description}
                    </p>
                    <p className="mt-[calc(var(--mc-unit)*0.5)] font-pixel text-[8px] uppercase text-mc-text-dim">
                      {a.rarity}
                      {a.xpReward > 0 ? ` · +${a.xpReward} XP` : ""}
                      {got ? ` · unlocked ${new Date(got.unlockedAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                </BlockPanel>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
