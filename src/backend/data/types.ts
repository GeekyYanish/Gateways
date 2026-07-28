/**
 * Domain types.
 *
 * Field names deliberately mirror the eventual Postgres column names (snake_case
 * is avoided in favour of camelCase at the TS boundary, but the SHAPE and the
 * semantics match SUPABASE-MIGRATION.md one-to-one). That is what makes swapping
 * the localStorage repository for a Supabase one mechanical rather than a
 * rewrite: the mapping is a rename, never a restructure.
 *
 * Timestamps are ISO-8601 strings, not Date objects — they round-trip through
 * JSON.stringify losslessly, which a Date does not.
 */

export type Role = "player" | "organizer" | "admin";

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

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  isBanned: boolean;
  createdAt: string;
  updatedAt: string;
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
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Error codes the UI switches on. Strings rather than an enum so they survive
 * JSON round-trips and match what a Postgres RPC would return.
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
  | "INVALID_JOIN_CODE"
  | "STORAGE_UNAVAILABLE"
  | "VALIDATION_FAILED"
  | "RECEIPT_ALREADY_SUBMITTED"
  | "PAYMENT_NOT_VERIFIED";

export class DataError extends Error {
  readonly code: DataErrorCode;

  constructor(code: DataErrorCode, message?: string) {
    super(message ?? code);
    this.name = "DataError";
    this.code = code;
  }
}
