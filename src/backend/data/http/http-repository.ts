/**
 * HttpRepository — backed by the registration backend described in
 * BACKEND-API-CONTRACT.md, for the two things that contract actually covers
 * from this side: submitting a registration, and reading back profile/
 * registration state a Console staffer may have changed.
 *
 * Everything else on `Repository` (characters, teams, attendance,
 * achievements, xp, leaderboard, announcements, reference, paymentReceipts)
 * is out of scope for v1 (contract §6) and delegates straight through to
 * `LocalRepository`, unchanged.
 *
 * Known gap (contract §1): Console's `Participant` needs gender, date of
 * birth, category, T-shirt size, dietary preference, and emergency contact —
 * none of which the current onboarding/character-creation flow collects. They
 * are sent as `null` below until the registration form is extended. Until
 * then, records created here will show as incomplete in the Console's Intake
 * and Money modules.
 */

import type {
  CharacterRepository,
  ProfileRepository,
  ReferenceRepository,
  RegistrationRepository,
  Repository,
} from "../repository";
import type {
  DietaryPref,
  Gender,
  ParticipantCategory,
  Profile,
  Registration,
  RegistrationStatus,
  TshirtSize,
} from "../types";
import { createLocalRepository } from "../local/local-repository";
import { api } from "./api-client";

/** Shape returned by the backend for a participant — see contract §1a/§5. */
interface ApiParticipant {
  id: string; // == Gateways users.id, per contract §1a
  email: string;
  fullName: string;
  phone: string;
  // The console types these as non-null on its own Participant, but a record
  // created by CSV import or at the on-spot desk can arrive with blanks, so
  // they are read defensively and normalised to null on the way in.
  gender?: Gender | null;
  dateOfBirth?: string | null;
  category?: ParticipantCategory | null;
  tshirtSize?: TshirtSize | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  dietaryPref?: DietaryPref | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Shape returned by the backend for a registration — see contract §5. */
interface ApiRegistration {
  id: string;
  eventId: string;
  participantId: string; // == userId, per contract §1a
  teamId: string | null;
  status: RegistrationStatus;
  registeredAt: string;
  cancelledAt: string | null;
}

function toGatewayProfile(p: ApiParticipant): Profile {
  return {
    id: p.id,
    email: p.email,
    fullName: p.fullName,
    phone: p.phone,
    gender: p.gender ?? null,
    dateOfBirth: p.dateOfBirth ?? null,
    category: p.category ?? null,
    tshirtSize: p.tshirtSize ?? null,
    emergencyName: p.emergencyName ?? null,
    emergencyPhone: p.emergencyPhone ?? null,
    dietaryPref: p.dietaryPref ?? null,
    isBanned: false, // not modelled by the backend contract yet
    createdAt: p.createdAt ?? new Date().toISOString(),
    updatedAt: p.updatedAt ?? new Date().toISOString(),
  };
}

function toGatewayRegistration(r: ApiRegistration): Registration {
  return {
    id: r.id,
    eventId: r.eventId,
    userId: r.participantId,
    teamId: r.teamId,
    status: r.status,
    registeredAt: r.registeredAt,
    cancelledAt: r.cancelledAt,
  };
}

function httpProfiles(): ProfileRepository {
  return {
    get: async (userId: string) => {
      const p = await api.get<ApiParticipant | null>(`/v1/participants/${userId}`);
      return p ? toGatewayProfile(p) : null;
    },
    update: async (userId: string, patch: Partial<Profile>) => {
      const p = await api.patch<ApiParticipant>(`/v1/participants/${userId}`, patch);
      return toGatewayProfile(p);
    },
  };
}

function httpRegistrations(
  base: RegistrationRepository,
  profiles: ProfileRepository,
  characters: CharacterRepository,
  reference: ReferenceRepository,
): RegistrationRepository {
  return {
    ...base,
    /**
     * The `participant` object is assembled from BOTH stores: the person-level
     * fields live on `Profile`, while college/department/year live on
     * `Character`. That split is a Gateways detail the backend does not share —
     * it takes one flat participant — so this is where the two are rejoined.
     */
    register: async (eventId: string, userId: string, teamId?: string) => {
      const [profile, character] = await Promise.all([
        profiles.get(userId),
        characters.getByUser(userId),
      ]);

      // `department` is FREE TEXT on the console, but an FK here. Resolve the
      // id to its name rather than shipping an opaque "dep-004" that means
      // nothing in the other database. This is the one genuine shape mismatch
      // between the two apps.
      let department: string | null = null;
      if (character?.departmentId) {
        const departments = await reference.departments(
          character.collegeId ?? undefined,
        );
        department =
          departments.find((d) => d.id === character.departmentId)?.name ?? null;
      }

      const created = await api.post<ApiRegistration>("/v1/registrations", {
        eventId,
        teamId,
        participant: {
          fullName: profile?.fullName ?? "",
          email: profile?.email ?? "",
          phone: profile?.phone ?? "",
          collegeId: character?.collegeId ?? null,
          department,
          yearOfStudy: character?.yearOfStudy ?? null,
          gender: profile?.gender ?? null,
          dateOfBirth: profile?.dateOfBirth ?? null,
          category: profile?.category ?? null,
          tshirtSize: profile?.tshirtSize ?? null,
          emergencyName: profile?.emergencyName ?? null,
          emergencyPhone: profile?.emergencyPhone ?? null,
          dietaryPref: profile?.dietaryPref ?? null,
        },
      });
      return toGatewayRegistration(created);
    },
    cancel: async (registrationId: string) => {
      await api.patch(`/v1/registrations/${registrationId}/status`, { status: "cancelled" });
    },
    listForUser: async (userId: string) => {
      const rows = await api.get<ApiRegistration[]>("/v1/registrations", { participantId: userId });
      return rows.map(toGatewayRegistration);
    },
    listForEvent: async (eventId: string) => {
      const rows = await api.get<ApiRegistration[]>("/v1/registrations", { eventId });
      return rows.map(toGatewayRegistration);
    },
    get: async (eventId: string, userId: string) => {
      const rows = await api.get<ApiRegistration[]>("/v1/registrations", {
        eventId,
        participantId: userId,
      });
      const match = rows[0];
      return match ? toGatewayRegistration(match) : null;
    },
  };
}

/**
 * Every module outside profiles/registrations stays on `LocalRepository`,
 * unchanged — see the file header. Only those two keys are overridden.
 */
export function createHttpRepository(): Repository {
  const base = createLocalRepository();
  const profiles = httpProfiles();
  return {
    ...base,
    profiles,
    registrations: httpRegistrations(
      base.registrations,
      profiles,
      base.characters,
      base.reference,
    ),
  };
}
