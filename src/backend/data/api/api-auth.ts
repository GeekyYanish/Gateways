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

function mapRole(role: string): Role {
  if (role === "ADMIN") return "admin";
  if (role === "ORGANIZER") return "organizer";
  if (role === "SCANNER") return "scanner";
  return "player";
}

function toSession(
  user: ApiUser,
  assignments: ApiRoleAssignment[] = [],
  expiresAt?: string,
): Session {
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
    // From GET /auth/session — the DB row's real expiry, not a guess. Nothing
    // should make an authorisation decision from it either way; the server
    // rejecting an expired cookie is what actually ends a session. Falls back
    // to "now" only if the backend omits it, so a stale value is never shown
    // as live.
    expiresAt: expiresAt ?? new Date().toISOString(),
  };
}

export class ApiAuth implements AuthRepository {
  private listeners = new Set<(session: Session | null) => void>();

  private emit(session: Session | null) {
    this.listeners.forEach((cb) => cb(session));
  }

  /**
   * Signup signs you in.
   *
   * Email verification is disabled on the backend (REQUIRE_EMAIL_VERIFICATION),
   * so the account is created already-verified and the session cookie arrives
   * with this response — `status: "ACTIVE"`.
   *
   * `null` is still a possible return: if verification is switched back on, the
   * backend answers VERIFICATION_SENT / VERIFICATION_PENDING with no session,
   * and the caller shows the OTP step. Read `status`, never assume.
   */
  async signUp(email: string, password: string, username: string): Promise<Session | null> {
    const data = await apiFetch<{
      status: "ACTIVE" | "VERIFICATION_SENT" | "VERIFICATION_PENDING";
      message: string;
      user?: ApiUser;
    }>("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, username: username.trim() }),
    }).catch(rethrow);

    if (data.status !== "ACTIVE") return null;

    const session = await this.getSession();
    if (!session) {
      // The cookie was set but the follow-up read failed. Do NOT synthesise a
      // session here: the old fallback invented `roles: ["player"]`, which
      // silently demoted staff and skipped forced password changes.
      throw new DataError(
        "NOT_AUTHENTICATED",
        "Your account was created but the session could not be loaded. Please sign in.",
      );
    }
    this.emit(session);
    return session;
  }

  /** Completes signup: exchanges the emailed OTP for a session cookie. */
  async verifyEmail(email: string, otp: string): Promise<Session> {
    const data = await apiFetch<{ user: ApiUser }>("/auth/verify-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, otp }),
    }).catch(rethrow);
    // No `?? toSession(data.user)` fallback: that path fabricated
    // `roles: ["player"]` and `mustChangePassword: false` from a response body
    // that carries neither, quietly demoting staff whenever this read hiccupped.
    const session = await this.getSession();
    if (!session) {
      throw new DataError(
        "NOT_AUTHENTICATED",
        "Signed in, but the session could not be loaded. Please try again.",
      );
    }
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
    // EMAIL_NOT_VERIFIED is not a failure: the backend has just reissued a code.
    // It propagates to the screen, which switches to the OTP step. Only
    // reachable if REQUIRE_EMAIL_VERIFICATION is turned back on.
    const data = await apiFetch<{ user: ApiUser }>("/auth/signin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).catch(rethrow);
    // No `?? toSession(data.user)` fallback: that path fabricated
    // `roles: ["player"]` and `mustChangePassword: false` from a response body
    // that carries neither, quietly demoting staff whenever this read hiccupped.
    const session = await this.getSession();
    if (!session) {
      throw new DataError(
        "NOT_AUTHENTICATED",
        "Signed in, but the session could not be loaded. Please try again.",
      );
    }
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
      const data = await apiFetch<{
        user: ApiUser;
        roles?: ApiRoleAssignment[];
        expiresAt?: string;
      }>("/auth/session");
      return data.user ? toSession(data.user, data.roles ?? [], data.expiresAt) : null;
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

  async exchangeWebsiteHandoff(code: string): Promise<{ returnTo: string }> {
    try {
      const data = await apiFetch<{ returnTo: string }>("/auth/website-handoff/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const session = await this.getSession();
      this.emit(session);
      return { returnTo: data.returnTo };
    } catch (error) {
      throw error instanceof ApiError ? error.toDataError() : error;
    }
  }
}

/** Present backend errors as the `DataError` codes screens already catch on. */
function rethrow(error: unknown): never {
  throw error instanceof ApiError ? error.toDataError() : error;
}
