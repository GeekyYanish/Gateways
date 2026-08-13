"use client";

import { useEffect, useState } from "react";
import { repo } from "@/backend/data";
import { DataError, type Profile } from "@/backend/data/types";
import { clearAll } from "@/backend/data/local/store";

/**
 * Dev-only assertion harness for the data layer.
 *
 * These are the guarantees the whole design leans on — idempotent XP grants,
 * no double registration, capacity handling, deterministic leaderboard ranking.
 * They are enforced in code that has no compiler help, so they get exercised
 * for real rather than assumed. When the MySQL repository lands, this same
 * page should pass unchanged: that is the point of the interface.
 */

interface Result {
  name: string;
  pass: boolean;
  detail: string;
}

/** A complete participant record — what `register()` now requires. */
const PARTICIPANT_DETAILS = {
  fullName: "Ridge Seven",
  phone: "9876543210",
  gender: "male",
  dateOfBirth: "2005-04-12",
  category: "participant",
  tshirtSize: "M",
  emergencyName: "Guardian Seven",
  emergencyPhone: "9876500000",
  dietaryPref: "veg",
} satisfies Partial<Profile>;

/**
 * A throwaway user complete enough to hold a seat.
 *
 * Capacity tests need real users now, not bare ids — `register()` reads the
 * profile and character, so a synthetic string would simply be refused. Note
 * this SWITCHES the active session (signUp signs you in), so callers must
 * restore theirs afterwards.
 */
async function makeParticipant(n: number, collegeId: string | null): Promise<string> {
  const s = await repo.auth.signUp(`synthetic${n}@parallax.test`, "hunter2!");
  await repo.characters.create(s.userId, {
    playerName: `Synth_${n}`,
    // A real college id, because `isParticipantComplete()` requires one — the
    // console's participant record has no meaning without it.
    collegeId,
    departmentId: null,
    yearOfStudy: 2,
    skinId: "prospector",
  });
  await repo.profiles.update(s.userId, PARTICIPANT_DETAILS);
  return s.userId;
}

async function runSuite(): Promise<Result[]> {
  const out: Result[] = [];
  const check = (name: string, pass: boolean, detail = "") =>
    out.push({ name, pass, detail });

  // Start from a clean store so results are deterministic.
  clearAll();

  const email = `test${Date.now()}@parallax.test`;

  // --- auth ---------------------------------------------------------------
  const session = await repo.auth.signUp(email, "hunter2!");
  check("signUp creates a session", Boolean(session.userId), session.userId);
  check("new user is a player", session.roles.includes("player"), session.roles.join(","));

  try {
    await repo.auth.signUp(email, "different");
    check("duplicate email rejected", false, "no error thrown");
  } catch (e) {
    check(
      "duplicate email rejected",
      e instanceof DataError && e.code === "EMAIL_TAKEN",
      (e as DataError).code,
    );
  }

  try {
    await repo.auth.signIn(email, "wrong-password");
    check("wrong password rejected", false, "no error thrown");
  } catch (e) {
    check(
      "wrong password rejected",
      e instanceof DataError && e.code === "INVALID_CREDENTIALS",
      (e as DataError).code,
    );
  }

  const reSignIn = await repo.auth.signIn(email, "hunter2!");
  check("correct password accepted", reSignIn.userId === session.userId);

  // Passwords must never be recoverable from storage.
  const rawCreds = JSON.stringify(
    JSON.parse(localStorage.getItem("parallax:v1:credentials") ?? "[]"),
  );
  check(
    "password not stored in plaintext",
    !rawCreds.includes("hunter2!"),
    rawCreds.includes("hunter2!") ? "FOUND PLAINTEXT PASSWORD" : "hashed",
  );

  const userId = session.userId;

  // --- character ----------------------------------------------------------
  const colleges = await repo.reference.colleges();
  const departments = await repo.reference.departments(colleges[0]?.id);

  const character = await repo.characters.create(userId, {
    playerName: "Ridge_07",
    collegeId: colleges[0]?.id ?? null,
    departmentId: departments[0]?.id ?? null,
    yearOfStudy: 2,
    skinId: "prospector",
  });
  check("character created", character.playerName === "Ridge_07");
  check("starts at level 1", character.level === 1, `level ${character.level}`);

  check(
    "player name is case-insensitively unique",
    await repo.characters.isPlayerNameTaken("ridge_07"),
    "ridge_07 vs Ridge_07",
  );

  try {
    await repo.characters.create(userId, {
      playerName: "no-dashes-allowed!",
      collegeId: null,
      departmentId: null,
      yearOfStudy: 1,
      skinId: "botanist",
    });
    check("invalid player name rejected", false, "no error thrown");
  } catch (e) {
    check(
      "invalid player name rejected",
      e instanceof DataError && e.code === "VALIDATION_FAILED",
      (e as DataError).code,
    );
  }

  // --- registration -------------------------------------------------------
  const events = await repo.events.list({ status: ["published"] });
  check("seeded events exist", events.length > 0, `${events.length} events`);

  const target = events[0];

  // Registration is gated on a complete participant record — the console
  // cannot render one without these fields, so a seat is not held for a
  // half-filled form. See BACKEND-API-CONTRACT.md §1.
  try {
    await repo.registrations.register(target.id, userId);
    check("registration without participant details rejected", false, "no error thrown");
  } catch (e) {
    check(
      "registration without participant details rejected",
      e instanceof DataError && e.code === "VALIDATION_FAILED",
      (e as DataError).code,
    );
  }

  await repo.profiles.update(userId, PARTICIPANT_DETAILS);

  // Register BEFORE paying: the seat is held immediately, but stays `pending`
  // until the entry fee clears.
  const reg = await repo.registrations.register(target.id, userId);
  check("registration held pending payment", reg.status === "pending", reg.status);

  // Against the LEDGER, not totalXp: registering also unlocks achievements,
  // which pay their own XP. Only registration-sourced grants are in question.
  const regXp = async (id: string) =>
    (await repo.xp.ledger(id))
      .filter((e) => e.sourceType === "registration")
      .reduce((s, e) => s + e.amount, 0);

  check("no registration XP for an unpaid seat", (await regXp(userId)) === 0, `${await regXp(userId)} xp`);

  // Unique (eventId, userId): the same pair returns the existing row rather
  // than creating a second one, matching the DB constraint.
  const again = await repo.registrations.register(target.id, userId);
  check(
    "re-registering returns the same row",
    again.id === reg.id,
    `${again.id} vs ${reg.id}`,
  );

  // --- payment confirms the seat ------------------------------------------
  const receipt = await repo.paymentReceipts.submit({
    registrationId: reg.id,
    eventId: target.id,
    userId,
    fileData: "data:application/pdf;base64,JVBERi0x",
    fileName: "receipt.pdf",
    fileSizeBytes: 8,
  });

  try {
    await repo.paymentReceipts.submit({
      registrationId: reg.id,
      eventId: target.id,
      userId,
      fileData: "data:application/pdf;base64,JVBERi0x",
      fileName: "again.pdf",
      fileSizeBytes: 8,
    });
    check("second live receipt rejected", false, "no error thrown");
  } catch (e) {
    check(
      "second live receipt rejected",
      e instanceof DataError && e.code === "RECEIPT_ALREADY_SUBMITTED",
      (e as DataError).code,
    );
  }

  await repo.paymentReceipts.review(receipt.id, "verified", "admin-test");
  const settled = await repo.registrations.get(target.id, userId);
  check(
    "verifying the receipt confirms the seat",
    settled?.status === "confirmed",
    `${settled?.status}`,
  );

  // --- XP idempotency (the critical guarantee) ----------------------------
  check(
    "confirming the seat awards registration XP exactly once",
    (await regXp(userId)) === 10,
    `${await regXp(userId)} xp`,
  );

  const afterReg = await repo.characters.getByUser(userId);
  const xpAfterReg = afterReg?.totalXp ?? 0;

  await repo.xp.award({
    userId,
    amount: 10,
    reason: `Registered for ${target.title}`,
    sourceType: "registration",
    sourceId: target.id,
  });
  const afterDupe = await repo.characters.getByUser(userId);
  check(
    "duplicate XP grant does not double-pay",
    afterDupe?.totalXp === xpAfterReg,
    `${xpAfterReg} -> ${afterDupe?.totalXp}`,
  );

  // A genuinely different source SHOULD add XP.
  await repo.xp.award({
    userId,
    amount: 25,
    reason: "Manual bonus",
    sourceType: "admin",
    sourceId: "bonus-1",
  });
  const afterBonus = await repo.characters.getByUser(userId);
  check(
    "distinct XP source does add",
    (afterBonus?.totalXp ?? 0) === xpAfterReg + 25,
    `${afterBonus?.totalXp}`,
  );

  // --- totalXp is derived, not accumulated -------------------------------
  const ledger = await repo.xp.ledger(userId);
  const ledgerSum = ledger.reduce((s, e) => s + e.amount, 0);
  check(
    "totalXp equals ledger sum",
    (afterBonus?.totalXp ?? -1) === ledgerSum,
    `cache ${afterBonus?.totalXp} vs ledger ${ledgerSum}`,
  );

  // --- achievements -------------------------------------------------------
  const unlocked = await repo.achievements.listForUser(userId);
  check(
    "achievements unlocked by triggers",
    unlocked.length > 0,
    `${unlocked.length} unlocked`,
  );

  const firstSteps = await repo.achievements.unlock(userId, "first_steps");
  check(
    "re-unlocking an achievement is a no-op",
    firstSteps === null,
    firstSteps === null ? "returned null" : "created a duplicate!",
  );

  const unseen = await repo.achievements.listUnseen(userId);
  check("unseen achievements queue populated", unseen.length > 0, `${unseen.length} unseen`);
  if (unseen.length > 0) {
    await repo.achievements.markSeen(userId, unseen[0].achievementId);
    const after = await repo.achievements.listUnseen(userId);
    check("markSeen removes from queue", after.length === unseen.length - 1);
  }

  // --- attendance ---------------------------------------------------------
  const att1 = await repo.attendance.checkIn({ eventId: target.id, userId });
  const xpAfterCheckIn = (await repo.characters.getByUser(userId))?.totalXp ?? 0;
  const att2 = await repo.attendance.checkIn({ eventId: target.id, userId });
  const xpAfterDoubleCheckIn = (await repo.characters.getByUser(userId))?.totalXp ?? 0;

  check("double check-in returns the original record", att1.id === att2.id, att1.id);
  check(
    "double check-in does not award XP twice",
    xpAfterCheckIn === xpAfterDoubleCheckIn,
    `${xpAfterCheckIn} -> ${xpAfterDoubleCheckIn}`,
  );

  const allAttendance = await repo.attendance.listForEvent(target.id);
  check(
    "only one attendance row per (event,user)",
    allAttendance.filter((a) => a.userId === userId).length === 1,
  );

  // --- capacity / waitlist ------------------------------------------------
  // Pick the smallest-capacity event so filling it to the brim is cheap.
  const limited = events
    .filter((e) => e.capacity != null && e.capacity > 0)
    .sort((a, b) => (a.capacity ?? 0) - (b.capacity ?? 0))[0];

  if (limited?.capacity != null) {
    const cap = limited.capacity;
    const collegeId = colleges[0]?.id ?? null;

    // Fill EVERY seat — a partial fill would take a seat rather than waitlist
    // and the assertion would be vacuous. These are unpaid `pending` seats,
    // which is the point: a held seat is held whether or not it is paid for,
    // so capacity must count it.
    const startingHeld = cap - ((await repo.events.stats(limited.id)).seatsLeft ?? cap);
    for (let i = startingHeld; i < cap; i++) {
      await repo.registrations.register(limited.id, await makeParticipant(i, collegeId));
    }
    const full = await repo.events.stats(limited.id);
    check(
      "unpaid seats still consume capacity",
      full.seatsLeft === 0,
      `seatsLeft=${full.seatsLeft} at capacity ${cap}`,
    );

    const overflowUser = await makeParticipant(cap, collegeId);
    const overflow = await repo.registrations.register(limited.id, overflowUser);
    check(
      "over-capacity registration waitlists",
      overflow.status === "waitlisted",
      `status=${overflow.status} at capacity ${cap}`,
    );

    // Cancelling a held seat must promote the waitlisted user — but only as
    // far as `pending`, because they have not paid either.
    const heldReg = (await repo.registrations.listForEvent(limited.id)).find(
      (r) => r.status === "pending",
    );
    if (heldReg) {
      await repo.registrations.cancel(heldReg.id);
      const promoted = await repo.registrations.get(limited.id, overflowUser);
      check(
        "cancelling a seat promotes from the waitlist",
        promoted?.status === "pending",
        `overflow user is now ${promoted?.status}`,
      );

      const promotedXp = (await repo.xp.ledger(overflowUser))
        .filter((e) => e.sourceType === "registration")
        .reduce((s, e) => s + e.amount, 0);
      check(
        "promotion without payment awards no registration XP",
        promotedXp === 0,
        `${promotedXp} xp`,
      );
    }

    // signUp switched the session to the last synthetic user; put the suite's
    // own user back before anything downstream reads it.
    await repo.auth.signIn(email, "hunter2!");
  } else {
    check("capacity test skipped (no capped event seeded)", true, "n/a");
  }

  // --- teams --------------------------------------------------------------
  const teamEvent = events.find((e) => e.mode === "team" && e.maxTeamSize >= 2);
  if (teamEvent) {
    const team = await repo.teams.create(teamEvent.id, userId, "Block Breakers");
    check("team created with join code", team.joinCode.length === 6, team.joinCode);

    const joined = await repo.teams.join(team.joinCode, "teammate-1");
    check("join by code works", joined.id === team.id);

    const members = await repo.teams.members(team.id);
    check("team has 2 members", members.length === 2, `${members.length}`);
    check(
      "creator is leader",
      members.find((m) => m.userId === userId)?.role === "leader",
    );

    try {
      await repo.teams.join("ZZZZZZ", userId);
      check("invalid join code rejected", false, "no error");
    } catch (e) {
      check(
        "invalid join code rejected",
        e instanceof DataError && e.code === "INVALID_JOIN_CODE",
        (e as DataError).code,
      );
    }

    // Leader leaving must not orphan the team.
    await repo.teams.leave(team.id, userId);
    const afterLeave = await repo.teams.getById(team.id);
    check(
      "leader leaving promotes a new leader",
      afterLeave?.leaderId === "teammate-1",
      `leader=${afterLeave?.leaderId}`,
    );
  } else {
    check("team test skipped (no team event seeded)", true, "n/a");
  }

  // --- leaderboard --------------------------------------------------------
  await repo.characters.create("rival-user", {
    playerName: "Vale_99",
    collegeId: colleges[1]?.id ?? null,
    departmentId: null,
    yearOfStudy: 3,
    skinId: "botanist",
  });
  await repo.xp.award({
    userId: "rival-user",
    amount: 5000,
    reason: "Seed rival",
    sourceType: "admin",
    sourceId: "rival",
  });

  const board = await repo.leaderboard.top(10);
  check("leaderboard ranks by XP desc", board[0]?.playerName === "Vale_99", board[0]?.playerName);
  check(
    "ranks are 1-based and sequential",
    board.every((r, i) => r.rank === i + 1),
  );
  const myRank = await repo.leaderboard.rankOf(userId);
  check("rankOf finds the user", myRank !== null, `rank ${myRank}`);

  // Determinism: two calls must not reshuffle equal-XP players.
  const board2 = await repo.leaderboard.top(10);
  check(
    "leaderboard order is stable across calls",
    JSON.stringify(board.map((r) => r.playerName)) ===
      JSON.stringify(board2.map((r) => r.playerName)),
  );

  // --- announcements ------------------------------------------------------
  const announcements = await repo.announcements.list();
  check("seeded announcements exist", announcements.length > 0, `${announcements.length}`);
  check(
    "pinned announcements sort first",
    announcements.length < 2 || !announcements.some((a, i) => i > 0 && a.isPinned && !announcements[0].isPinned),
  );

  let received: string | null = null;
  const unsub = repo.announcements.subscribe((a) => {
    received = a.title;
  });
  await repo.announcements.create({
    scope: "global",
    eventId: null,
    collegeId: null,
    title: "Realtime test",
    body: "Should fire the subscriber.",
    severity: "info",
    isPinned: false,
    expiresAt: null,
    createdBy: null,
  });
  // The store notifies synchronously on write; yield once regardless.
  await new Promise((r) => setTimeout(r, 50));
  unsub();
  check("subscribe fires on new announcement", received === "Realtime test", String(received));

  // --- persistence --------------------------------------------------------
  const persisted = await repo.auth.getSession();
  check("session survives in storage", persisted?.userId === userId);

  return out;
}

export function DataTest() {
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    runSuite()
      .then(setResults)
      .catch((e) => setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e)));
  }, []);

  const passed = results?.filter((r) => r.pass).length ?? 0;
  const total = results?.length ?? 0;
  const allPass = results !== null && passed === total;

  return (
    <main className="mx-auto w-full max-w-3xl p-8 flex flex-col gap-4">
      <h1 className="text-mc-eyebrow text-xl">DATA LAYER TESTS</h1>

      {error ? (
        <p className="text-mc-danger" data-testid="suite-error">
          Suite threw: {error}
        </p>
      ) : null}

      {results === null && !error ? <p className="text-mc-text-dim">Running…</p> : null}

      {results ? (
        <>
          <p
            data-testid="summary"
            className={allPass ? "text-mc-success" : "text-mc-danger"}
          >
            {passed} / {total} passed
          </p>
          <ul className="flex flex-col gap-1">
            {results.map((r) => (
              <li key={r.name} className="flex gap-2 text-[16px]">
                <span className={r.pass ? "text-mc-success" : "text-mc-danger"}>
                  {r.pass ? "PASS" : "FAIL"}
                </span>
                <span>{r.name}</span>
                {r.detail ? (
                  <span className="text-mc-text-dim">— {r.detail}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </main>
  );
}
