import type {
  Achievement,
  Announcement,
  Attendance,
  Character,
  College,
  Department,
  EventCategory,
  EventFilter,
  EventStats,
  FestEvent,
  LeaderboardRow,
  Level,
  NewCharacter,
  Profile,
  Registration,
  Role,
  ScheduleSlot,
  Session,
  Sponsor,
  Team,
  TeamMember,
  UserAchievement,
  XpEntry,
} from "./types";

/**
 * THE SWAP SEAM.
 *
 * Screens and hooks depend on this interface, never on localStorage or on
 * Supabase directly. Today `LocalRepository` implements it; later
 * `SupabaseRepository` will, and `src/lib/data/index.ts` changes by one line.
 *
 * Every method is async even though localStorage is synchronous. That is
 * deliberate: if callers were written against synchronous returns, swapping in a
 * network-backed implementation would mean touching every call site.
 *
 * Methods throw `DataError` with a stable code on failure, matching the error
 * codes a Postgres RPC would return.
 */
export interface Repository {
  auth: AuthRepository;
  profiles: ProfileRepository;
  characters: CharacterRepository;
  events: EventRepository;
  registrations: RegistrationRepository;
  teams: TeamRepository;
  attendance: AttendanceRepository;
  achievements: AchievementRepository;
  xp: XpRepository;
  leaderboard: LeaderboardRepository;
  announcements: AnnouncementRepository;
  reference: ReferenceRepository;
}

export type Unsubscribe = () => void;

export interface AuthRepository {
  signUp(email: string, password: string): Promise<Session>;
  signIn(email: string, password: string): Promise<Session>;
  /**
   * OAuth. The local implementation shows a mock account chooser; the Supabase
   * one will redirect. Same signature either way.
   */
  signInWithProvider(provider: "google" | "discord" | "microsoft"): Promise<Session>;
  signOut(): Promise<void>;
  getSession(): Promise<Session | null>;
  /** Fires on sign-in/out AND on cross-tab changes. Returns an unsubscribe fn. */
  onAuthStateChange(cb: (session: Session | null) => void): Unsubscribe;
  /** Prototype-only helper for exercising organizer/admin views. */
  grantRole(userId: string, role: Role): Promise<void>;
}

export interface ProfileRepository {
  get(userId: string): Promise<Profile | null>;
  update(userId: string, patch: Partial<Profile>): Promise<Profile>;
}

export interface CharacterRepository {
  getByUser(userId: string): Promise<Character | null>;
  getByPlayerName(playerName: string): Promise<Character | null>;
  create(userId: string, input: NewCharacter): Promise<Character>;
  update(userId: string, patch: Partial<NewCharacter>): Promise<Character>;
  /** Case-insensitive, excluding the caller's own name. */
  isPlayerNameTaken(playerName: string, excludeUserId?: string): Promise<boolean>;
}

export interface EventRepository {
  list(filter?: EventFilter): Promise<FestEvent[]>;
  getBySlug(slug: string): Promise<FestEvent | null>;
  getById(id: string): Promise<FestEvent | null>;
  stats(eventId: string): Promise<EventStats>;
  schedule(): Promise<ScheduleSlot[]>;
}

export interface RegistrationRepository {
  listForUser(userId: string): Promise<Registration[]>;
  listForEvent(eventId: string): Promise<Registration[]>;
  get(eventId: string, userId: string): Promise<Registration | null>;
  /**
   * Enforces: unique (eventId, userId), capacity, and the registration window.
   * Awards XP and evaluates achievements as part of the same call.
   */
  register(eventId: string, userId: string, teamId?: string): Promise<Registration>;
  cancel(registrationId: string): Promise<void>;
}

export interface TeamRepository {
  listForUser(userId: string): Promise<Team[]>;
  getById(teamId: string): Promise<Team | null>;
  getByJoinCode(code: string): Promise<Team | null>;
  members(teamId: string): Promise<TeamMember[]>;
  create(eventId: string, leaderId: string, name: string): Promise<Team>;
  join(code: string, userId: string): Promise<Team>;
  leave(teamId: string, userId: string): Promise<void>;
}

export interface AttendanceRepository {
  listForUser(userId: string): Promise<Attendance[]>;
  listForEvent(eventId: string): Promise<Attendance[]>;
  /** Idempotent: a second check-in for the same (eventId, userId) is a no-op. */
  checkIn(input: {
    eventId: string;
    userId: string;
    method?: "qr" | "manual" | "self";
    scannedBy?: string | null;
  }): Promise<Attendance>;
}

export interface AchievementRepository {
  listAll(): Promise<Achievement[]>;
  listForUser(userId: string): Promise<UserAchievement[]>;
  /** Returns null when already unlocked, so callers can detect "new". */
  unlock(userId: string, code: string): Promise<UserAchievement | null>;
  /** Unlocked but not yet shown — drives the SCREEN 8 modal queue. */
  listUnseen(userId: string): Promise<UserAchievement[]>;
  markSeen(userId: string, achievementId: string): Promise<void>;
  /** Re-evaluates trigger conditions; called after XP-earning actions. */
  evaluate(userId: string): Promise<UserAchievement[]>;
}

export interface XpRepository {
  /**
   * Idempotent on (userId, sourceType, sourceId, reason) — re-running a grant
   * cannot double-pay. Recomputes level from the ledger.
   */
  award(input: {
    userId: string;
    amount: number;
    reason: string;
    sourceType: string;
    sourceId: string;
  }): Promise<void>;
  ledger(userId: string): Promise<XpEntry[]>;
}

export interface LeaderboardRepository {
  top(limit?: number): Promise<LeaderboardRow[]>;
  rankOf(userId: string): Promise<number | null>;
}

export interface AnnouncementRepository {
  list(): Promise<Announcement[]>;
  create(input: Omit<Announcement, "id" | "publishedAt">): Promise<Announcement>;
  /**
   * Same signature as a Supabase Realtime subscription, so the consumer does not
   * change when the backend does. Locally backed by the `storage` event plus an
   * in-page emitter.
   */
  subscribe(cb: (a: Announcement) => void): Unsubscribe;
}

export interface ReferenceRepository {
  colleges(): Promise<College[]>;
  departments(collegeId?: string | null): Promise<Department[]>;
  categories(): Promise<EventCategory[]>;
  levels(): Promise<Level[]>;
  sponsors(): Promise<Sponsor[]>;
}
