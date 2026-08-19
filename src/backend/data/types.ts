/**
 * Domain types.
 *
 * Field names deliberately mirror the eventual MySQL column names (snake_case
 * is avoided in favour of camelCase at the TS boundary, but the SHAPE and the
 * semantics match MYSQL-MIGRATION.md one-to-one). That is what makes swapping
 * the localStorage repository for a MySQL one mechanical rather than a
 * rewrite: the mapping is a rename, never a restructure.
 *
 * Timestamps are ISO-8601 strings, not Date objects — they round-trip through
 * JSON.stringify losslessly, which a Date does not.
 */

export type Role = "player" | "organizer" | "scanner" | "admin";

export interface RoleAssignment {
  role: Role;
  eventScopeId: string | null;
}

export type EventStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "registration_closed"
  | "ongoing"
  | "completed"
  | "cancelled";

export type EventMode = "solo" | "team" | "either";

export type RegistrationStatus =
  | "pending"
  | "confirmed"
  | "waitlisted"
  | "cancelled"
  | "rejected";

export type AttendanceMethod = "qr" | "manual" | "self";
export type TeamMemberRole = "leader" | "member";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type AnnouncementScope = "global" | "event" | "college";
export type AnnouncementSeverity = "info" | "success" | "warning" | "critical";
export type CertificateKind =
  | "participation"
  | "winner"
  | "runner_up"
  | "special"
  | "volunteer";

/**
 * Original voxel-character archetypes.
 *
 * Deliberately NOT Minecraft's character names or designs — those are Mojang's
 * copyrighted assets. These are generic adventurer archetypes that fit a
 * voxel/blocky art direction without borrowing anyone's IP, and the art brief in
 * ART-ASSETS.md describes them independently.
 */
export type SkinId = "prospector" | "botanist" | "sentinel" | "voidwalker" | "artificer";

/** Achievement unlock conditions, evaluated after XP-earning actions. */
export type AchievementTrigger =
  | "manual"
  | "first_registration"
  | "event_attended"
  | "events_attended_count"
  | "team_created"
  | "profile_completed"
  | "xp_threshold";

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/* The four participant enumerations below are copied VERBATIM from the
   registration console's `src/lib/data/types.ts`. They are a wire contract, not
   our taxonomy — `POST /v1/registrations` rejects anything outside these sets,
   and the console's filters and CSV exports key off the exact strings. Widen or
   rename them only in lockstep with that repo. */

export type Gender = "male" | "female" | "other";

/** Sets the base fee on the console's side (participant ₹350 … guest ₹0). */
export type ParticipantCategory =
  | "participant"
  | "delegate"
  | "accompanist"
  | "faculty"
  | "volunteer"
  | "guest";

export type TshirtSize = "XS" | "S" | "M" | "L" | "XL" | "XXL";

export type DietaryPref = "veg" | "non_veg" | "vegan" | "jain";

/**
 * One row per person, matching the console's `Participant`.
 *
 * The seven fields below `phone` are the gap BACKEND-API-CONTRACT.md §1 named:
 * the console cannot render a usable record without them, and
 * `POST /v1/registrations` cannot be satisfied.
 *
 * All nullable, and that is not laziness — every profile created before this
 * existed has none of them, and `local-auth.ts` still creates a profile with
 * nothing but an email at sign-up. Completeness is asserted at registration
 * time by `isParticipantComplete()`, not by the type.
 *
 * College, department and year deliberately do NOT live here. They are already
 * on `Character`, and duplicating them would create two answers to the same
 * question with no rule for which wins.
 */
export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  collegeId?: string | null;
  departmentId?: string | null;
  yearOfStudy?: number | null;
  gender: Gender | null;
  /** "YYYY-MM-DD". A plain date, not a timestamp — nobody has a birth instant. */
  dateOfBirth: string | null;
  category: ParticipantCategory | null;
  tshirtSize: TshirtSize | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  dietaryPref: DietaryPref | null;
  isBanned: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * What the registration form submits. Every field is required here — the
 * optionality on `Profile` is about history, this is about intent.
 *
 * `email` is absent because it comes from the session, and it is the key the
 * backend matches participants on; letting the form set it would let one
 * account write another person's record.
 */
export interface ParticipantDetails {
  fullName: string;
  phone: string;
  collegeId: string;
  departmentId: string;
  yearOfStudy: number;
  gender: Gender;
  dateOfBirth: string;
  category: ParticipantCategory;
  tshirtSize: TshirtSize;
  emergencyName: string;
  emergencyPhone: string;
  dietaryPref: DietaryPref;
}

/**
 * Whether this user can be sent to the console as a Participant.
 *
 * Lives here rather than in a component because three callers need the same
 * answer — the register button (to decide whether to open the form), the
 * repository (to refuse an incomplete registration), and the form itself (to
 * pre-fill). Three copies of this predicate would drift.
 *
 * Checks `Character` too: college and year are part of the contract's
 * `participant` object even though they are stored on the character.
 */
export function isParticipantComplete(
  profile: Profile | null,
  character: Character | null,
): boolean {
  if (!profile || !character) return false;
  return Boolean(
    profile.fullName?.trim() &&
      profile.phone?.trim() &&
      profile.gender &&
      profile.dateOfBirth &&
      profile.category &&
      profile.tshirtSize &&
      profile.emergencyName?.trim() &&
      profile.emergencyPhone?.trim() &&
      profile.dietaryPref &&
      character.collegeId &&
      character.departmentId &&
      character.yearOfStudy != null,
  );
}

export interface Character {
  id: string;
  userId: string;
  /** Unique case-insensitively — "Ridge" and "ridge" collide, blocking impersonation. */
  playerName: string;
  collegeId: string | null;
  departmentId: string | null;
  yearOfStudy: number | null;
  skinId: SkinId;
  bio: string | null;
  /** Denormalised cache of the XP ledger sum. */
  totalXp: number;
  level: number;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewCharacter {
  playerName: string;
  collegeId: string | null;
  departmentId: string | null;
  yearOfStudy: number | null;
  skinId: SkinId;
  bio?: string | null;
}

export interface Session {
  userId: string;
  email: string;
  roles: Role[];
  assignments?: RoleAssignment[];
  mustChangePassword?: boolean;
  /** ISO timestamp; the local implementation expires sessions like a real one. */
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export interface College {
  id: string;
  name: string;
  shortName: string;
  city: string | null;
  isActive: boolean;
}

export interface Department {
  id: string;
  /** null = generic department available to every college. */
  collegeId: string | null;
  name: string;
  shortName: string | null;
}

export interface EventCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** Links to a WORLD_LOCATIONS key so the map can filter events. */
  worldLocationKey: string | null;
  blockColor: string;
  sortOrder: number;
}

export interface Level {
  level: number;
  minXp: number;
  title: string;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface FestEvent {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  rules: string | null;
  categoryId: string;
  status: EventStatus;
  mode: EventMode;
  minTeamSize: number;
  maxTeamSize: number;
  /** null = unlimited. */
  capacity: number | null;
  venue: string | null;
  startsAt: string;
  endsAt: string;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  xpReward: number;
  entryFeeInr: number;
  requiresApproval: boolean;
  contactEmail: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventFilter {
  categorySlug?: string;
  status?: EventStatus[];
  mode?: EventMode;
  search?: string;
  /** Only events the given user has registered for. */
  registeredBy?: string;
}

/** Denormalised counts, mirroring the `event_stats` view. */
export interface EventStats {
  eventId: string;
  confirmedCount: number;
  waitlistCount: number;
  checkedInCount: number;
  capacity: number | null;
  seatsLeft: number | null;
}

// ---------------------------------------------------------------------------
// Registrations, teams, attendance
// ---------------------------------------------------------------------------

export interface Registration {
  id: string;
  eventId: string;
  userId: string;
  teamId: string | null;
  status: RegistrationStatus;
  registeredAt: string;
  cancelledAt: string | null;
  code?: string | null;
  paymentStatus?: string | null;
  source?: string | null;
  notes?: string | null;
  overrideReason?: string | null;
  confirmedAt?: string | null;
  waitlistPosition?: number | null;
}

export interface Team {
  id: string;
  eventId: string;
  name: string;
  joinCode: string;
  leaderId: string;
  isLocked: boolean;
  createdAt: string;
}

export interface TeamMember {
  teamId: string;
  userId: string;
  role: TeamMemberRole;
  joinedAt: string;
  /**
   * From the joined profile. Optional because the join is a LEFT one — a member
   * without a profile row still belongs on the roster, just without a name.
   */
  fullName?: string | null;
}

export interface Attendance {
  id: string;
  eventId: string;
  userId: string;
  registrationId: string | null;
  method: AttendanceMethod;
  checkedInAt: string;
  scannedBy: string | null;
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  flavorText: string | null;
  rarity: Rarity;
  xpReward: number;
  triggerType: AchievementTrigger;
  /** e.g. { count: 5 } for events_attended_count, { xp: 1000 } for xp_threshold. */
  triggerConfig: Record<string, number | string>;
  isSecret: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface UserAchievement {
  userId: string;
  achievementId: string;
  unlockedAt: string;
  /** null => the unlock cinematic has not been shown yet. */
  seenAt: string | null;
}

export interface XpEntry {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  /** 'registration' | 'attendance' | 'achievement' | 'admin' */
  sourceType: string;
  sourceId: string;
  createdAt: string;
}

export interface LeaderboardRow {
  rank: number;
  characterId: string;
  userId: string;
  playerName: string;
  skinId: SkinId;
  level: number;
  totalXp: number;
  title: string | null;
  college: string | null;
}

// ---------------------------------------------------------------------------
// Communication
// ---------------------------------------------------------------------------

export interface Announcement {
  id: string;
  scope: AnnouncementScope;
  eventId: string | null;
  collegeId: string | null;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  isPinned: boolean;
  publishedAt: string;
  expiresAt: string | null;
  createdBy: string | null;
}

export interface ScheduleSlot {
  id: string;
  eventId: string | null;
  title: string;
  dayLabel: string;
  startsAt: string;
  endsAt: string;
  venue: string | null;
  track: string | null;
  isBreak: boolean;
}

export interface Sponsor {
  id: string;
  name: string;
  tier: "diamond" | "gold" | "iron" | "stone";
  websiteUrl: string | null;
  blurb: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface Certificate {
  id: string;
  userId: string;
  eventId: string | null;
  kind: CertificateKind;
  serial: string;
  issuedAt: string;
  revokedAt: string | null;
}

// ---------------------------------------------------------------------------
// Communication
// ---------------------------------------------------------------------------

export type PaymentVerificationStatus = "pending" | "verified" | "rejected";

export interface PaymentReceipt {
  id: string;
  registrationId: string;
  eventId: string;
  userId: string;
  /** Base64-encoded PDF content (localStorage has no file system). */
  fileData: string;
  fileName: string;
  fileSizeBytes: number;
  status: PaymentVerificationStatus;
  /** Admin who verified/rejected, null while pending. */
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  submittedAt: string;
  amountInr?: number;
  paymentMethod?: "upi" | "neft" | "gateway" | null;
  transactionReference?: string | null;
  fileUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Error codes the UI switches on. Strings rather than an enum so they survive
 * JSON round-trips and match what the eventual server action will return.
 */
export type DataErrorCode =
  | "NOT_AUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "EMAIL_TAKEN"
  | "PLAYER_NAME_TAKEN"
  | "NOT_FOUND"
  | "ALREADY_REGISTERED"
  | "EVENT_FULL"
  | "REGISTRATION_CLOSED"
  | "TEAM_FULL"
  | "TEAM_LOCKED"
  | "INVALID_JOIN_CODE"
  | "STORAGE_UNAVAILABLE"
  | "VALIDATION_FAILED"
  | "RECEIPT_ALREADY_SUBMITTED"
  | "PAYMENT_NOT_VERIFIED"
  | "FORBIDDEN"
  | "MUST_CHANGE_PASSWORD"
  // Correct password, unverified address. The backend has already reissued a
  // code; the UI shows the OTP step rather than an error.
  | "EMAIL_NOT_VERIFIED"
  // Address belongs to a Google identity — there is no password to use.
  | "OAUTH_ACCOUNT";

export class DataError extends Error {
  readonly code: DataErrorCode;

  constructor(code: DataErrorCode, message?: string) {
    super(message ?? code);
    this.name = "DataError";
    this.code = code;
  }
}
