/* eslint-disable @typescript-eslint/no-explicit-any -- backend JSON is validated at the API boundary. */
import { apiFetch, ApiError } from "@/frontend/lib/api-client";
import type {
  CharacterRepository,
  EventRepository,
  ProfileRepository,
  ReferenceRepository,
  RegistrationRepository,
  TeamRepository,
} from "../repository";
import { DataError, type Character, type College, type Department, type EventCategory, type EventFilter, type EventStats, type FestEvent, type Level, type NewCharacter, type Profile, type Registration, type ScheduleSlot, type Sponsor, type Team, type TeamMember } from "../types";

function fail(error: unknown): never {
  throw error instanceof ApiError ? error.toDataError() : error;
}

function query(path: string, values: Record<string, string | number | undefined | null>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

function iso(value: unknown): string {
  return value ? new Date(String(value)).toISOString() : new Date(0).toISOString();
}

function toProfile(value: any): Profile {
  return {
    id: value.id ?? value.userId,
    email: value.email,
    fullName: value.fullName ?? null,
    phone: value.phone ?? null,
    collegeId: value.collegeId ?? null,
    departmentId: value.departmentId ?? null,
    yearOfStudy: value.yearOfStudy ?? null,
    gender: value.gender ?? null,
    dateOfBirth: value.dateOfBirth ?? null,
    category: value.category ?? null,
    tshirtSize: value.tshirtSize ?? null,
    emergencyName: value.emergencyName ?? null,
    emergencyPhone: value.emergencyPhone ?? null,
    dietaryPref: value.dietaryPref ?? null,
    isBanned: Boolean(value.isBanned),
    createdAt: iso(value.createdAt),
    updatedAt: iso(value.updatedAt),
  };
}

export class ApiProfiles implements ProfileRepository {
  async get(): Promise<Profile | null> {
    try {
      const value = await apiFetch<any>("/profiles/me");
      return value ? toProfile(value) : null;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) return null;
      return fail(error);
    }
  }

  async update(_userId: string, patch: Partial<Profile>): Promise<Profile> {
    try {
      const value = await apiFetch<any>("/profiles/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      return toProfile(value);
    } catch (error) {
      return fail(error);
    }
  }
}

function toCharacter(value: any): Character {
  return {
    id: value.userId,
    userId: value.userId,
    playerName: value.playerName,
    collegeId: value.collegeId ?? null,
    departmentId: value.departmentId ?? null,
    yearOfStudy: value.yearOfStudy ?? null,
    skinId: value.avatarAssetId ?? "prospector",
    bio: value.bio ?? null,
    totalXp: Number(value.totalXp ?? 0),
    level: 1,
    title: null,
    createdAt: iso(value.createdAt),
    updatedAt: iso(value.updatedAt),
  };
}

export class ApiCharacters implements CharacterRepository {
  async getByUser(): Promise<Character | null> {
    try {
      const value = await apiFetch<any>("/characters/me");
      return value ? toCharacter(value) : null;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) return null;
      return fail(error);
    }
  }

  async getByPlayerName(): Promise<Character | null> {
    return null;
  }

  async isPlayerNameTaken(playerName: string, excludeUserId?: string): Promise<boolean> {
    try {
      const result = await apiFetch<{ available: boolean }>(query("/characters/availability", { playerName, excludeUserId }));
      return !result.available;
    } catch (error) {
      return fail(error);
    }
  }

  async create(_userId: string, input: NewCharacter): Promise<Character> {
    try {
      const value = await apiFetch<any>("/characters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerName: input.playerName, collegeId: input.collegeId, departmentId: input.departmentId, yearOfStudy: input.yearOfStudy, bio: input.bio ?? null }),
      });
      return toCharacter(value);
    } catch (error) {
      return fail(error);
    }
  }

  async update(_userId: string, patch: Partial<NewCharacter>): Promise<Character> {
    try {
      const value = await apiFetch<any>("/characters/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...patch, ...(patch.skinId ? { avatarAssetId: patch.skinId } : {}) }),
      });
      return toCharacter(value);
    } catch (error) {
      return fail(error);
    }
  }
}

function toEvent(value: any): FestEvent {
  return {
    id: value.id,
    slug: value.slug,
    title: value.title,
    tagline: value.tagline ?? value.description ?? null,
    description: value.description ?? null,
    rules: value.rules ?? null,
    categoryId: value.categoryId,
    status: value.status,
    mode: value.mode,
    minTeamSize: value.minTeamSize ?? 1,
    maxTeamSize: value.maxTeamSize ?? 1,
    capacity: value.capacity ?? null,
    venue: value.venue ?? null,
    startsAt: iso(value.startsAt),
    endsAt: iso(value.endsAt),
    registrationOpensAt: value.registrationOpensAt ? iso(value.registrationOpensAt) : null,
    registrationClosesAt: value.registrationClosesAt ? iso(value.registrationClosesAt) : null,
    xpReward: Number(value.xpReward ?? 0),
    entryFeeInr: Number(value.entryFeeInr ?? value.feeAmount ?? 0),
    requiresApproval: Boolean(value.requiresApproval),
    contactEmail: value.contactEmail ?? null,
    createdBy: value.createdBy ?? null,
    createdAt: iso(value.createdAt),
    updatedAt: iso(value.updatedAt),
  };
}

export class ApiEvents implements EventRepository {
  async list(filter: EventFilter = {}): Promise<FestEvent[]> {
    try {
      const values = await apiFetch<any[]>(query("/events", {
        search: filter.search,
        status: filter.status?.[0],
        mode: filter.mode === "either" ? undefined : filter.mode,
      }));
      return values.map(toEvent).filter((event) => !filter.categorySlug || (values.find((value) => value.id === event.id)?.categorySlug === filter.categorySlug));
    } catch (error) {
      return fail(error);
    }
  }

  async getBySlug(slug: string): Promise<FestEvent | null> {
    try {
      const value = await apiFetch<any>(`/events/${encodeURIComponent(slug)}`);
      return value ? toEvent(value) : null;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) return null;
      return fail(error);
    }
  }

  async getById(id: string): Promise<FestEvent | null> {
    try {
      const value = await apiFetch<any>(`/events/${encodeURIComponent(id)}`);
      return value ? toEvent(value) : null;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) return null;
      return fail(error);
    }
  }

  async stats(eventId: string): Promise<EventStats> {
    try {
      const value = await apiFetch<any>(`/events/${encodeURIComponent(eventId)}/stats`);
      return { eventId, confirmedCount: value.confirmedCount ?? 0, waitlistCount: value.waitlistCount ?? 0, checkedInCount: 0, capacity: value.capacity ?? null, seatsLeft: value.seatsLeft ?? null };
    } catch (error) {
      return fail(error);
    }
  }

  async schedule(): Promise<ScheduleSlot[]> {
    try {
      const values = await apiFetch<any[]>("/events/schedule");
      return values.map((value) => ({ id: value.id, eventId: value.eventId, title: value.roundName, dayLabel: new Date(value.startsAt).toLocaleDateString(), startsAt: iso(value.startsAt), endsAt: iso(value.endsAt), venue: value.venue ?? null, track: null, isBreak: false }));
    } catch (error) {
      return fail(error);
    }
  }
}

function toRegistration(value: any): Registration {
  return {
    id: value.id,
    eventId: value.eventId,
    userId: value.participantId ?? value.userId,
    teamId: value.teamId ?? null,
    status: value.status,
    registeredAt: iso(value.registeredAt),
    cancelledAt: value.cancelledAt ? iso(value.cancelledAt) : null,
    code: value.code ?? null,
    paymentStatus: value.paymentStatus ?? null,
    source: value.source ?? null,
    notes: value.notes ?? null,
    overrideReason: value.overrideReason ?? null,
    confirmedAt: value.confirmedAt ? iso(value.confirmedAt) : null,
    waitlistPosition: value.waitlistPosition ?? null,
  };
}

export class ApiRegistrations implements RegistrationRepository {
  async listForUser(_userId?: string): Promise<Registration[]> {
    try {
      return (await apiFetch<any[]>("/registrations/me")).map(toRegistration);
    } catch (error) {
      return fail(error);
    }
  }

  async listForEvent(eventId: string): Promise<Registration[]> {
    try {
      return (await apiFetch<any[]>(query("/registrations", { eventId }))).map(toRegistration);
    } catch (error) {
      return fail(error);
    }
  }

  async get(eventId: string, userId: string): Promise<Registration | null> {
    const rows = await this.listForUser(userId);
    return rows.find((row) => row.eventId === eventId && row.userId === userId) ?? null;
  }

  async register(eventId: string, _userId: string, teamId?: string): Promise<Registration> {
    try {
      return toRegistration(await apiFetch<any>("/registrations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, teamId: teamId ?? null }) }));
    } catch (error) {
      return fail(error);
    }
  }

  async cancel(registrationId: string): Promise<void> {
    try {
      await apiFetch(`/registrations/${registrationId}`, { method: "DELETE" });
    } catch (error) {
      return fail(error);
    }
  }
}

function toTeam(value: any): Team {
  return { id: value.id, eventId: value.eventId, name: value.name, joinCode: value.joinCode, leaderId: value.leaderUserId ?? value.leaderId, isLocked: Boolean(value.isLocked), createdAt: iso(value.createdAt) };
}

export class ApiTeams implements TeamRepository {
  async listForUser(): Promise<Team[]> {
    try { return (await apiFetch<any[]>("/teams")).map(toTeam); } catch (error) { return fail(error); }
  }
  async getById(teamId: string): Promise<Team | null> {
    try { return toTeam(await apiFetch<any>(`/teams/${teamId}`)); } catch (error) { if (error instanceof ApiError && error.statusCode === 404) return null; return fail(error); }
  }
  async getByJoinCode(code: string): Promise<Team | null> {
    try { return toTeam(await apiFetch<any>(`/teams/by-code/${encodeURIComponent(code)}`)); } catch (error) { if (error instanceof ApiError && error.statusCode === 404) return null; return fail(error); }
  }
  async members(teamId: string): Promise<TeamMember[]> {
    try { return await apiFetch<TeamMember[]>(`/teams/${teamId}/members`); } catch (error) { return fail(error); }
  }
  async create(eventId: string, _leaderId: string, name: string): Promise<Team> {
    try { const value = await apiFetch<any>("/teams", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, name }) }); return toTeam(value.team ?? value); } catch (error) { return fail(error); }
  }
  async join(code: string): Promise<Team> {
    try { const value = await apiFetch<any>("/teams/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ joinCode: code }) }); return toTeam(value.team ?? value); } catch (error) { return fail(error); }
  }
  async leave(): Promise<void> { throw new DataError("VALIDATION_FAILED", "Leaving a team is managed by the registration desk."); }
}

export class ApiReference implements ReferenceRepository {
  async colleges(): Promise<College[]> {
    try { return (await apiFetch<any[]>("/reference/colleges")).map((value) => ({ id: value.id, name: value.name, shortName: value.name.slice(0, 8).toUpperCase(), city: null, isActive: Boolean(value.active) })); } catch (error) { return fail(error); }
  }
  async departments(collegeId?: string | null): Promise<Department[]> {
    try { return (await apiFetch<any[]>(query("/reference/departments", { collegeId }))).map((value) => ({ id: value.id, collegeId: value.collegeId ?? null, name: value.name, shortName: null })); } catch (error) { return fail(error); }
  }
  async categories(): Promise<EventCategory[]> {
    try { return (await apiFetch<any[]>("/reference/categories")).map((value, index) => ({ id: value.id, slug: value.slug, name: value.name, description: value.description ?? null, worldLocationKey: value.slug, blockColor: "mc-stone", sortOrder: index + 1 })); } catch (error) { return fail(error); }
  }
  async levels(): Promise<Level[]> {
    try { return (await apiFetch<any[]>("/reference/levels")).map((value) => ({ level: value.levelNumber, minXp: Number(value.minXp), title: value.title })); } catch (error) { return fail(error); }
  }
  async sponsors(): Promise<Sponsor[]> {
    try { return (await apiFetch<any[]>("/reference/sponsors")).map((value, index) => ({ id: value.id, name: value.name, tier: ["diamond", "gold", "iron", "stone"].includes(value.tier?.toLowerCase()) ? value.tier.toLowerCase() : "stone", websiteUrl: value.websiteUrl ?? null, blurb: null, sortOrder: index + 1, isActive: Boolean(value.active) } as Sponsor)); } catch (error) { return fail(error); }
  }
}
