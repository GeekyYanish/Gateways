"use client";

import { BackLink, BlockPanel, LoadingBlocks, PixelAvatar } from "@/frontend/components/mc";
import { useSession } from "@/frontend/components/auth/session-provider";
import { useAsync } from "@/frontend/hooks/use-async";
import { cn } from "@/frontend/lib/utils";
import { repo } from "@/backend/data";

/**
 * Leaderboard. Ranked by XP desc with created-at as a deterministic tiebreak,
 * so positions do not shuffle between reloads when players are level-pegged.
 */
export function LeaderboardScreen() {
  const { session } = useSession();
  const { data: rows, loading } = useAsync(() => repo.leaderboard.top(50), []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--mc-unit)] px-[calc(var(--mc-unit)*2)] py-[calc(var(--mc-unit)*1.5)] md:p-[calc(var(--mc-unit)*2)]">
      <BackLink href="/" label="Home" />

      <header>
        <h1 className="text-mc-accent text-base md:text-lg">LEADERBOARD CASTLE</h1>
        <p className="mt-[calc(var(--mc-unit)*0.5)] text-mc-text-dim">
          Earn XP by registering for events and checking in.
        </p>
      </header>

      {loading ? (
        <BlockPanel variant="slot">
          <LoadingBlocks label="Ranking adventurers" />
        </BlockPanel>
      ) : (rows ?? []).length === 0 ? (
        <BlockPanel variant="slot" className="text-center">
          <p className="text-mc-text-dim">No adventurers yet. Be the first!</p>
        </BlockPanel>
      ) : (
        <BlockPanel variant="slot" padded="sm">
          {/* A real table: rank/name/level/XP is tabular data, and a screen
              reader should be able to navigate it by column. */}
          <table className="w-full border-collapse">
            <caption className="sr-only">Top adventurers by experience points</caption>
            <thead>
              <tr className="text-left">
                <th scope="col" className="p-[calc(var(--mc-unit)*0.5)] font-pixel text-[9px] uppercase text-mc-text-dim">
                  #
                </th>
                <th scope="col" className="p-[calc(var(--mc-unit)*0.5)] font-pixel text-[9px] uppercase text-mc-text-dim">
                  Player
                </th>
                <th scope="col" className="hidden p-[calc(var(--mc-unit)*0.5)] font-pixel text-[9px] uppercase text-mc-text-dim sm:table-cell">
                  College
                </th>
                <th scope="col" className="p-[calc(var(--mc-unit)*0.5)] text-right font-pixel text-[9px] uppercase text-mc-text-dim">
                  Level
                </th>
                <th scope="col" className="p-[calc(var(--mc-unit)*0.5)] text-right font-pixel text-[9px] uppercase text-mc-text-dim">
                  XP
                </th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r) => {
                const isMe = r.userId === session?.userId;
                return (
                  <tr
                    key={r.characterId}
                    className={cn(
                      "border-t-[2px] border-mc-border",
                      isMe && "bg-mc-portal/20",
                    )}
                  >
                    <td className="p-[calc(var(--mc-unit)*0.5)] font-pixel text-[11px] text-mc-accent-strong tabular-nums">
                      {r.rank}
                    </td>
                    <td className="p-[calc(var(--mc-unit)*0.5)]">
                      <span className="flex items-center gap-[calc(var(--mc-unit)*0.6)]">
                        <PixelAvatar skinId={r.skinId} size={28} />
                        <span className="min-w-0">
                          <span className="block truncate text-[16px]">
                            {r.playerName}
                            {isMe ? (
                              <span className="ml-1 text-[13px] text-mc-eyebrow">
                                (you)
                              </span>
                            ) : null}
                          </span>
                          {r.title ? (
                            <span className="block text-[13px] text-mc-text-dim">
                              {r.title}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </td>
                    <td className="hidden p-[calc(var(--mc-unit)*0.5)] text-[15px] text-mc-text-dim sm:table-cell">
                      {r.college ?? "—"}
                    </td>
                    <td className="p-[calc(var(--mc-unit)*0.5)] text-right text-[16px] tabular-nums">
                      {r.level}
                    </td>
                    <td className="p-[calc(var(--mc-unit)*0.5)] text-right text-[16px] text-mc-success tabular-nums">
                      {r.totalXp}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </BlockPanel>
      )}
    </div>
  );
}
