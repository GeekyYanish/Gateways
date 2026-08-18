"use client";

import { useState } from "react";
import { BlockButton, BlockInput, BlockPanel, LoadingBlocks, PixelAvatar, XpBar } from "@/frontend/components/mc";
import { ParticipantDetailsModal } from "@/frontend/components/registration/participant-details-modal";
import { useSession } from "@/frontend/components/auth/session-provider";
import { useAsync } from "@/frontend/hooks/use-async";
import { repo, xpProgress } from "@/backend/data";
import { DataError } from "@/backend/data/types";
import { isParticipantComplete } from "@/backend/data/types";

export function ProfileScreen() {
  const { session, character, refresh } = useSession();
  const userId = session?.userId;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const { data: levels } = useAsync(() => repo.reference.levels(), []);
  const { data: colleges } = useAsync(() => repo.reference.colleges(), []);
  /**
   * The participant record the registration flow reads. Surfacing it here is
   * the point of this panel: the details used to be reachable only by pressing
   * Register on an event and being interrupted by the modal, so there was no
   * way to fill them in advance — or to correct a typo afterwards.
   */
  const { data: profile, reload: reloadProfile } = useAsync(
    async () => (userId ? repo.profiles.get(userId) : null),
    [userId],
  );
  /**
   * Keyed off the PROFILE's college first: the details panel resolves a
   * department name from the profile, so loading the list for a different
   * college would leave that row showing a dash for a value that is set.
   */
  const detailsCollegeId = profile?.collegeId ?? character?.collegeId ?? null;
  const { data: departments } = useAsync(
    () => repo.reference.departments(detailsCollegeId),
    [detailsCollegeId],
  );
  const { data: rank } = useAsync(async () => (userId ? repo.leaderboard.rankOf(userId) : null), [userId]);
  const { data: ledger } = useAsync(async () => (userId ? repo.xp.ledger(userId) : []), [userId]);
  const { data: attendance } = useAsync(async () => (userId ? repo.attendance.listForUser(userId) : []), [userId]);

  /**
   * Rename. The availability check is a courtesy — it makes the common
   * collision a clear message instead of a thrown error — but it is NOT the
   * guarantee. `updateCharacter` re-checks inside the writing transaction,
   * because anything checked here can be taken between this call and the save.
   */
  async function onSaveUsername() {
    if (!userId) return;
    const next = nameDraft.trim();
    if (next.length < 3 || next.length > 24) {
      setNameError("Between 3 and 24 characters.");
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(next)) {
      setNameError("Letters, numbers, hyphen and underscore only.");
      return;
    }
    if (next === character?.playerName) {
      setEditingName(false);
      return;
    }
    setNameBusy(true);
    setNameError(null);
    try {
      if (await repo.characters.isPlayerNameTaken(next, userId)) {
        setNameError("That username is already taken.");
        return;
      }
      await repo.characters.update(userId, { playerName: next });
      await refresh();
      setEditingName(false);
    } catch (e) {
      setNameError(
        e instanceof DataError ? e.message : "Could not change the username.",
      );
    } finally {
      setNameBusy(false);
    }
  }

  /*
    Only the reference levels are required to render anything, and only because
    the XP bar needs them.

    This used to also gate on `character`, which hung the whole page on
    "Loading profile" forever for anyone without one — character creation was
    removed from signup, so a null character is now a NORMAL state, not a
    transient one. The participant details below do not need a character at all,
    and they are the part of this page you actually have to reach.
  */
  if (!levels) {
    return <BlockPanel variant="slot"><LoadingBlocks label="Loading profile" /></BlockPanel>;
  }

  const progress = character ? xpProgress(character.totalXp, levels) : null;
  const detailsComplete = isParticipantComplete(profile ?? null, character);
  // Resolved against the PROFILE's ids, not the character's — the panel below
  // reports what registration will actually send.
  const detailCollege = colleges?.find((c) => c.id === profile?.collegeId);
  const detailDepartment = departments?.find((d) => d.id === profile?.departmentId);
  const college = colleges?.find((c) => c.id === character?.collegeId);
  const department = departments?.find((d) => d.id === character?.departmentId);

  return (
    <div className="flex flex-col gap-[calc(var(--mc-unit)*1.5)]">
      <h1 className="text-mc-accent text-base md:text-lg">PROFILE</h1>

      {/*
        Username, kept separate from the participant details below: it is the
        account's public identity, not fest paperwork, and it is the one field
        here with a uniqueness rule attached.

        Signup derives it from the name plus the user id, which produces things
        like "YanishRai_019ffc9b…" — legible to a database and to nobody else.
      */}
      {character ? (
        <BlockPanel variant="panel" padded="lg" className="flex flex-col gap-[var(--mc-unit)]">
          <h2 className="font-pixel text-[10px] uppercase tracking-[0.1em] text-mc-success">
            Username
          </h2>
          {editingName ? (
            <>
              <BlockInput
                label="New username"
                value={nameDraft}
                maxLength={24}
                autoFocus
                error={nameError ?? undefined}
                onChange={(e) => setNameDraft(e.target.value)}
                hint="3–24 characters. Letters, numbers, hyphen and underscore."
              />
              <div className="flex flex-wrap gap-[var(--mc-unit)]">
                <BlockButton variant="emerald" size="sm" loading={nameBusy} onClick={onSaveUsername}>
                  Save username
                </BlockButton>
                <BlockButton
                  variant="stone"
                  size="sm"
                  onClick={() => {
                    setEditingName(false);
                    setNameError(null);
                  }}
                >
                  Cancel
                </BlockButton>
              </div>
            </>
          ) : (
            <>
              <p className="break-all text-[17px] text-mc-text">{character.playerName}</p>
              <div>
                <BlockButton
                  variant="gold"
                  size="sm"
                  onClick={() => {
                    setNameDraft(character.playerName);
                    setNameError(null);
                    setEditingName(true);
                  }}
                >
                  Change username
                </BlockButton>
              </div>
              <p className="text-[15px] text-mc-text-dim">
                This is the name teammates and the leaderboard see.
              </p>
            </>
          )}
        </BlockPanel>
      ) : null}

      {userId ? (
        <ParticipantDetailsModal
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          userId={userId}
          profile={profile ?? null}
          character={character}
          onSaved={async () => {
            await reloadProfile();
            setDetailsOpen(false);
          }}
        />
      ) : null}

      {/*
        Same modal the event page uses, so there is ONE form and one set of
        validation rules for these fields. Filling them here means Register goes
        straight through instead of stopping to collect them.
      */}
      <BlockPanel variant="panel" padded="lg" className="flex flex-col gap-[var(--mc-unit)]">
        <div className="flex flex-wrap items-baseline justify-between gap-[var(--mc-unit)]">
          <h2 className="font-pixel text-[10px] uppercase tracking-[0.1em] text-mc-success">
            Participant details
          </h2>
          <span
            className={
              detailsComplete
                ? "font-pixel text-[9px] uppercase text-mc-emerald-light"
                : "font-pixel text-[9px] uppercase text-mc-gold"
            }
          >
            {detailsComplete ? "Complete" : "Incomplete"}
          </span>
        </div>

        <dl className="grid gap-[var(--mc-unit)] sm:grid-cols-2">
          <Detail label="Full name" value={profile?.fullName} />
          <Detail label="Mobile" value={profile?.phone} />
          <Detail label="College" value={detailCollege?.name} />
          <Detail label="Department" value={detailDepartment?.name} />
          <Detail label="Year of study" value={profile?.yearOfStudy ? `Year ${profile.yearOfStudy}` : null} />
          <Detail label="Date of birth" value={profile?.dateOfBirth} />
          <Detail label="Gender" value={profile?.gender} />
          <Detail label="Category" value={profile?.category} />
          <Detail label="T-shirt" value={profile?.tshirtSize} />
          <Detail label="Dietary" value={profile?.dietaryPref} />
          <Detail label="Emergency contact" value={profile?.emergencyName} />
          <Detail label="Emergency number" value={profile?.emergencyPhone} />
        </dl>

        <div>
          <BlockButton
            variant={detailsComplete ? "stone" : "gold"}
            size="sm"
            onClick={() => setDetailsOpen(true)}
          >
            {detailsComplete ? "Edit details" : "Complete your details"}
          </BlockButton>
        </div>

        <p className="text-[15px] text-mc-text-dim">
          Asked once and reused for every event you register for.
        </p>
      </BlockPanel>

      {/* Everything below needs a character. Rendered only when there is one,
          rather than blocking the page — see the note on the guard above. */}
      {character && progress ? (
        <>
          <BlockPanel variant="panel" padded="lg" className="flex flex-wrap items-center gap-[calc(var(--mc-unit)*2)]">
            <PixelAvatar skinId={character.skinId} size={96} full />
            <div className="w-full min-w-0 flex-1 sm:min-w-[220px]">
              <p className="font-pixel text-[14px] text-mc-success">{character.playerName}</p>
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
        </>
      ) : null}

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
                  <span className="text-[15px] text-mc-success tabular-nums">+{e.amount} XP</span>
                </BlockPanel>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="font-pixel text-[9px] uppercase text-mc-text-dim">{label}</dt>
      <dd className="mt-[2px] text-[16px] text-mc-text">{value || "—"}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <BlockPanel variant="panel" padded="md" className="text-center">
      <p className="font-pixel text-[9px] uppercase text-mc-text-dim">{label}</p>
      <p className="mt-[calc(var(--mc-unit)*0.5)] font-pixel text-[16px] text-mc-accent-strong">{value}</p>
    </BlockPanel>
  );
}
