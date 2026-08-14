import { DataError, type Character, type Profile, type Role, type Session } from "../types";
import { read, readList, subscribe, write, type Collection } from "./store";
import type { AuthRepository, Unsubscribe } from "../repository";

/**
 * Prototype authentication over localStorage.
 *
 * ⚠️  THIS IS NOT SECURITY. Read this before trusting it with anything.
 *
 * There is no server, so there is no security boundary. Any user can open
 * devtools and edit their own roles, XP, or registrations. Passwords are hashed
 * (SHA-256 + per-user salt) rather than stored in plaintext, which protects
 * users who reuse passwords across sites from casual disclosure — but a hash in
 * localStorage is still fully offline-attackable, and there is no rate limiting,
 * no session signing, and no server-side verification of anything.
 *
 * Concretely this means the organizer and admin dashboards are UI-only until the
 * MySQL backend lands, and QR check-in cannot be trusted (a forged token cannot
 * be detected without a server-held secret). That is an accepted, documented
 * trade-off for a prototype — see MYSQL-MIGRATION.md for the real model, where
 * role lives in a `user_roles` table that every mutating server action re-reads
 * rather than trusting anything the client says.
 */

interface StoredCredential {
  userId: string;
  email: string;
  /** hex SHA-256 of `${salt}:${password}` */
  hash: string;
  salt: string;
  provider: "password" | "google";
  createdAt: string;
}

interface StoredRole {
  userId: string;
  role: Role;
  grantedAt: string;
}

const SESSION_TTL_MS = 30 * 86_400_000; // 30 days

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Web Crypto is available in every target browser and in Node 18+. */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Constant-time-ish comparison. Not meaningful without a server, but avoids
 * teaching the wrong pattern to whoever ports this to the server version.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function makeSession(userId: string, email: string, roles: Role[]): Session {
  return {
    userId,
    email,
    roles,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
}

function rolesFor(userId: string): Role[] {
  const all = readList<StoredRole>("roles").filter((r) => r.userId === userId);
  const roles = all.map((r) => r.role);
  // Everyone is at least a player.
  return roles.length ? roles : ["player"];
}

export class LocalAuth implements AuthRepository {
  /**
   * No email round-trip locally, so signup still returns a live session and
   * this is never reached. It exists because the interface carries the real
   * backend's two-step flow (`signUp` → OTP → `verifyEmail`); throwing is more
   * honest than pretending to verify a code that was never sent.
   */
  async verifyEmail(): Promise<Session> {
    throw new DataError(
      "VALIDATION_FAILED",
      "The local data layer signs you in at signup; there is no code to verify.",
    );
  }

  async resendVerification(): Promise<void> {
    throw new DataError(
      "VALIDATION_FAILED",
      "The local data layer has no email delivery step.",
    );
  }

  async requestPasswordReset(): Promise<void> {
    throw new DataError(
      "STORAGE_UNAVAILABLE",
      "Password recovery is available when the portal is connected to the backend.",
    );
  }

  async resetPassword(): Promise<void> {
    throw new DataError(
      "STORAGE_UNAVAILABLE",
      "Password recovery is available when the portal is connected to the backend.",
    );
  }

  async signUp(email: string, password: string, username: string): Promise<Session> {
    const normalised = normaliseEmail(email);
    if (!normalised.includes("@")) {
      throw new DataError("VALIDATION_FAILED", "Enter a valid email address.");
    }
    if (password.length < 6) {
      throw new DataError("VALIDATION_FAILED", "Password must be at least 6 characters.");
    }
    const name = username.trim();
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) {
      throw new DataError(
        "VALIDATION_FAILED",
        "Username must be 3–16 characters: letters, numbers and underscores only.",
      );
    }

    const creds = readList<StoredCredential>("credentials");
    if (creds.some((c) => c.email === normalised)) {
      throw new DataError("EMAIL_TAKEN", "An account with that email already exists.");
    }
    if (readList<Character>("characters").some((c) => c.playerName.toLowerCase() === name.toLowerCase())) {
      throw new DataError("PLAYER_NAME_TAKEN", "That username is already taken.");
    }

    const userId = `usr-${randomHex(8)}`;
    const salt = randomHex(16);
    const hash = await sha256Hex(`${salt}:${password}`);

    creds.push({
      userId,
      email: normalised,
      hash,
      salt,
      provider: "password",
      createdAt: new Date().toISOString(),
    });
    write("credentials", creds);

    this.#createProfile(userId, normalised, name);
    this.#createDefaultCharacter(userId, name);
    this.#grant(userId, "player");

    return this.#persistSession(makeSession(userId, normalised, ["player"]));
  }

  async signIn(email: string, password: string): Promise<Session> {
    const normalised = normaliseEmail(email);
    const cred = readList<StoredCredential>("credentials").find(
      (c) => c.email === normalised,
    );

    // Same error whether the email is unknown or the password is wrong — not
    // meaningful here, but it avoids account enumeration once there is a server.
    if (!cred) throw new DataError("INVALID_CREDENTIALS", "Incorrect email or password.");

    const hash = await sha256Hex(`${cred.salt}:${password}`);
    if (!timingSafeEqual(hash, cred.hash)) {
      throw new DataError("INVALID_CREDENTIALS", "Incorrect email or password.");
    }

    return this.#persistSession(makeSession(cred.userId, cred.email, rolesFor(cred.userId)));
  }

  /**
   * Mock OAuth. Deterministically derives an account from the provider so
   * repeated "sign in with Google" returns the same user, as real OAuth would.
   */
  async signInWithProvider(provider: "google"): Promise<Session> {
    const email = `demo.${provider}@parallax.test`;
    const creds = readList<StoredCredential>("credentials");
    const existing = creds.find((c) => c.email === email);

    if (existing) {
      return this.#persistSession(
        makeSession(existing.userId, existing.email, rolesFor(existing.userId)),
      );
    }

    const userId = `usr-${randomHex(8)}`;
    creds.push({
      userId,
      email,
      // No password path for OAuth accounts; an unusable hash makes that explicit.
      hash: "oauth-no-password",
      salt: randomHex(16),
      provider,
      createdAt: new Date().toISOString(),
    });
    write("credentials", creds);

    this.#createProfile(userId, email, `Demo ${provider}`);
    this.#createDefaultCharacter(userId, `Demo_${provider}`);
    this.#grant(userId, "player");

    return this.#persistSession(makeSession(userId, email, ["player"]));
  }

  async signOut(): Promise<void> {
    write("session", null);
  }

  async getSession(): Promise<Session | null> {
    const s = read<Session | null>("session", null);
    if (!s) return null;

    // Expire like a real session rather than living forever.
    if (new Date(s.expiresAt).getTime() < Date.now()) {
      write("session", null);
      return null;
    }

    // Re-read roles rather than trusting the stored copy, so a role granted in
    // another tab takes effect. (In the server version this is exactly why every
    // mutation re-derives the role instead of trusting the session claim.)
    return { ...s, roles: rolesFor(s.userId) };
  }

  onAuthStateChange(cb: (session: Session | null) => void): Unsubscribe {
    const relevant: Collection[] = ["session", "roles"];
    return subscribe((c) => {
      if (!relevant.includes(c)) return;
      void this.getSession().then(cb);
    });
  }

  async grantRole(userId: string, role: Role): Promise<void> {
    this.#grant(userId, role);
  }

  // -- internals ------------------------------------------------------------

  #grant(userId: string, role: Role): void {
    const roles = readList<StoredRole>("roles");
    if (roles.some((r) => r.userId === userId && r.role === role)) return;
    roles.push({ userId, role, grantedAt: new Date().toISOString() });
    write("roles", roles);
  }

  #createProfile(userId: string, email: string, fullName?: string): void {
    const profiles = readList<Profile>("profiles");
    if (profiles.some((p) => p.id === userId)) return;
    const now = new Date().toISOString();
    profiles.push({
      id: userId,
      email,
      fullName: fullName ?? null,
      phone: null,
      // The participant fields stay null until the registration form collects
      // them. Sign-up asks for an email and a password and nothing else, and
      // demanding a T-shirt size to create an account would be absurd.
      gender: null,
      dateOfBirth: null,
      category: null,
      tshirtSize: null,
      emergencyName: null,
      emergencyPhone: null,
      dietaryPref: null,
      isBanned: false,
      createdAt: now,
      updatedAt: now,
    });
    write("profiles", profiles);
  }

  #createDefaultCharacter(userId: string, playerName: string): void {
    const characters = readList<Character>("characters");
    if (characters.some((character) => character.userId === userId)) return;
    let uniqueName = playerName.trim();
    if (characters.some((character) => character.playerName.toLowerCase() === uniqueName.toLowerCase())) {
      uniqueName = `P_${randomHex(7)}`.slice(0, 16);
    }
    const now = new Date().toISOString();
    characters.push({
      id: `chr-${randomHex(8)}`,
      userId,
      playerName: uniqueName,
      collegeId: null,
      departmentId: null,
      yearOfStudy: null,
      skinId: "prospector",
      bio: null,
      totalXp: 0,
      level: 1,
      title: "Wanderer",
      createdAt: now,
      updatedAt: now,
    });
    write("characters", characters);
  }

  #persistSession(session: Session): Session {
    write("session", session);
    return session;
  }
}
