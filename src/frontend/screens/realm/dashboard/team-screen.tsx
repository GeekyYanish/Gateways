"use client";

import Link from "next/link";
import { BlockPanel, LoadingBlocks } from "@/frontend/components/mc";
import { useSession } from "@/frontend/components/auth/session-provider";
import { useAsync } from "@/frontend/hooks/use-async";
import { repo } from "@/backend/data";

/**
 * Team roster view.
 *
 * The data layer already supports create/join/leave with size limits and leader
 * promotion (see local-repository); the create/join UI lands in Phase 7. This
 * shows real memberships rather than a placeholder.
 */
export function TeamScreen() {
  const { session } = useSession();
  const userId = session?.userId;

  const { data: teams, loading } = useAsync(
    async () => (userId ? repo.teams.listForUser(userId) : []),
    [userId],
  );
  const { data: events } = useAsync(() => repo.events.list(), []);

  return (
    <div className="flex flex-col gap-[calc(var(--mc-unit)*1.5)]">
      <h1 className="text-mc-gold text-base md:text-lg">TEAM</h1>

      {loading ? (
        <BlockPanel variant="slot"><LoadingBlocks label="Loading teams" /></BlockPanel>
      ) : (teams ?? []).length === 0 ? (
        <BlockPanel variant="slot" className="text-center">
          <p className="text-mc-text-dim">
            You are not in a team yet. Team creation opens from a team event&apos;s page —{" "}
            <Link href="/events" className="text-mc-portal-light underline">browse events</Link>.
          </p>
        </BlockPanel>
      ) : (
        <ul className="flex flex-col gap-[var(--mc-unit)]">
          {(teams ?? []).map((t) => (
            <li key={t.id}>
              <TeamCard
                teamId={t.id}
                name={t.name}
                joinCode={t.joinCode}
                isLeader={t.leaderId === userId}
                eventTitle={events?.find((e) => e.id === t.eventId)?.title ?? "Unknown event"}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TeamCard({
  teamId,
  name,
  joinCode,
  isLeader,
  eventTitle,
}: {
  teamId: string;
  name: string;
  joinCode: string;
  isLeader: boolean;
  eventTitle: string;
}) {
  const { data: members } = useAsync(() => repo.teams.members(teamId), [teamId]);

  return (
    <BlockPanel variant="panel" title={name} action={
      isLeader ? <span className="font-pixel text-[9px] uppercase text-mc-gold-light">Leader</span> : null
    }>
      <p className="text-[15px] text-mc-text-dim">{eventTitle}</p>
      <p className="mt-[calc(var(--mc-unit)*0.5)] text-[15px]">
        Join code: <code className="font-pixel text-[11px] text-mc-emerald-light">{joinCode}</code>
      </p>
      <p className="mt-[var(--mc-unit)] font-pixel text-[9px] uppercase text-mc-text-dim">
        Members ({members?.length ?? 0})
      </p>
      <ul className="mt-[calc(var(--mc-unit)*0.5)] flex flex-col gap-[2px] text-[15px] text-mc-text-dim">
        {(members ?? []).map((m) => (
          <li key={m.userId}>
            {m.userId} {m.role === "leader" ? "· leader" : ""}
          </li>
        ))}
      </ul>
    </BlockPanel>
  );
}
