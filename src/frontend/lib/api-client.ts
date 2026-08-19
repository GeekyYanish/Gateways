/**
 * Browser client for the Gateways backend, reached through the same-origin
 * proxy at `/api/v1/*` (see `src/app/api/v1/[...path]/route.ts`).
 *
 * NOT the same thing as `src/backend/data/http/api-client.ts`. That one targets
 * the draft contract in `registration-console/BACKEND-API-CONTRACT.md` — a
 * different API (`/v1/registrations`, `/v1/participants`, `/v1/payments`) that
 * no deployed service implements. This one talks to the real Fastify backend.
 * Keep them apart; they are not interchangeable.
 */

import { DataError, type DataErrorCode } from "@/backend/data/types";

/** The backend's error envelope — `src/errors/DataError.ts` in that repo. */
export interface ApiErrorPayload {
  code: string;
  message: string;
  statusCode: number;
  retryable: boolean;
  correlationId?: string;
}

export class ApiError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly correlationId?: string;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiError";
    this.code = payload.code;
    this.statusCode = payload.statusCode;
    this.retryable = payload.retryable;
    this.correlationId = payload.correlationId;
  }

  /**
   * Re-throw as the `DataError` the repository layer and screens already catch
   * on, when the backend's code is one this app knows. Anything unrecognised
   * stays an `ApiError` rather than being forced into a near-miss — a wrong
   * code is worse than an unfamiliar one.
   */
  toDataError(): DataError | ApiError {
    return KNOWN_CODES.has(this.code)
      ? new DataError(this.code as DataErrorCode, this.message)
      : this;
  }
}

const KNOWN_CODES = new Set<string>([
  "NOT_AUTHENTICATED",
  "INVALID_CREDENTIALS",
  "EMAIL_TAKEN",
  "PLAYER_NAME_TAKEN",
  "NOT_FOUND",
  "ALREADY_REGISTERED",
  "EVENT_FULL",
  "REGISTRATION_CLOSED",
  "TEAM_FULL",
  "TEAM_LOCKED",
  "INVALID_JOIN_CODE",
  "STORAGE_UNAVAILABLE",
  "VALIDATION_FAILED",
  "RECEIPT_ALREADY_SUBMITTED",
  "PAYMENT_NOT_VERIFIED",
  "FORBIDDEN",
  "MUST_CHANGE_PASSWORD",
  "EMAIL_NOT_VERIFIED",
  "OAUTH_ACCOUNT",
]);

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

/**
 * Call the backend through the proxy.
 *
 * `credentials: "same-origin"` is correct precisely BECAUSE of the proxy — the
 * cookies live on this origin. It would have to be `"include"` for direct
 * cross-origin calls, which is the arrangement the proxy exists to avoid.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  /**
   * CSRF double-submit: the backend compares this header against the
   * `csrf_token` cookie it set at sign-in and rejects a mismatch. Only
   * cookie-authenticated mutations are checked — reads are exempt, and so are
   * bearer-authenticated calls, which cannot be triggered cross-site.
   */
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = readCookie(CSRF_COOKIE);
    if (token) headers.set(CSRF_HEADER, token);
  }

  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
  });

  if (response.status === 204) return null as T;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const envelope = (data as { error?: ApiErrorPayload } | null)?.error;
    throw new ApiError(
      envelope ?? {
        code: "REQUEST_FAILED",
        message: "The request could not be completed.",
        statusCode: response.status,
        retryable: response.status >= 500,
        correlationId:
          response.headers.get("x-correlation-id") ?? undefined,
      },
    );
  }

  return data as T;
}
