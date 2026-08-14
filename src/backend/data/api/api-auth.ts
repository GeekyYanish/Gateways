/**
 * AuthRepository backed by the real Gateways backend
 * (github.com/DarshanHeble/gateways2026_backend), reached through the
 * same-origin proxy at `/api/v1/*`.
 *
 * The session itself is an httpOnly `__session` cookie the browser cannot read,
 * so there is no token to store or pass around — every call just carries the
 * cookie, and `getSession()` asks the server who we are.
 */

import { apiFetch, ApiError } from "@/frontend/lib/api-client";
import type { AuthRepository, Unsubscribe } from "../repository";
import { DataError, type Role, type RoleAssignment, type Session } from "../types";

/** `GET /api/v1/auth/session` and the body of signin / verify-email. */
interface ApiUser {
  id: string;
  email: string;
  status?: string;
  emailVerified?: string | null;
  mustChangePassword?: boolean;
}

interface ApiRoleAssignment {
  role: string;
  eventScopeId: string | null;
}

/**
 * `expiresAt` is a local restatement of the backend's 7-day cookie lifetime, not
 * a value it sends. Nothing should make an authorisation decision from it; the
 * server rejecting an expired cookie is the only thing that actually ends a
 * session.
 */
const SESSION_DAYS = 7;

function mapRole(role: string): Role {
  if (role === "ADMIN") return "admin";
  if (role === "ORGANIZER") return "organizer";
  if (role === "SCANNER") return "scanner";
  return "player";
}

function toSession(user: ApiUser, assignments: ApiRoleAssignment[] = []): Session {
  const roles = assignments.length
    ? assignments.map((assignment) => mapRole(assignment.role))
    : ["player" as const];
  return {
    userId: user.id,
    email: user.email,
    roles: [...new Set(roles)],
    assignments: assignments.map((assignment): RoleAssignment => ({
      role: mapRole(assignment.role),
      eventScopeId: assignment.eventScopeId,
    })),
    mustChangePassword: Boolean(user.mustChangePassword),
    expiresAt: new Date(
      Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString(),
  };
}

export class ApiAuth implements AuthRepository {
  private listeners = new Set<(session: Session | null) => void>();

  private emit(session: Session | null) {
    this.listeners.forEach((cb) => cb(session));
  }

  /**
   * Signup does NOT sign you in.
   *
   * The backend creates the account, emails a six-digit OTP, and returns
   * `{ requiresVerification: true, email }`. A session only exists after
   * `verifyEmail()`. Returning `null` rather than throwing keeps the caller in
   * control of showing the code entry step.
   */
  async signUp(email: string, password: string, username: string): Promise<Session | null> {
    await apiFetch<{ message: string }>(
      "/auth/signup",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, username: username.trim() }),
      },
    ).catch(rethrow);
    return null;
  }

  /** Completes signup: exchanges the emailed OTP for a session cookie. */
  async verifyEmail(email: string, otp: string): Promise<Session> {
    const data = await apiFetch<{ user: ApiUser }>("/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, otp }),
    }).catch(rethrow);
    const session = await this.getSession() ?? toSession(data.user);
    this.emit(session);
    return session;
  }

  async resendVerification(email: string): Promise<void> {
    await apiFetch<{ message: string }>("/auth/resend-verification", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(rethrow);
  }

  async requestPasswordReset(email: string): Promise<void> {
    await apiFetch<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(rethrow);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await apiFetch<{ message: string }>("/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    }).catch(rethrow);
  }

  async signIn(email: string, password: string): Promise<Session> {
    const data = await apiFetch<{ user: ApiUser }>("/auth/signin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).catch(rethrow);
    const session = await this.getSession() ?? toSession(data.user);
    this.emit(session);
    return session;
  }

  async signInWithProvider(provider: "google", returnTo = "/travelling"): Promise<Session> {
    if (provider !== "google") {
      throw new DataError(
        "VALIDATION_FAILED",
        `${provider} sign-in is not configured on the backend.`,
      );
    }
    const query = new URLSearchParams({ returnTo }).toString();
    const { url } = await apiFetch<{ url: string }>(
      `/auth/signin/google?${query}`,
    ).catch(rethrow);
    // Full-page redirect; the callback lands back on this origin with cookies
    // set. Nothing after this line runs, hence the never-resolving promise
    // rather than a fabricated Session.
    window.location.assign(url);
    return new Promise<Session>(() => {});
  }

  async signOut(): Promise<void> {
    await apiFetch<{ message: string }>("/auth/signout", {
      method: "POST",
    }).catch(rethrow);
    this.emit(null);
  }

  async getSession(): Promise<Session | null> {
    try {
      const data = await apiFetch<{ user: ApiUser; roles?: ApiRoleAssignment[] }>("/auth/session");
      return data.user ? toSession(data.user, data.roles ?? []) : null;
    } catch (error) {
      // Signed out is the normal case, not a failure.
      if (error instanceof ApiError && error.statusCode === 401) return null;
      throw error instanceof ApiError ? error.toDataError() : error;
    }
  }

  /**
   * Fires on sign-in and sign-out performed BY THIS TAB.
   *
   * The local implementation also caught cross-tab changes through a shared
   * localStorage key. There is no equivalent here — the session lives in an
   * httpOnly cookie that JavaScript cannot observe, and the backend has no push
   * channel. A tab signed out elsewhere finds out on its next call, when the
   * server returns 401.
   */
  onAuthStateChange(cb: (session: Session | null) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  async grantRole(): Promise<void> {
    // `/auth/admin/roles/:userId` exists but is admin-authenticated; this app
    // has no admin surface, and the prototype helper this replaced only ever
    // existed to exercise local views.
    throw new DataError(
      "NOT_AUTHENTICATED",
      "Roles are granted from the admin console, not the participant site.",
    );
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<Session> {
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const session = await this.getSession();
      if (!session) throw new DataError("NOT_AUTHENTICATED", "Your session expired.");
      this.emit(session);
      return session;
    } catch (error) {
      throw error instanceof ApiError ? error.toDataError() : error;
    }
  }

  async createConsoleHandoff(returnTo = "/"): Promise<{ url: string; expiresAt: string }> {
    try {
      return await apiFetch("/auth/console-handoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ returnTo }),
      });
    } catch (error) {
      throw error instanceof ApiError ? error.toDataError() : error;
    }
  }
}

/** Present backend errors as the `DataError` codes screens already catch on. */
function rethrow(error: unknown): never {
  throw error instanceof ApiError ? error.toDataError() : error;
}
