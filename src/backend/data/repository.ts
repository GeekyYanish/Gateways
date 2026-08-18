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
  PaymentReceipt,
} from "./types";

/**
 * THE SWAP SEAM.
 *
 * Screens and hooks depend on this interface, never on localStorage or on the
 * database directly. Today `LocalRepository` implements it; later
 * `MySqlRepository` will, and `src/backend/data/index.ts` changes by one line.
 *
 * Every method is async even though localStorage is synchronous. That is
 * deliberate: if callers were written against synchronous returns, swapping in a
 * network-backed implementation would mean touching every call site.
 *
 * Methods throw `DataError` with a stable code on failure, matching the error
 * codes the eventual server action will return.
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
  paymentReceipts: PaymentReceiptRepository;
}

export type Unsubscribe = () => void;

export interface AuthRepository {
  /**
   * Creates the account. Returns a `Session` only when the backend signs the
   * user straight in; the real backend does NOT — it emails a six-digit OTP and
   * returns `null`, and the session appears after `verifyEmail()`. Callers must
   * handle the null case by showing the code entry step.
   */
  signUp(email: string, password: string, username: string): Promise<Session | null>;
  resendVerification(email: string): Promise<void>;
  /**
   * Exchanges the emailed OTP for a session. Only meaningful after a `signUp()`
   * that returned `null`.
   */
  verifyEmail(email: string, otp: string): Promise<Session>;
  signIn(email: string, password: string): Promise<Session>;
  /**
   * OAuth. The local implementation shows a mock account chooser; the Auth.js
   * one will redirect. Same signature either way.
   */
  signInWithProvider(provider: "google", returnTo?: string): Promise<Session>;
  signOut(): Promise<void>;
  getSession(): Promise<Session | null>;
  /** Fires on sign-in/out AND on cross-tab changes. Returns an unsubscribe fn. */
  onAuthStateChange(cb: (session: Session | null) => void): Unsubscribe;
  /** Prototype-only helper for exercising organizer/admin views. */
  grantRole(userId: string, role: Role): Promise<void>;
  requestPasswordReset?(email: string): Promise<void>;
  resetPassword?(token: string, newPassword: string): Promise<void>;
  changePassword?(currentPassword: string, newPassword: string): Promise<Session>;
  createConsoleHandoff?(returnTo?: string): Promise<{ url: string; expiresAt: string }>;
  /**
   * The reverse: a staff member already signed into the registration console
   * hands their session back to the website. Consumed by the
   * `/auth/console-return` page after the console redirects here with a code.
   */
  exchangeWebsiteHandoff?(code: string): Promise<{ returnTo: string }>;
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
   * Signature is transport-agnostic, so the consumer does not change when the
   * backend does. Locally backed by the `storage` event plus an in-page emitter;
   * under MySQL it becomes a poll, since there is no LISTEN/NOTIFY equivalent.
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

export interface PaymentReceiptRepository {
  /** Submit the one-time fest-wide participant pass receipt. One per user. */
  getConfig(): Promise<{ amountInr: number }>;
  submit(input: {
    registrationId: string;
    eventId: string;
    userId: string;
    fileData: string;
    fileName: string;
    fileSizeBytes: number;
    paymentMethod?: "upi" | "neft" | "gateway";
    transactionReference?: string;
    /**
     * The rate the participant says they paid, from the tiers open on the day
     * (`openRegistrationTiers`). A claim for the verifier to check against the
     * receipt — never treat it as a confirmed amount.
     */
    amountInr?: number;
  }): Promise<PaymentReceipt>;
  /** Get the receipt for a specific registration, if any. */
  getByRegistration(registrationId: string): Promise<PaymentReceipt | null>;
  /** Get the most recent one-time entry fee receipt for a user, if any. */
  getByUser(userId: string): Promise<PaymentReceipt | null>;
  /** All receipts for an event (admin view). */
  listForEvent(eventId: string): Promise<PaymentReceipt[]>;
  /** All pending receipts across all events (admin dashboard). */
  listPending(): Promise<PaymentReceipt[]>;
  /** Admin approves or rejects a receipt. */
  review(receiptId: string, decision: "verified" | "rejected", reviewedBy: string, note?: string): Promise<PaymentReceipt>;
}
