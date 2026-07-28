import {
  DataError,
  type Achievement,
  type Announcement,
  type Attendance,
  type Character,
  type College,
  type Department,
  type EventCategory,
  type EventFilter,
  type EventStats,
  type FestEvent,
  type LeaderboardRow,
  type Level,
  type NewCharacter,
  type Profile,
  type Registration,
  type ScheduleSlot,
  type Sponsor,
  type Team,
  type TeamMember,
  type UserAchievement,
  type XpEntry,
  type PaymentReceipt,
} from "../types";
import type {
  AchievementRepository,
  AnnouncementRepository,
  AttendanceRepository,
  CharacterRepository,
  EventRepository,
  LeaderboardRepository,
  ProfileRepository,
  ReferenceRepository,
  RegistrationRepository,
  PaymentReceiptRepository,
  Repository,
  TeamRepository,
  Unsubscribe,
  XpRepository,
} from "../repository";
import { LocalAuth } from "./local-auth";
import { readList, subscribe, write } from "./store";
import { seedIfNeeded } from "./seed";

/**
 * localStorage implementation of the Repository interface.
 *
 * Design rules that make the eventual Supabase swap mechanical:
 *
 * - **Idempotency is enforced by a uniqueness check on the same tuple the SQL
 *   schema uses as a unique constraint.** XP grants key on
 *   (userId, sourceType, sourceId, reason); achievement unlocks on
 *   (userId, achievementId); registrations on (eventId, userId); attendance on
 *   (eventId, userId). Re-running any grant is a no-op rather than a double-pay,
 *   exactly as the database constraints will guarantee later.
 *
 * - **Derived values are recomputed, not accumulated.** `totalXp` is always the
 *   sum of the ledger, never `totalXp += amount`, so a duplicated write cannot
 *   drift the cache away from its source of truth.
 *
 * - **No method returns a reference into stored state.** Everything is a fresh
 *   object from JSON.parse, so a caller mutating a result cannot corrupt the store.
 */

const nowIso = () => new Date().toISOString();
const uid = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

/** Ensure seed data exists before any read. Cheap after the first call. */
function ready(): void {
  seedIfNeeded();
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

class LocalProfiles implements ProfileRepository {
  async get(userId: string): Promise<Profile | null> {
    ready();
    return readList<Profile>("profiles").find((p) => p.id === userId) ?? null;
  }

  async update(userId: string, patch: Partial<Profile>): Promise<Profile> {
    ready();
    const all = readList<Profile>("profiles");
    const i = all.findIndex((p) => p.id === userId);
    if (i === -1) throw new DataError("NOT_FOUND", "Profile not found.");
    // id/email/createdAt are not client-editable — strip them rather than
    // trusting the caller not to pass them.
    const safe = { ...patch };
    delete safe.id;
    delete safe.email;
    delete safe.createdAt;
    all[i] = { ...all[i], ...safe, updatedAt: nowIso() };
    write("profiles", all);
    return all[i];
  }
}

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

const PLAYER_NAME_RE = /^[A-Za-z0-9_]{3,16}$/;

class LocalCharacters implements CharacterRepository {
  async getByUser(userId: string): Promise<Character | null> {
    ready();
    return readList<Character>("characters").find((c) => c.userId === userId) ?? null;
  }

  async getByPlayerName(playerName: string): Promise<Character | null> {
    ready();
    const needle = playerName.toLowerCase();
    return (
      readList<Character>("characters").find(
        (c) => c.playerName.toLowerCase() === needle,
      ) ?? null
    );
  }

  async isPlayerNameTaken(playerName: string, excludeUserId?: string): Promise<boolean> {
    ready();
    const needle = playerName.trim().toLowerCase();
    return readList<Character>("characters").some(
      (c) => c.playerName.toLowerCase() === needle && c.userId !== excludeUserId,
    );
  }

  async create(userId: string, input: NewCharacter): Promise<Character> {
    ready();
    const name = input.playerName.trim();
    if (!PLAYER_NAME_RE.test(name)) {
      throw new DataError(
        "VALIDATION_FAILED",
        "Player name must be 3–16 characters: letters, numbers and underscores only.",
      );
    }
    if (await this.isPlayerNameTaken(name, userId)) {
      throw new DataError("PLAYER_NAME_TAKEN", "That player name is already claimed.");
    }

    const all = readList<Character>("characters");
    const existing = all.findIndex((c) => c.userId === userId);
    const now = nowIso();

    const character: Character = {
      id: existing >= 0 ? all[existing].id : uid("chr"),
      userId,
      playerName: name,
      collegeId: input.collegeId,
      departmentId: input.departmentId,
      yearOfStudy: input.yearOfStudy,
      skinId: input.skinId,
      bio: input.bio ?? null,
      totalXp: existing >= 0 ? all[existing].totalXp : 0,
      level: existing >= 0 ? all[existing].level : 1,
      title: existing >= 0 ? all[existing].title : "Wanderer",
      createdAt: existing >= 0 ? all[existing].createdAt : now,
      updatedAt: now,
    };

    if (existing >= 0) all[existing] = character;
    else all.push(character);
    write("characters", all);

    return character;
  }

  async update(userId: string, patch: Partial<NewCharacter>): Promise<Character> {
    ready();
    const all = readList<Character>("characters");
    const i = all.findIndex((c) => c.userId === userId);
    if (i === -1) throw new DataError("NOT_FOUND", "Character not found.");

    if (patch.playerName !== undefined) {
      const name = patch.playerName.trim();
      if (!PLAYER_NAME_RE.test(name)) {
        throw new DataError("VALIDATION_FAILED", "Invalid player name.");
      }
      if (await this.isPlayerNameTaken(name, userId)) {
        throw new DataError("PLAYER_NAME_TAKEN", "That player name is already claimed.");
      }
      patch = { ...patch, playerName: name };
    }

    all[i] = { ...all[i], ...patch, updatedAt: nowIso() };
    write("characters", all);
    return all[i];
  }
}

// ---------------------------------------------------------------------------
// XP + levels
// ---------------------------------------------------------------------------

class LocalXp implements XpRepository {
  async award(input: {
    userId: string;
    amount: number;
    reason: string;
    sourceType: string;
    sourceId: string;
  }): Promise<void> {
    ready();
    const ledger = readList<XpEntry>("xpLedger");

    // The idempotency guard. Mirrors the SQL unique constraint on
    // (user_id, source_type, source_id, reason).
    const duplicate = ledger.some(
      (e) =>
        e.userId === input.userId &&
        e.sourceType === input.sourceType &&
        e.sourceId === input.sourceId &&
        e.reason === input.reason,
    );
    if (duplicate) return;

    ledger.push({
      id: uid("xp"),
      userId: input.userId,
      amount: input.amount,
      reason: input.reason,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      createdAt: nowIso(),
    });
    write("xpLedger", ledger);

    recomputeCharacterXp(input.userId);
  }

  async ledger(userId: string): Promise<XpEntry[]> {
    ready();
    return readList<XpEntry>("xpLedger")
      .filter((e) => e.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

/**
 * Recompute the denormalised totalXp/level/title from the ledger.
 * Summing rather than incrementing means the cache can never drift.
 */
function recomputeCharacterXp(userId: string): void {
  const total = readList<XpEntry>("xpLedger")
    .filter((e) => e.userId === userId)
    .reduce((sum, e) => sum + e.amount, 0);

  const levels = readList<Level>("levels").sort((a, b) => a.minXp - b.minXp);
  const reached = levels.filter((l) => total >= l.minXp).pop() ?? levels[0];

  const chars = readList<Character>("characters");
  const i = chars.findIndex((c) => c.userId === userId);
  if (i === -1) return;

  chars[i] = {
    ...chars[i],
    totalXp: Math.max(0, total),
    level: reached?.level ?? 1,
    title: reached?.title ?? "Wanderer",
    updatedAt: nowIso(),
  };
  write("characters", chars);
}

export function xpProgress(
  totalXp: number,
  levels: Level[],
): { level: number; title: string; current: number; required: number } {
  const sorted = [...levels].sort((a, b) => a.minXp - b.minXp);
  const idx = Math.max(
    0,
    sorted.findLastIndex((l) => totalXp >= l.minXp),
  );
  const cur = sorted[idx];
  const next = sorted[idx + 1];

  return {
    level: cur?.level ?? 1,
    title: cur?.title ?? "Wanderer",
    current: totalXp - (cur?.minXp ?? 0),
    // At max level there is no next threshold; show the band as complete.
    required: next ? next.minXp - (cur?.minXp ?? 0) : Math.max(1, totalXp - (cur?.minXp ?? 0)),
  };
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

class LocalAchievements implements AchievementRepository {
  #xp: LocalXp;

  constructor(xp: LocalXp) {
    this.#xp = xp;
  }

  async listAll(): Promise<Achievement[]> {
    ready();
    return readList<Achievement>("achievements")
      .filter((a) => a.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async listForUser(userId: string): Promise<UserAchievement[]> {
    ready();
    return readList<UserAchievement>("userAchievements").filter((u) => u.userId === userId);
  }

  async listUnseen(userId: string): Promise<UserAchievement[]> {
    ready();
    return readList<UserAchievement>("userAchievements")
      .filter((u) => u.userId === userId && u.seenAt === null)
      .sort((a, b) => a.unlockedAt.localeCompare(b.unlockedAt));
  }

  async markSeen(userId: string, achievementId: string): Promise<void> {
    ready();
    const all = readList<UserAchievement>("userAchievements");
    const i = all.findIndex(
      (u) => u.userId === userId && u.achievementId === achievementId,
    );
    if (i === -1) return;
    all[i] = { ...all[i], seenAt: nowIso() };
    write("userAchievements", all);
  }

  async unlock(userId: string, code: string): Promise<UserAchievement | null> {
    ready();
    const achievement = readList<Achievement>("achievements").find((a) => a.code === code);
    if (!achievement) throw new DataError("NOT_FOUND", `Unknown achievement: ${code}`);

    const all = readList<UserAchievement>("userAchievements");
    // Composite-key guard: unlocking twice is a no-op, never a double XP grant.
    if (all.some((u) => u.userId === userId && u.achievementId === achievement.id)) {
      return null;
    }

    const record: UserAchievement = {
      userId,
      achievementId: achievement.id,
      unlockedAt: nowIso(),
      seenAt: null,
    };
    all.push(record);
    write("userAchievements", all);

    if (achievement.xpReward > 0) {
      await this.#xp.award({
        userId,
        amount: achievement.xpReward,
        reason: `Achievement: ${achievement.name}`,
        sourceType: "achievement",
        sourceId: achievement.id,
      });
    }

    return record;
  }

  /**
   * Re-evaluate every trigger for a user and unlock whatever now qualifies.
   * Called after registration, check-in and team actions. Idempotent by way of
   * unlock()'s composite-key guard, so calling it repeatedly is safe.
   */
  async evaluate(userId: string): Promise<UserAchievement[]> {
    ready();
    const achievements = await this.listAll();
    const character = readList<Character>("characters").find((c) => c.userId === userId);
    const registrations = readList<Registration>("registrations").filter(
      (r) => r.userId === userId && r.status !== "cancelled",
    );
    const attendance = readList<Attendance>("attendance").filter((a) => a.userId === userId);
    const teamMemberships = readList<TeamMember>("teamMembers").filter(
      (m) => m.userId === userId,
    );

    const newlyUnlocked: UserAchievement[] = [];

    for (const a of achievements) {
      let qualifies = false;

      switch (a.triggerType) {
        case "profile_completed":
          qualifies = Boolean(character);
          break;
        case "first_registration":
          qualifies = registrations.length >= 1;
          break;
        case "event_attended":
          qualifies = attendance.length >= 1;
          break;
        case "events_attended_count":
          qualifies = attendance.length >= Number(a.triggerConfig.count ?? 0);
          break;
        case "team_created":
          qualifies = teamMemberships.length >= 1;
          break;
        case "xp_threshold":
          qualifies = (character?.totalXp ?? 0) >= Number(a.triggerConfig.xp ?? 0);
          break;
        case "manual":
          qualifies = false; // granted explicitly elsewhere
          break;
      }

      if (!qualifies) continue;
      const rec = await this.unlock(userId, a.code);
      if (rec) newlyUnlocked.push(rec);
    }

    // An xp_threshold achievement can become reachable because an earlier
    // achievement in this same pass awarded XP. One extra pass catches that
    // without risking an unbounded loop.
    if (newlyUnlocked.length > 0) {
      const refreshed = readList<Character>("characters").find((c) => c.userId === userId);
      for (const a of achievements.filter((x) => x.triggerType === "xp_threshold")) {
        if ((refreshed?.totalXp ?? 0) >= Number(a.triggerConfig.xp ?? 0)) {
          const rec = await this.unlock(userId, a.code);
          if (rec) newlyUnlocked.push(rec);
        }
      }
    }

    return newlyUnlocked;
  }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

class LocalEvents implements EventRepository {
  async list(filter?: EventFilter): Promise<FestEvent[]> {
    ready();
    let events = readList<FestEvent>("events");

    if (filter?.categorySlug) {
      const cat = readList<EventCategory>("categories").find(
        (c) => c.slug === filter.categorySlug,
      );
      events = cat ? events.filter((e) => e.categoryId === cat.id) : [];
    }
    if (filter?.status?.length) {
      events = events.filter((e) => filter.status!.includes(e.status));
    }
    if (filter?.mode) {
      events = events.filter((e) => e.mode === filter.mode || e.mode === "either");
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      events = events.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          (e.tagline ?? "").toLowerCase().includes(q),
      );
    }
    if (filter?.registeredBy) {
      const mine = new Set(
        readList<Registration>("registrations")
          .filter((r) => r.userId === filter.registeredBy && r.status !== "cancelled")
          .map((r) => r.eventId),
      );
      events = events.filter((e) => mine.has(e.id));
    }

    return events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async getBySlug(slug: string): Promise<FestEvent | null> {
    ready();
    return readList<FestEvent>("events").find((e) => e.slug === slug) ?? null;
  }

  async getById(id: string): Promise<FestEvent | null> {
    ready();
    return readList<FestEvent>("events").find((e) => e.id === id) ?? null;
  }

  async stats(eventId: string): Promise<EventStats> {
    ready();
    const event = await this.getById(eventId);
    const regs = readList<Registration>("registrations").filter((r) => r.eventId === eventId);
    const confirmed = regs.filter((r) => r.status === "confirmed").length;
    const waitlist = regs.filter((r) => r.status === "waitlisted").length;
    const checkedIn = readList<Attendance>("attendance").filter(
      (a) => a.eventId === eventId,
    ).length;

    return {
      eventId,
      confirmedCount: confirmed,
      waitlistCount: waitlist,
      checkedInCount: checkedIn,
      capacity: event?.capacity ?? null,
      seatsLeft: event?.capacity == null ? null : Math.max(0, event.capacity - confirmed),
    };
  }

  async schedule(): Promise<ScheduleSlot[]> {
    ready();
    return readList<ScheduleSlot>("schedule").sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt),
    );
  }
}

// ---------------------------------------------------------------------------
// Registrations
// ---------------------------------------------------------------------------

class LocalRegistrations implements RegistrationRepository {
  #xp: LocalXp;
  #achievements: LocalAchievements;
  #events: LocalEvents;

  constructor(xp: LocalXp, achievements: LocalAchievements, events: LocalEvents) {
    this.#xp = xp;
    this.#achievements = achievements;
    this.#events = events;
  }

  async listForUser(userId: string): Promise<Registration[]> {
    ready();
    return readList<Registration>("registrations")
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));
  }

  async listForEvent(eventId: string): Promise<Registration[]> {
    ready();
    return readList<Registration>("registrations").filter((r) => r.eventId === eventId);
  }

  async get(eventId: string, userId: string): Promise<Registration | null> {
    ready();
    return (
      readList<Registration>("registrations").find(
        (r) => r.eventId === eventId && r.userId === userId,
      ) ?? null
    );
  }

  async register(eventId: string, userId: string, teamId?: string): Promise<Registration> {
    ready();
    const event = await this.#events.getById(eventId);
    if (!event) throw new DataError("NOT_FOUND", "Event not found.");

    const all = readList<Registration>("registrations");

    // Unique (eventId, userId). Reactivates a previously cancelled registration
    // rather than creating a second row, which is what the DB constraint forces.
    const existing = all.find((r) => r.eventId === eventId && r.userId === userId);
    if (existing && existing.status !== "cancelled") {
      if (event.entryFeeInr > 0 && existing.status === "pending") {
        return existing;
      }
      throw new DataError("ALREADY_REGISTERED", "You are already registered for this event.");
    }

    if (event.status !== "published" && event.status !== "ongoing") {
      throw new DataError("REGISTRATION_CLOSED", "Registration is not open for this event.");
    }
    if (event.registrationClosesAt && new Date(event.registrationClosesAt) < new Date()) {
      throw new DataError("REGISTRATION_CLOSED", "Registration has closed for this event.");
    }

    const confirmed = all.filter(
      (r) => r.eventId === eventId && r.status === "confirmed",
    ).length;
    const full = event.capacity != null && confirmed >= event.capacity;

    const record: Registration = {
      id: existing?.id ?? uid("reg"),
      eventId,
      userId,
      teamId: teamId ?? null,
      // Over capacity waitlists rather than hard-failing, so the UI can show a
      // useful state instead of an error.
      status: event.entryFeeInr > 0 ? "pending" : full ? "waitlisted" : event.requiresApproval ? "pending" : "confirmed",
      registeredAt: nowIso(),
      cancelledAt: null,
    };

    if (existing) {
      all[all.indexOf(existing)] = record;
    } else {
      all.push(record);
    }
    write("registrations", all);

    // XP only for a confirmed seat. Idempotent on (userId, 'registration', eventId).
    if (record.status === "confirmed") {
      await this.#xp.award({
        userId,
        amount: 10,
        reason: `Registered for ${event.title}`,
        sourceType: "registration",
        sourceId: eventId,
      });
    }
    await this.#achievements.evaluate(userId);

    return record;
  }

  async cancel(registrationId: string): Promise<void> {
    ready();
    const all = readList<Registration>("registrations");
    const i = all.findIndex((r) => r.id === registrationId);
    if (i === -1) throw new DataError("NOT_FOUND", "Registration not found.");

    all[i] = { ...all[i], status: "cancelled", cancelledAt: nowIso() };
    write("registrations", all);

    // XP is deliberately NOT clawed back: the ledger is an audit trail, and
    // reversing entries would let a register/cancel loop farm achievements.
    // Promote the earliest waitlisted entry into the freed seat.
    const freed = all[i];
    const waitlisted = all
      .filter((r) => r.eventId === freed.eventId && r.status === "waitlisted")
      .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))[0];

    if (waitlisted) {
      const j = all.indexOf(waitlisted);
      all[j] = { ...waitlisted, status: "confirmed" };
      write("registrations", all);
      await this.#xp.award({
        userId: waitlisted.userId,
        amount: 10,
        reason: "Promoted from waitlist",
        sourceType: "registration",
        sourceId: waitlisted.eventId,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

class LocalTeams implements TeamRepository {
  #achievements: LocalAchievements;
  #events: LocalEvents;

  constructor(achievements: LocalAchievements, events: LocalEvents) {
    this.#achievements = achievements;
    this.#events = events;
  }

  async listForUser(userId: string): Promise<Team[]> {
    ready();
    const mine = new Set(
      readList<TeamMember>("teamMembers")
        .filter((m) => m.userId === userId)
        .map((m) => m.teamId),
    );
    return readList<Team>("teams").filter((t) => mine.has(t.id));
  }

  async getById(teamId: string): Promise<Team | null> {
    ready();
    return readList<Team>("teams").find((t) => t.id === teamId) ?? null;
  }

  async getByJoinCode(code: string): Promise<Team | null> {
    ready();
    const needle = code.trim().toUpperCase();
    return readList<Team>("teams").find((t) => t.joinCode === needle) ?? null;
  }

  async members(teamId: string): Promise<TeamMember[]> {
    ready();
    return readList<TeamMember>("teamMembers").filter((m) => m.teamId === teamId);
  }

  async create(eventId: string, leaderId: string, name: string): Promise<Team> {
    ready();
    const event = await this.#events.getById(eventId);
    if (!event) throw new DataError("NOT_FOUND", "Event not found.");

    const trimmed = name.trim();
    if (trimmed.length < 3 || trimmed.length > 32) {
      throw new DataError("VALIDATION_FAILED", "Team name must be 3–32 characters.");
    }

    const teams = readList<Team>("teams");
    if (teams.some((t) => t.eventId === eventId && t.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new DataError("VALIDATION_FAILED", "A team with that name already exists for this event.");
    }

    const team: Team = {
      id: uid("tm"),
      eventId,
      name: trimmed,
      joinCode: crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase(),
      leaderId,
      isLocked: false,
      createdAt: nowIso(),
    };
    teams.push(team);
    write("teams", teams);

    const members = readList<TeamMember>("teamMembers");
    members.push({ teamId: team.id, userId: leaderId, role: "leader", joinedAt: nowIso() });
    write("teamMembers", members);

    await this.#achievements.evaluate(leaderId);
    return team;
  }

  async join(code: string, userId: string): Promise<Team> {
    ready();
    const team = await this.getByJoinCode(code);
    if (!team) throw new DataError("INVALID_JOIN_CODE", "No team found with that code.");
    if (team.isLocked) throw new DataError("TEAM_FULL", "That team is locked.");

    const event = await this.#events.getById(team.eventId);
    const members = readList<TeamMember>("teamMembers");
    const current = members.filter((m) => m.teamId === team.id);

    if (current.some((m) => m.userId === userId)) return team; // already a member
    if (event && current.length >= event.maxTeamSize) {
      throw new DataError("TEAM_FULL", `That team already has ${event.maxTeamSize} members.`);
    }

    members.push({ teamId: team.id, userId, role: "member", joinedAt: nowIso() });
    write("teamMembers", members);

    await this.#achievements.evaluate(userId);
    return team;
  }

  async leave(teamId: string, userId: string): Promise<void> {
    ready();
    const members = readList<TeamMember>("teamMembers");
    const remaining = members.filter((m) => !(m.teamId === teamId && m.userId === userId));
    write("teamMembers", remaining);

    // If the leader left, promote the longest-standing member rather than
    // leaving an orphaned team nobody can administer.
    const team = await this.getById(teamId);
    if (team && team.leaderId === userId) {
      const rest = remaining
        .filter((m) => m.teamId === teamId)
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));

      const teams = readList<Team>("teams");
      const i = teams.findIndex((t) => t.id === teamId);
      if (rest.length === 0) {
        // Empty team — remove it entirely.
        write("teams", teams.filter((t) => t.id !== teamId));
      } else if (i >= 0) {
        teams[i] = { ...teams[i], leaderId: rest[0].userId };
        write("teams", teams);
        const idx = remaining.findIndex(
          (m) => m.teamId === teamId && m.userId === rest[0].userId,
        );
        if (idx >= 0) {
          remaining[idx] = { ...remaining[idx], role: "leader" };
          write("teamMembers", remaining);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

class LocalAttendance implements AttendanceRepository {
  #xp: LocalXp;
  #achievements: LocalAchievements;
  #events: LocalEvents;

  constructor(xp: LocalXp, achievements: LocalAchievements, events: LocalEvents) {
    this.#xp = xp;
    this.#achievements = achievements;
    this.#events = events;
  }

  async listForUser(userId: string): Promise<Attendance[]> {
    ready();
    return readList<Attendance>("attendance").filter((a) => a.userId === userId);
  }

  async listForEvent(eventId: string): Promise<Attendance[]> {
    ready();
    return readList<Attendance>("attendance").filter((a) => a.eventId === eventId);
  }

  async checkIn(input: {
    eventId: string;
    userId: string;
    method?: "qr" | "manual" | "self";
    scannedBy?: string | null;
  }): Promise<Attendance> {
    ready();
    const event = await this.#events.getById(input.eventId);
    if (!event) throw new DataError("NOT_FOUND", "Event not found.");

    const all = readList<Attendance>("attendance");

    // Unique (eventId, userId): a second check-in returns the FIRST record
    // rather than creating a duplicate or throwing, so a double scan is
    // harmless and the UI can show the original time.
    const existing = all.find(
      (a) => a.eventId === input.eventId && a.userId === input.userId,
    );
    if (existing) return existing;

    const registration = readList<Registration>("registrations").find(
      (r) => r.eventId === input.eventId && r.userId === input.userId,
    );

    const record: Attendance = {
      id: uid("att"),
      eventId: input.eventId,
      userId: input.userId,
      registrationId: registration?.id ?? null,
      method: input.method ?? "qr",
      checkedInAt: nowIso(),
      scannedBy: input.scannedBy ?? null,
    };
    all.push(record);
    write("attendance", all);

    await this.#xp.award({
      userId: input.userId,
      amount: event.xpReward,
      reason: `Attended ${event.title}`,
      sourceType: "attendance",
      sourceId: input.eventId,
    });
    await this.#achievements.evaluate(input.userId);

    return record;
  }
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

class LocalLeaderboard implements LeaderboardRepository {
  async top(limit = 50): Promise<LeaderboardRow[]> {
    ready();
    return buildLeaderboard().slice(0, limit);
  }

  async rankOf(userId: string): Promise<number | null> {
    ready();
    const row = buildLeaderboard().find((r) => r.userId === userId);
    return row?.rank ?? null;
  }
}

/**
 * Ranking is by XP desc, then createdAt asc as a deterministic tiebreak — so
 * ranks do not shuffle between reloads when players are level-pegged.
 */
function buildLeaderboard(): LeaderboardRow[] {
  const colleges = readList<College>("colleges");
  const banned = new Set(
    readList<Profile>("profiles").filter((p) => p.isBanned).map((p) => p.id),
  );

  return readList<Character>("characters")
    .filter((c) => !banned.has(c.userId))
    .sort((a, b) => b.totalXp - a.totalXp || a.createdAt.localeCompare(b.createdAt))
    .map((c, i) => ({
      rank: i + 1,
      characterId: c.id,
      userId: c.userId,
      playerName: c.playerName,
      skinId: c.skinId,
      level: c.level,
      totalXp: c.totalXp,
      title: c.title,
      college: colleges.find((col) => col.id === c.collegeId)?.shortName ?? null,
    }));
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

class LocalAnnouncements implements AnnouncementRepository {
  async list(): Promise<Announcement[]> {
    ready();
    const now = Date.now();
    return readList<Announcement>("announcements")
      .filter((a) => !a.expiresAt || new Date(a.expiresAt).getTime() > now)
      .sort(
        (a, b) =>
          Number(b.isPinned) - Number(a.isPinned) ||
          b.publishedAt.localeCompare(a.publishedAt),
      );
  }

  async create(input: Omit<Announcement, "id" | "publishedAt">): Promise<Announcement> {
    ready();
    const all = readList<Announcement>("announcements");
    const record: Announcement = { ...input, id: uid("ann"), publishedAt: nowIso() };
    all.push(record);
    write("announcements", all);
    return record;
  }

  /**
   * Same signature as a Supabase Realtime subscription. Backed by the store's
   * change notifier, which covers this tab and others, so an announcement
   * created in one tab toasts in the rest — the same observable behaviour
   * Realtime will provide.
   */
  subscribe(cb: (a: Announcement) => void): Unsubscribe {
    let known = new Set(readList<Announcement>("announcements").map((a) => a.id));

    return subscribe((collection) => {
      if (collection !== "announcements") return;
      const current = readList<Announcement>("announcements");
      for (const a of current) {
        if (!known.has(a.id)) cb(a);
      }
      known = new Set(current.map((a) => a.id));
    });
  }
}

// ---------------------------------------------------------------------------
// Reference
// ---------------------------------------------------------------------------

class LocalReference implements ReferenceRepository {
  async colleges(): Promise<College[]> {
    ready();
    return readList<College>("colleges")
      .filter((c) => c.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async departments(collegeId?: string | null): Promise<Department[]> {
    ready();
    return readList<Department>("departments")
      .filter((d) => d.collegeId === null || d.collegeId === collegeId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async categories(): Promise<EventCategory[]> {
    ready();
    return readList<EventCategory>("categories").sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async levels(): Promise<Level[]> {
    ready();
    return readList<Level>("levels").sort((a, b) => a.level - b.level);
  }

  async sponsors(): Promise<Sponsor[]> {
    ready();
    return readList<Sponsor>("sponsors")
      .filter((s) => s.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
}

// ---------------------------------------------------------------------------
// Payment Receipts
// ---------------------------------------------------------------------------

class LocalPaymentReceipts implements PaymentReceiptRepository {
  #xp: LocalXp;
  #achievements: LocalAchievements;

  constructor(xp: LocalXp, achievements: LocalAchievements) {
    this.#xp = xp;
    this.#achievements = achievements;
  }

  async submit(input: {
    registrationId: string;
    eventId: string;
    userId: string;
    fileData: string;
    fileName: string;
    fileSizeBytes: number;
  }): Promise<PaymentReceipt> {
    ready();
    const all = readList<PaymentReceipt>("paymentReceipts");
    if (all.some((r) => r.registrationId === input.registrationId)) {
      throw new DataError("RECEIPT_ALREADY_SUBMITTED", "A receipt has already been submitted for this registration.");
    }
    const receipt: PaymentReceipt = {
      id: uid("rcpt"),
      registrationId: input.registrationId,
      eventId: input.eventId,
      userId: input.userId,
      fileData: input.fileData,
      fileName: input.fileName,
      fileSizeBytes: input.fileSizeBytes,
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
      submittedAt: nowIso(),
    };
    all.push(receipt);
    write("paymentReceipts", all);
    return receipt;
  }

  async getByRegistration(registrationId: string): Promise<PaymentReceipt | null> {
    ready();
    return readList<PaymentReceipt>("paymentReceipts").find((r) => r.registrationId === registrationId) ?? null;
  }

  async listForEvent(eventId: string): Promise<PaymentReceipt[]> {
    ready();
    return readList<PaymentReceipt>("paymentReceipts").filter((r) => r.eventId === eventId);
  }

  async listPending(): Promise<PaymentReceipt[]> {
    ready();
    return readList<PaymentReceipt>("paymentReceipts").filter((r) => r.status === "pending");
  }

  async review(receiptId: string, decision: "verified" | "rejected", reviewedBy: string, note?: string): Promise<PaymentReceipt> {
    ready();
    const receipts = readList<PaymentReceipt>("paymentReceipts");
    const idx = receipts.findIndex((r) => r.id === receiptId);
    if (idx === -1) throw new DataError("NOT_FOUND", "Receipt not found.");
    
    const receipt = receipts[idx];
    if (receipt.status !== "pending") {
      throw new DataError("VALIDATION_FAILED", "Receipt is not pending.");
    }

    receipt.status = decision;
    receipt.reviewedBy = reviewedBy;
    receipt.reviewedAt = nowIso();
    receipt.reviewNote = note ?? null;
    write("paymentReceipts", receipts);

    const regs = readList<Registration>("registrations");
    const regIdx = regs.findIndex((r) => r.id === receipt.registrationId);
    if (regIdx !== -1) {
      regs[regIdx] = { ...regs[regIdx], status: decision === "verified" ? "confirmed" : "rejected" };
      write("registrations", regs);
      
      if (decision === "verified") {
        const events = readList<FestEvent>("events");
        const ev = events.find((e) => e.id === receipt.eventId);
        await this.#xp.award({
          userId: receipt.userId,
          amount: 10,
          reason: `Registered for ${ev?.title ?? "event"}`,
          sourceType: "registration",
          sourceId: receipt.eventId,
        });
        await this.#achievements.evaluate(receipt.userId);
      }
    }

    // Simulate email notification
    const profiles = readList<Profile>("profiles");
    const userProfile = profiles.find((p) => p.id === receipt.userId);
    const events = readList<FestEvent>("events");
    const ev = events.find((e) => e.id === receipt.eventId);
    const userEmail = userProfile?.email ?? `${receipt.userId}@festrealm.test`;
    const eventName = ev?.title ?? "Gateways Event";

    console.info(
      `\n[MOCK MAIL SERVER] Email Sent:\n` +
      `  To: ${userEmail}\n` +
      `  Subject: Gateways Registration Payment ${decision === "verified" ? "Verified" : "Rejected"} (${eventName})\n` +
      `  Body: Hello ${userProfile?.fullName ?? "Player"},\n` +
      `        Your payment receipt for ${eventName} has been ${decision}.\n` +
      (note ? `        Note from registration team: ${note}\n` : "") +
      `        ${decision === "verified" ? "You are now confirmed for the event! +10 XP awarded." : "Please check your dashboard or contact committeeheads@gateways.in if you face any issues."}\n`
    );
    
    return receipt;
  }
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export function createLocalRepository(): Repository {
  const xp = new LocalXp();
  const achievements = new LocalAchievements(xp);
  const events = new LocalEvents();

  return {
    auth: new LocalAuth(),
    profiles: new LocalProfiles(),
    characters: new LocalCharacters(),
    events,
    registrations: new LocalRegistrations(xp, achievements, events),
    teams: new LocalTeams(achievements, events),
    attendance: new LocalAttendance(xp, achievements, events),
    achievements,
    xp,
    leaderboard: new LocalLeaderboard(),
    announcements: new LocalAnnouncements(),
    reference: new LocalReference(),
    paymentReceipts: new LocalPaymentReceipts(xp, achievements),
  };
}
