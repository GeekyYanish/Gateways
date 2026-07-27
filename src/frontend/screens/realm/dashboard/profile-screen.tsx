"use client";

import { BlockPanel, LoadingBlocks, PixelAvatar, XpBar } from "@/frontend/components/mc";
import { useSession } from "@/frontend/components/auth/session-provider";
import { useAsync } from "@/frontend/hooks/use-async";
import { repo, xpProgress } from "@/backend/data";

export function ProfileScreen() {
  const { session, character } = useSession();
  const userId = session?.userId;

  const { data: levels } = useAsync(() => repo.reference.levels(), []);
  const { data: colleges } = useAsync(() => repo.reference.colleges(), []);
  const { data: departments } = useAsync(() => repo.reference.departments(character?.collegeId ?? null), [character?.collegeId]);
  const { data: rank } = useAsync(async () => (userId ? repo.leaderboard.rankOf(userId) : null), [userId]);
  const { data: ledger } = useAsync(async () => (userId ? repo.xp.ledger(userId) : []), [userId]);
  const { data: attendance } = useAsync(async () => (userId ? repo.attendance.listForUser(userId) : []), [userId]);

  if (!character || !levels) {
    return <BlockPanel variant="slot"><LoadingBlocks label="Loading profile" /></BlockPanel>;
  }

  const progress = xpProgress(character.totalXp, levels);
  const college = colleges?.find((c) => c.id === character.collegeId);
  const department = departments?.find((d) => d.id === character.departmentId);

  return (
    <div className="flex flex-col gap-[calc(var(--mc-unit)*1.5)]">
      <h1 className="text-mc-gold text-base md:text-lg">PROFILE</h1>

      <BlockPanel variant="panel" padded="lg" className="flex flex-wrap items-center gap-[calc(var(--mc-unit)*2)]">
        <PixelAvatar skinId={character.skinId} size={96} full />
        <div className="min-w-[220px] flex-1">
          <p className="font-pixel text-[14px] text-mc-emerald-light">{character.playerName}</p>
          <p className="mt-[calc(var(--mc-unit)*0.5)] text-[16px] text-mc-text-dim">
            {college?.name ?? "—"}
            {department ? ` · ${department.name}` : ""}
            {character.yearOfStudy ? ` · Year ${character.yearOfStudy}` : ""}
          </p>
          <XpBar
            className="mt-[var(--mc-unit)]"
            current={progress.current}
            required={progress.required}
            level={progress.level}
            title={progress.title}
          />
        </div>
      </BlockPanel>

      <div className="grid gap-[var(--mc-unit)] sm:grid-cols-3">
        <Stat label="Rank" value={rank ? `#${rank}` : "—"} />
        <Stat label="Total XP" value={String(character.totalXp)} />
        <Stat label="Events attended" value={String(attendance?.length ?? 0)} />
      </div>

      <section>
        <h2 className="font-pixel text-[11px] uppercase text-mc-text-dim">XP history</h2>
        {(ledger ?? []).length === 0 ? (
          <p className="mt-[calc(var(--mc-unit)*0.5)] text-[15px] text-mc-text-dim">No XP earned yet.</p>
        ) : (
          <ul className="mt-[var(--mc-unit)] flex flex-col gap-[3px]">
            {(ledger ?? []).map((e) => (
              <li key={e.id}>
                <BlockPanel variant="slot" padded="sm" className="flex flex-wrap justify-between gap-[var(--mc-unit)]">
                  <span className="text-[15px]">{e.reason}</span>
                  <span className="text-[15px] text-mc-emerald-light tabular-nums">+{e.amount} XP</span>
                </BlockPanel>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <BlockPanel variant="panel" padded="md" className="text-center">
      <p className="font-pixel text-[9px] uppercase text-mc-text-dim">{label}</p>
      <p className="mt-[calc(var(--mc-unit)*0.5)] font-pixel text-[16px] text-mc-gold-light">{value}</p>
    </BlockPanel>
  );
}
